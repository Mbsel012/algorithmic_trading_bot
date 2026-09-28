"""
Prediction-market arbitrage: the YES/NO sum identity on binary markets.

A binary market resolves with exactly one side paying $1.00 and the other $0.00.
So the two sides must sum to $1.00 at settlement, by the contract, always:

    YES + NO  ==  1.00

Buy both for less than that and you hold a claim on $1.00 regardless of outcome.
Like the box spread, the convergence is contractual rather than probabilistic --
which is what separates this from a bet. Unlike the box spread it needs no
derivatives venue, no colocation and no minimum size, which is why it is
reachable where dated-futures arbitrage is not.

Two things sink it, and both are modelled here rather than assumed away:

  TIME. The profit is locked but illiquid until resolution. A 3% edge is 161%
  annualised over a week and 3% over a year. Without the resolution date the
  headline edge means nothing.

  RESOLUTION RISK. Settlement is decided by an oracle reading market wording
  that may be ambiguous or disputed. A market that resolves against the plain
  reading pays you zero on a position you called risk-free. One such event
  erases many clean wins, so `oracle_risk` is a required input, not an option.

Stdlib only.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass

from . import store
from .basis import annualise

TIMEOUT = 15
USER_AGENT = "prediction-arb-scanner/1.0"

#: Assumed share of markets whose resolution goes against the plain reading --
#: ambiguous wording, a disputed oracle outcome, a settlement you lose. This is
#: an ASSUMPTION, not a measurement. Replace it with your own observed rate
#: before sizing anything; the whole verdict pivots on it.
DEFAULT_ORACLE_RISK = 0.01

#: Polymarket has historically charged no maker/taker fee, but gas and any
#: settlement fee still apply. Kept explicit so it is never silently zero.
DEFAULT_FEE = 0.002


class FeedError(RuntimeError):
    """Raised when a market feed cannot be reached or returns unusable data."""


@dataclass
class ArbResult:
    """A costed assessment of one sum-identity opportunity."""

    market: str
    legs: int
    total_cost: float
    gross_edge: float
    fee: float
    oracle_risk: float
    expected_payout: float
    net_return: float
    days_to_resolution: float
    annualised: float
    hurdle: float
    tradeable: bool
    reason: str

    def as_dict(self):
        """:return: dataclass contents as a plain dict."""
        return asdict(self)


def effective_price(levels, size):
    """
    Volume-weighted price of filling `size` against an order book side.

    The top-of-book price is what screenshots show; it is not what you pay for
    anything but the first few dollars. A sum that looks arbitrageable at the
    touch routinely is not once the order actually walks the book.

    :param levels: iterable of (price, available_size), best price first.
    :param size: quantity to fill.
    :return: volume-weighted average price for the full size.
    :raises ValueError: if size is not positive or the book cannot fill it.
    """
    if size <= 0:
        raise ValueError("size must be positive")
    remaining, spend = float(size), 0.0
    for price, available in levels:
        take = min(remaining, float(available))
        spend += take * float(price)
        remaining -= take
        if remaining <= 1e-12:
            return spend / size
    raise ValueError(f"book too thin: {remaining:.4f} of {size} unfilled")


def assess(market, leg_prices, days_to_resolution, fee=DEFAULT_FEE,
           oracle_risk=DEFAULT_ORACLE_RISK, hurdle=0.04, risk_premium=0.03):
    """
    Cost a sum-identity opportunity and decide whether it survives its risks.

    Works for a binary market (two legs) and for any set of mutually exclusive
    outcomes that must sum to 1.00. The gates, in order:

    The legs must cost less than 1.00 after fees, or there is nothing to win.
    The payout must survive resolution risk: staking `cost` to receive 1.00
    only `(1 - oracle_risk)` of the time means the break-even cost is
    `(1 - oracle_risk)`, not 1.00 -- so a 1% dispute rate eats a 1% edge whole.
    And the surviving return, annualised over the wait, must beat the hurdle
    plus a premium, because capital is locked until the market resolves.

    :param market: market name, for reporting.
    :param leg_prices: price of each leg; they must be mutually exclusive and
        exhaustive, so that exactly one pays 1.00.
    :param days_to_resolution: days until settlement, must be > 0.
    :param fee: total trading cost as a fraction of stake.
    :param oracle_risk: assumed share of resolutions that pay you nothing.
    :param hurdle: risk-free rate to beat, annualised.
    :param risk_premium: extra annualised return demanded for lock-up and
        counterparty exposure.
    :return: ArbResult.
    :raises ValueError: on empty legs, non-positive prices, or a bad horizon.
    """
    legs = [float(p) for p in leg_prices]
    if not legs:
        raise ValueError("need at least one leg")
    if any(p <= 0 for p in legs):
        raise ValueError("every leg price must be positive")
    if days_to_resolution <= 0:
        raise ValueError("days_to_resolution must be positive")

    cost = sum(legs) * (1.0 + fee)
    gross = 1.0 - sum(legs)
    payout = 1.0 - oracle_risk          # expected value of a $1 claim
    net_return = (payout - cost) / cost
    ann = annualise(net_return, days_to_resolution)

    if sum(legs) >= 1.0:
        tradeable, reason = False, f"legs sum to {sum(legs):.4f} - no edge before fees"
    elif cost >= 1.0:
        tradeable, reason = False, "fees consume the entire sum discount"
    elif net_return <= 0:
        tradeable, reason = False, (
            f"edge {gross * 100:.2f}% does not survive {oracle_risk * 100:.1f}% "
            f"resolution risk"
        )
    elif ann < hurdle + risk_premium:
        tradeable, reason = False, (
            f"{ann * 100:.2f}% annualised over {days_to_resolution:.0f} days "
            f"is below the {(hurdle + risk_premium) * 100:.0f}% required"
        )
    else:
        tradeable, reason = True, (
            f"{ann * 100:.2f}% annualised, clears the "
            f"{(hurdle + risk_premium) * 100:.0f}% bar"
        )

    return ArbResult(
        market=market, legs=len(legs), total_cost=cost, gross_edge=gross,
        fee=fee, oracle_risk=oracle_risk, expected_payout=payout,
        net_return=net_return, days_to_resolution=days_to_resolution,
        annualised=ann, hurdle=hurdle + risk_premium,
        tradeable=tradeable, reason=reason,
    )


def break_even_cost(days_to_resolution, oracle_risk=DEFAULT_ORACLE_RISK,
                    fee=DEFAULT_FEE, hurdle=0.04, risk_premium=0.03):
    """
    Highest total leg price still worth paying, given the wait and the risks.

    Useful as a standing rule: anything above this number is not worth reading
    further, whatever the headline edge looks like.

    :param days_to_resolution: days until settlement.
    :param oracle_risk: assumed share of resolutions that pay nothing.
    :param fee: total trading cost as a fraction of stake.
    :param hurdle: risk-free rate to beat, annualised.
    :param risk_premium: extra annualised return demanded.
    :return: maximum acceptable sum of leg prices, before fees.
    :raises ValueError: if the horizon is not positive.
    """
    if days_to_resolution <= 0:
        raise ValueError("days_to_resolution must be positive")
    required = (hurdle + risk_premium) * days_to_resolution / 365.0
    return (1.0 - oracle_risk) / ((1.0 + required) * (1.0 + fee))


def _get(url):
    """
    Fetch and decode a JSON document over HTTPS.

    :param url: absolute URL.
    :return: decoded JSON.
    :raises FeedError: on any transport or decoding failure.
    """
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
        raise FeedError(f"could not reach {url}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise FeedError(f"malformed JSON from {url}: {exc}") from exc


def fetch_markets(limit=100, closed=False):
    """
    Open markets from Polymarket's public Gamma API.

    :param limit: maximum markets to request.
    :param closed: include resolved markets.
    :return: list of raw market dicts.
    :raises FeedError: if the feed is unreachable or shaped unexpectedly.
    """
    url = (f"https://gamma-api.polymarket.com/markets"
           f"?limit={int(limit)}&closed={'true' if closed else 'false'}")
    payload = _get(url)
    if not isinstance(payload, list):
        raise FeedError("gamma API did not return a list of markets")
    return payload


def format_report(result):
    """
    Render an assessment as plain text.

    :param result: ArbResult to render.
    :return: formatted multi-line string.
    """
    return "\n".join([
        "=" * 72,
        f"  SUM-IDENTITY ARBITRAGE - {result.market}",
        "=" * 72,
        f"  legs                    {result.legs:>10}",
        f"  sum of leg prices       {result.total_cost / (1 + result.fee):>10.4f}",
        f"  gross edge              {result.gross_edge * 100:>9.2f}%   <- what screenshots show",
        f"  + fees                  {result.fee * 100:>9.2f}%",
        f"  total cost              {result.total_cost:>10.4f}",
        "-" * 72,
        f"  resolution risk         {result.oracle_risk * 100:>9.2f}%",
        f"  expected payout         {result.expected_payout:>10.4f}   <- not 1.0000",
        f"  net return              {result.net_return * 100:>9.2f}%   <- what you keep",
        "-" * 72,
        f"  days to resolution      {result.days_to_resolution:>10.0f}",
        f"  ANNUALISED              {result.annualised * 100:>9.2f}%",
        f"  required                {result.hurdle * 100:>9.2f}%",
        "-" * 72,
        f"  VERDICT: {'TRADEABLE' if result.tradeable else 'NO EDGE'} - {result.reason}",
        "",
        "  Resolution risk is an ASSUMPTION, not a measurement. The verdict",
        "  pivots on it - set it from markets you have actually watched settle.",
        "=" * 72,
    ])


DEMO = [
    ("Binary, resolves in 9 days",        [0.483, 0.489],          9),
    ("Binary, resolves in 240 days",      [0.470, 0.505],        240),
    ("Binary, tight - looks free",        [0.497, 0.496],         30),
    ("Four-way election, 45 days",        [0.41, 0.33, 0.14, 0.09], 45),
    ("No edge at all",                    [0.52, 0.49],           30),
]


def build_parser():
    """:return: configured ArgumentParser."""
    p = argparse.ArgumentParser(
        prog="arbitrage.prediction",
        description="Screen prediction-market sum-identity arbitrage, net of fees and resolution risk.",
    )
    p.add_argument("--demo", action="store_true", help="screen synthetic markets, no network")
    p.add_argument("--manual", nargs="+", type=float, metavar="PRICE",
                   help="leg prices; pair with --days")
    p.add_argument("--days", type=float, help="days to resolution for --manual")
    p.add_argument("--name", default="manual", help="market name for the report")
    p.add_argument("--table", action="store_true", help="print break-even costs by horizon")
    p.add_argument("--fee", type=float, default=DEFAULT_FEE, help="total fee as a fraction")
    p.add_argument("--oracle-risk", type=float, default=DEFAULT_ORACLE_RISK,
                   help="assumed share of resolutions paying nothing")
    p.add_argument("--hurdle", type=float, default=0.04, help="risk-free rate to beat")
    p.add_argument("--risk-premium", type=float, default=0.03, help="extra return demanded")
    p.add_argument("--log", action="store_true", help="append results to the prediction log")
    p.add_argument("--path", default=None, help="log file (default ~/.arbitrage/prediction.jsonl)")
    return p


def main(argv=None):
    """
    Screen synthetic or hand-entered markets and print the verdict.

    :param argv: argument list, defaults to sys.argv[1:].
    :return: process exit code.
    """
    args = build_parser().parse_args(argv)
    path = args.path or store.default_path("prediction")
    kw = dict(fee=args.fee, oracle_risk=args.oracle_risk,
              hurdle=args.hurdle, risk_premium=args.risk_premium)

    if args.table:
        print(f"Highest total leg price worth paying "
              f"(fee {args.fee*100:.2f}%, resolution risk {args.oracle_risk*100:.1f}%):\n")
        print(f"{'RESOLVES IN':<16}{'MAX SUM':>10}{'MIN EDGE':>11}")
        print("-" * 37)
        for label, d in [("7 days",7),("30 days",30),("90 days",90),
                         ("180 days",180),("1 year",365),("2 years",730)]:
            be = break_even_cost(d, args.oracle_risk, args.fee,
                                 args.hurdle, args.risk_premium)
            print(f"{label:<16}{be:>10.4f}{(1-be)*100:>10.2f}%")
        return 0

    if args.manual:
        if args.days is None:
            print("[error] --manual also needs --days", file=sys.stderr)
            return 2
        try:
            res = assess(args.name, args.manual, args.days, **kw)
        except ValueError as exc:
            print(f"[error] {exc}", file=sys.stderr)
            return 2
        print(format_report(res))
        if args.log:
            store.append(path, res.as_dict())
            print(f"\nlogged -> {path}")
        return 0

    if args.demo:
        print("[demo mode] synthetic markets - not live prices\n")
        print(f"{'MARKET':<32}{'SUM':>8}{'GROSS':>8}{'DAYS':>6}{'ANN.':>9}  VERDICT")
        print("-" * 78)
        for name, legs, days in DEMO:
            r = assess(name, legs, days, **kw)
            print(f"{name:<32}{sum(legs):>8.3f}{r.gross_edge*100:>7.2f}%"
                  f"{days:>6.0f}{r.annualised*100:>8.1f}%  "
                  f"{'TRADE' if r.tradeable else 'no'}")
        print("\n" + format_report(assess(*DEMO[0][:2], DEMO[0][2], **kw)))
        return 0

    build_parser().print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
