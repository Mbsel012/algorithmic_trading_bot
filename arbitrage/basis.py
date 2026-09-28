"""
Cash-and-carry basis mathematics.

The trade: buy spot, sell the dated future, hold to expiry.

At expiry the future settles to spot by contract specification, so the payoff is
locked at entry. What is *not* locked is the path: the short futures leg can be
liquidated before expiry if the underlying rallies far enough, which is the
dominant real-world failure mode for this trade.

Everything here is pure arithmetic on floats -- no network, no dependencies --
so it can be unit tested exhaustively.
"""

from dataclasses import dataclass, asdict

DAYS_PER_YEAR = 365.0


@dataclass
class BasisQuote:
    """A single spot/future pair observed at one venue for one expiry."""

    venue: str
    symbol: str
    spot: float
    future: float
    days_to_expiry: float


@dataclass
class BasisResult:
    """Fully costed assessment of one cash-and-carry opportunity."""

    venue: str
    symbol: str
    spot: float
    future: float
    days_to_expiry: float
    gross_basis: float          # (F - S) / S, decimal fraction
    annualised_gross: float     # decimal fraction per year
    fee_cost: float             # round-trip fees, decimal fraction of notional
    net_basis: float            # gross basis after fees
    annualised_net: float       # decimal fraction per year
    hurdle: float               # risk-free rate, decimal fraction per year
    edge: float                 # annualised_net - hurdle
    tradeable: bool             # edge clears the required risk premium
    reason: str                 # human-readable verdict

    def as_dict(self):
        """:return: dataclass contents as a plain dict."""
        return asdict(self)


def gross_basis(spot, future):
    """
    Raw proportional premium of the future over spot.

    :param spot: spot price, must be > 0.
    :param future: dated future price.
    :return: (future - spot) / spot as a decimal fraction.
    :raises ValueError: if spot is not positive.
    """
    if spot <= 0:
        raise ValueError("spot price must be positive")
    return (future - spot) / spot


def annualise(basis_fraction, days_to_expiry):
    """
    Scale a period return to an annual rate using simple (not compound) scaling.

    Simple scaling is the market convention for quoting basis and is the
    conservative choice for short tenors.

    :param basis_fraction: return over the holding period, decimal fraction.
    :param days_to_expiry: days until settlement, must be > 0.
    :return: annualised decimal fraction.
    :raises ValueError: if days_to_expiry is not positive.
    """
    if days_to_expiry <= 0:
        raise ValueError("days_to_expiry must be positive")
    return basis_fraction * (DAYS_PER_YEAR / days_to_expiry)


def liquidation_move(margin_ratio, maintenance_margin):
    """
    Approximate the adverse price move the short futures leg can absorb.

    The short leg loses as price rises. Once posted collateral is eaten down to
    the maintenance requirement, the position is liquidated -- even though the
    spot leg holds an offsetting unrealised gain. That asymmetry is what turns a
    "riskless" arbitrage into a realised loss.

    :param margin_ratio: collateral posted divided by futures notional. 0.5 is
        2x leverage, 0.2 is 5x.
    :param maintenance_margin: venue maintenance margin rate.
    :return: upward price move, as a decimal fraction, that triggers liquidation.
    """
    return max(0.0, margin_ratio - maintenance_margin)


def evaluate(quote, fee_cost, hurdle=0.04, risk_premium=0.03, close_early=False):
    """
    Cost a single cash-and-carry opportunity and decide whether it clears.

    A positive basis is required: the future must trade above spot for the trade
    to earn anything. Backwardation (future below spot) is reported as untradeable
    in this direction -- the reverse trade needs borrowable spot and is a
    materially different risk profile.

    :param quote: BasisQuote to assess.
    :param fee_cost: round-trip fee cost as a decimal fraction of notional.
    :param hurdle: risk-free rate to beat, decimal fraction per year.
    :param risk_premium: extra annualised return demanded as compensation for
        counterparty and liquidation risk.
    :param close_early: recorded for reporting only; fee_cost should already
        reflect this choice.
    :return: BasisResult.
    """
    raw = gross_basis(quote.spot, quote.future)
    ann_gross = annualise(raw, quote.days_to_expiry)
    net = raw - fee_cost
    ann_net = annualise(net, quote.days_to_expiry)
    edge = ann_net - hurdle

    if raw <= 0:
        tradeable, reason = False, "backwardation - future is at or below spot"
    elif net <= 0:
        tradeable, reason = False, "fees exceed the entire gross basis"
    elif edge <= 0:
        tradeable, reason = False, "net return does not beat the risk-free rate"
    elif edge < risk_premium:
        tradeable, reason = False, (
            f"edge {edge * 100:.2f}% below required {risk_premium * 100:.2f}% risk premium"
        )
    else:
        tradeable, reason = True, f"clears hurdle and risk premium by {(edge - risk_premium) * 100:.2f}%"

    return BasisResult(
        venue=quote.venue,
        symbol=quote.symbol,
        spot=quote.spot,
        future=quote.future,
        days_to_expiry=quote.days_to_expiry,
        gross_basis=raw,
        annualised_gross=ann_gross,
        fee_cost=fee_cost,
        net_basis=net,
        annualised_net=ann_net,
        hurdle=hurdle,
        edge=edge,
        tradeable=tradeable,
        reason=reason,
    )


def expected_profit(result, capital, margin_ratio=0.5):
    """
    Translate a net basis into money, on the capital actually committed.

    The distinction matters. The basis is earned on *notional*, but collateral
    posted against the short futures leg earns nothing while it sits there. So
    return on capital is always lower than the headline basis, by a factor of
    (1 + margin_ratio). At 2x that is a third of the return given up to margin.

    :param result: BasisResult under consideration.
    :param capital: total capital committed to both legs.
    :param margin_ratio: collateral posted per unit of futures notional.
    :return: dict of notional, absolute profit, and returns on capital.
    """
    notional, _, _ = position_size(capital, margin_ratio)
    profit = notional * result.net_basis
    return_on_capital = profit / capital if capital else 0.0
    return {
        "notional": notional,
        "profit_at_expiry": profit,
        "return_on_capital": return_on_capital,
        "annualised_on_capital": annualise(return_on_capital, result.days_to_expiry),
        "collateral_drag": result.annualised_net - annualise(return_on_capital, result.days_to_expiry),
    }


def position_size(capital, margin_ratio):
    """
    Split capital between the spot leg and the futures margin.

    Spot is bought outright; the short future needs collateral equal to
    margin_ratio of the same notional. So each unit of notional consumes
    (1 + margin_ratio) of capital.

    :param capital: total capital available.
    :param margin_ratio: collateral posted per unit of futures notional.
    :return: tuple of (notional, spot_outlay, futures_collateral).
    :raises ValueError: if capital is negative or margin_ratio is not positive.
    """
    if capital < 0:
        raise ValueError("capital must not be negative")
    if margin_ratio <= 0:
        raise ValueError("margin_ratio must be positive")
    notional = capital / (1.0 + margin_ratio)
    return notional, notional, notional * margin_ratio
