"""
Scan venues for cash-and-carry opportunities and rank what survives costing.

The scanner is deliberately pessimistic. Its job is not to find trades; it is to
reject trades that only look profitable before fees, and to report honestly when
nothing clears. Most of the time, nothing clears -- that is the correct and
useful answer, and it is the answer that keeps capital intact.
"""

from datetime import datetime, timezone

from . import fees, sessions
from .basis import evaluate, liquidation_move, position_size


def scan(quotes, hurdle=0.04, risk_premium=0.03, close_early=False):
    """
    Cost every quote and sort by realisable edge.

    :param quotes: iterable of BasisQuote.
    :param hurdle: risk-free rate to beat, decimal fraction per year.
    :param risk_premium: additional annualised return demanded for counterparty
        and liquidation risk.
    :param close_early: True if the futures leg will be traded out before expiry
        rather than settled, which costs an extra taker fee.
    :return: list of BasisResult, best edge first.
    """
    results = [
        evaluate(
            quote,
            fee_cost=fees.round_trip_cost(quote.venue, close_early=close_early),
            hurdle=hurdle,
            risk_premium=risk_premium,
            close_early=close_early,
        )
        for quote in quotes
    ]
    return sorted(results, key=lambda r: r.edge, reverse=True)


def safety_check(result, capital, margin_ratio=0.5):
    """
    Assess whether the short futures leg can survive the path to expiry.

    Solvency at expiry is guaranteed by convergence. Solvency *before* expiry is
    not, and a liquidation converts a locked profit into a realised loss while
    leaving the spot leg unhedged.

    :param result: BasisResult under consideration.
    :param capital: total capital allocated to the trade.
    :param margin_ratio: collateral posted per unit of futures notional.
    :return: dict describing sizing and the liquidation distance.
    """
    schedule = fees.get_schedule(result.venue)
    notional, spot_outlay, collateral = position_size(capital, margin_ratio)
    move = liquidation_move(margin_ratio, schedule.maintenance_margin)
    return {
        "notional": notional,
        "spot_outlay": spot_outlay,
        "futures_collateral": collateral,
        "leverage": round(1.0 / margin_ratio, 2),
        "liquidation_move_pct": move * 100.0,
        "liquidation_price": result.spot * (1.0 + move),
        "safe": move >= 0.25,
        "note": (
            "comfortable buffer"
            if move >= 0.25
            else "TOO TIGHT - a routine rally liquidates the short leg; reduce leverage"
        ),
    }


def report(quotes, capital=10000.0, hurdle=0.04, risk_premium=0.03,
           margin_ratio=0.5, close_early=False, moment=None):
    """
    Produce a full scan report combining costing, timing, and sizing.

    :param quotes: iterable of BasisQuote.
    :param capital: capital available for the trade.
    :param hurdle: risk-free rate to beat.
    :param risk_premium: additional annualised return demanded.
    :param margin_ratio: collateral posted per unit of futures notional.
    :param close_early: whether the futures leg is closed before settlement.
    :param moment: reference instant, defaults to now in UTC.
    :return: dict containing the clock report, ranked results, and a verdict.
    """
    moment = moment or datetime.now(timezone.utc)
    ranked = scan(quotes, hurdle=hurdle, risk_premium=risk_premium, close_early=close_early)
    tradeable = [r for r in ranked if r.tradeable]
    best = ranked[0] if ranked else None

    return {
        "clock": sessions.clock_report(moment),
        "scanned": len(ranked),
        "tradeable": len(tradeable),
        "results": ranked,
        "best": best,
        "safety": safety_check(best, capital, margin_ratio) if best else None,
        "verdict": (
            f"{len(tradeable)} opportunity(ies) clear the hurdle"
            if tradeable
            else "nothing clears after fees - hold cash and rescan later"
        ),
    }


def format_report(data):
    """
    Render a scan report as plain text for terminal output.

    :param data: dict returned by report().
    :return: formatted multi-line string.
    """
    clock = data["clock"]
    lines = [
        "=" * 78,
        "  CASH-AND-CARRY BASIS SCAN",
        "=" * 78,
        f"  UTC              {clock['utc']}",
        f"  Sessions open    {', '.join(clock['active_sessions']) or 'none'}  ({clock['liquidity']})",
        f"  Execution        {clock['execution_advice']}",
        f"  Next funding     {clock['next_funding']}",
        f"  Next expiry      {clock['next_quarterly_expiry']}  ({clock['days_to_expiry']} days)",
        f"  CME closed       {clock['cme_closed']}",
        "-" * 78,
        f"  {'VENUE':<9}{'CONTRACT':<18}{'DAYS':>6}{'GROSS':>9}{'NET p.a.':>10}{'EDGE':>9}{'':>4}",
        "-" * 78,
    ]

    for r in data["results"]:
        flag = "OK" if r.tradeable else "--"
        lines.append(
            f"  {r.venue:<9}{r.symbol:<18}{r.days_to_expiry:>6.1f}"
            f"{r.gross_basis * 100:>8.2f}%{r.annualised_net * 100:>9.2f}%"
            f"{r.edge * 100:>8.2f}%  {flag}"
        )

    if not data["results"]:
        lines.append("  no quotes retrieved")

    lines.append("-" * 78)
    lines.append(f"  VERDICT: {data['verdict']}")

    best = data["best"]
    if best:
        lines += [
            "",
            f"  Best: {best.venue} {best.symbol}",
            f"    {best.reason}",
            f"    gross basis {best.gross_basis * 100:.3f}%  fees {best.fee_cost * 100:.3f}%"
            f"  net {best.net_basis * 100:.3f}%",
        ]
        safety = data["safety"]
        if safety:
            lines += [
                "",
                f"  Sizing at {safety['leverage']}x on the short leg:",
                f"    spot outlay        {safety['spot_outlay']:,.2f}",
                f"    futures collateral {safety['futures_collateral']:,.2f}",
                f"    liquidation at     {safety['liquidation_price']:,.2f}"
                f"  (+{safety['liquidation_move_pct']:.1f}%)",
                f"    {safety['note']}",
            ]

    lines.append("=" * 78)
    return "\n".join(lines)
