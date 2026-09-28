"""
Pairs / statistical-arbitrage screening for instruments on an MT5 account.

Buy one instrument, sell a hedge-ratio multiple of another, and bet the spread
between them reverts. Unlike cash-and-carry this is NOT arbitrage: nothing
forces convergence, so a diverging spread can stay diverged until it takes the
account with it. It earns its place on this list only because it is
latency-tolerant, holds for days rather than milliseconds, and runs on broker
plumbing that already exists in mt5_lib.py.

IMPORTANT -- what this module does and does not establish:

    It measures correlation, an OLS hedge ratio, the spread's z-score, and a
    mean-reversion half-life from an AR(1) fit. Together those are *evidence*
    that a spread behaves stationary over the sample.

    They are NOT a cointegration test. There is no ADF statistic and no
    Johansen procedure here, because neither is implementable in the standard
    library at the precision they require. Before trading anything this module
    likes, re-test it with statsmodels' adfuller or coint. A pair that passes
    here and fails there is a pair that will lose money.

Stdlib only.
"""

import argparse
import csv
import math
import statistics
import sys
from dataclasses import asdict, dataclass

from . import store

#: A spread that takes longer than this to revert ties up capital for too long
#: to be worth the divergence risk at retail size.
MAX_HALF_LIFE_DAYS = 30.0

#: Below this absolute correlation the two series are not tracking each other
#: closely enough for the spread to mean anything.
MIN_CORRELATION = 0.80

#: Entry threshold in standard deviations. The expected capture on reversion is
#: roughly this many sigma, which is what must out-earn the round trip.
DEFAULT_ENTRY_Z = 2.0


@dataclass
class PairStats:
    """Fitted description of one candidate pair."""

    symbol_a: str
    symbol_b: str
    observations: int
    correlation: float
    beta: float
    alpha: float
    spread_mean: float
    spread_stdev: float
    current_spread: float
    current_z: float
    half_life: float
    notional: float
    edge_per_trade: float
    cost_per_trade: float
    net_per_trade: float
    tradeable: bool
    reason: str

    def as_dict(self):
        """:return: dataclass contents as a plain dict."""
        return asdict(self)


def correlation(xs, ys):
    """
    Pearson correlation between two equal-length series.

    :param xs: first series.
    :param ys: second series.
    :return: correlation in [-1, 1]; 0.0 when either series has no variance.
    :raises ValueError: if the series differ in length or hold under 2 points.
    """
    if len(xs) != len(ys):
        raise ValueError("series must be the same length")
    if len(xs) < 2:
        raise ValueError("need at least two observations")
    try:
        return statistics.correlation(xs, ys)
    except statistics.StatisticsError:
        return 0.0


def ols_beta(xs, ys):
    """
    Least-squares fit of ys against xs: ys ~ alpha + beta * xs.

    Beta is the hedge ratio -- how many units of the second instrument offset
    one unit of the first.

    :param xs: independent series.
    :param ys: dependent series.
    :return: tuple of (beta, alpha).
    :raises ValueError: on mismatched lengths, too few points, or zero variance.
    """
    if len(xs) != len(ys):
        raise ValueError("series must be the same length")
    n = len(xs)
    if n < 2:
        raise ValueError("need at least two observations")
    mx, my = statistics.fmean(xs), statistics.fmean(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx == 0:
        raise ValueError("independent series has zero variance")
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    beta = sxy / sxx
    return beta, my - beta * mx


def spread_series(xs, ys, beta, alpha):
    """
    Residual spread of the hedged pair: ys - (alpha + beta * xs).

    :param xs: independent series.
    :param ys: dependent series.
    :param beta: hedge ratio.
    :param alpha: intercept.
    :return: list of spread values.
    """
    return [y - (alpha + beta * x) for x, y in zip(xs, ys)]


def zscore(value, mean, stdev):
    """
    Standard deviations between a value and the mean.

    :param value: observation.
    :param mean: series mean.
    :param stdev: series standard deviation.
    :return: z-score; 0.0 when stdev is zero.
    """
    return 0.0 if stdev == 0 else (value - mean) / stdev


def half_life(spread):
    """
    Mean-reversion half-life, in observations, from an AR(1) fit.

    Regresses the change in the spread on its previous level. A negative
    coefficient means the spread pulls back toward its mean; the half-life is
    how long that pull takes to close half the gap.

    :param spread: spread series.
    :return: half-life in observations, or math.inf when the series does not
        mean-revert (a non-negative coefficient means it wanders or trends).
    :raises ValueError: if fewer than three observations are supplied.
    """
    if len(spread) < 3:
        raise ValueError("need at least three observations")
    lagged = spread[:-1]
    deltas = [spread[i + 1] - spread[i] for i in range(len(spread) - 1)]
    try:
        lam, _ = ols_beta(lagged, deltas)
    except ValueError:
        return math.inf
    if lam >= 0 or lam <= -1:
        return math.inf
    return -math.log(2) / math.log(1 + lam)


def assess_pair(symbol_a, symbol_b, series_a, series_b, round_trip_cost,
                entry_z=DEFAULT_ENTRY_Z, min_correlation=MIN_CORRELATION,
                max_half_life=MAX_HALF_LIFE_DAYS):
    """
    Fit a pair and decide whether its spread is worth trading after costs.

    Four gates, applied in order of how cheaply they can be checked. Weak
    correlation means the spread is not really a spread. A non-reverting or
    slow-reverting spread ties up capital indefinitely. And the expected
    capture -- roughly entry_z standard deviations -- must beat a round trip on
    *both* legs, which is where most retail pairs ideas quietly die.

    :param symbol_a: name of the first instrument.
    :param symbol_b: name of the second instrument.
    :param series_a: price history of the first, oldest first.
    :param series_b: price history of the second, aligned with series_a.
    :param round_trip_cost: cost of one in-and-out on ONE leg, as a fraction.
    :param entry_z: entry threshold in standard deviations.
    :param min_correlation: minimum absolute correlation to proceed.
    :param max_half_life: slowest acceptable reversion, in observations.
    :return: PairStats.
    :raises ValueError: if the series are mismatched or too short.
    """
    if len(series_a) != len(series_b):
        raise ValueError("series must be the same length")
    if len(series_a) < 30:
        raise ValueError("need at least 30 observations to fit a pair")

    corr = correlation(series_a, series_b)
    beta, alpha = ols_beta(series_a, series_b)
    spread = spread_series(series_a, series_b, beta, alpha)
    mean = statistics.fmean(spread)
    stdev = statistics.pstdev(spread)
    current = spread[-1]
    hl = half_life(spread)

    # One unit of A hedged with beta units of B; both legs pay costs.
    notional = abs(series_a[-1]) + abs(beta) * abs(series_b[-1])
    edge = (entry_z * stdev / notional) if notional else 0.0
    cost = 2.0 * round_trip_cost
    net = edge - cost

    if abs(corr) < min_correlation:
        tradeable, reason = False, (
            f"correlation {corr:.2f} below {min_correlation:.2f} - not tracking"
        )
    elif hl is math.inf or hl == math.inf:
        tradeable, reason = False, "spread does not mean-revert; it wanders or trends"
    elif hl > max_half_life:
        tradeable, reason = False, (
            f"half-life {hl:.1f} obs exceeds {max_half_life:.0f} - capital tied up too long"
        )
    elif net <= 0:
        tradeable, reason = False, (
            f"expected capture {edge * 100:.3f}% does not cover "
            f"{cost * 100:.3f}% of two-leg costs"
        )
    else:
        tradeable, reason = True, (
            f"clears two-leg costs by {net * 100:.3f}% per trade; "
            f"half-life {hl:.1f} obs"
        )

    return PairStats(
        symbol_a=symbol_a, symbol_b=symbol_b, observations=len(series_a),
        correlation=corr, beta=beta, alpha=alpha, spread_mean=mean,
        spread_stdev=stdev, current_spread=current,
        current_z=zscore(current, mean, stdev), half_life=hl,
        notional=notional, edge_per_trade=edge, cost_per_trade=cost,
        net_per_trade=net, tradeable=tradeable, reason=reason,
    )


def load_csv(path, column):
    """
    Read one price column out of a CSV exported from MT5 or any other source.

    :param path: CSV file with a header row.
    :param column: name of the column holding prices.
    :return: list of floats, file order preserved.
    :raises ValueError: if the column is absent or holds no usable numbers.
    """
    values = []
    with open(path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None or column not in reader.fieldnames:
            raise ValueError(f"{path} has no column named {column!r}")
        for row in reader:
            try:
                values.append(float(row[column]))
            except (TypeError, ValueError):
                continue
    if not values:
        raise ValueError(f"{path} column {column!r} held no numeric values")
    return values


def format_report(stats):
    """
    Render a pair assessment as plain text.

    :param stats: PairStats to render.
    :return: formatted multi-line string.
    """
    hl = "never" if stats.half_life == math.inf else f"{stats.half_life:.1f} obs"
    return "\n".join([
        "=" * 70,
        f"  PAIRS SCREEN - {stats.symbol_a} vs {stats.symbol_b}",
        "=" * 70,
        f"  observations       {stats.observations:>10}",
        f"  correlation        {stats.correlation:>10.3f}",
        f"  hedge ratio (beta) {stats.beta:>10.4f}   <- units of B per unit of A",
        f"  half-life          {hl:>10}",
        "-" * 70,
        f"  spread mean        {stats.spread_mean:>10.4f}",
        f"  spread stdev       {stats.spread_stdev:>10.4f}",
        f"  current spread     {stats.current_spread:>10.4f}",
        f"  current z-score    {stats.current_z:>10.2f}"
        f"   {'<- AT ENTRY THRESHOLD' if abs(stats.current_z) >= DEFAULT_ENTRY_Z else ''}",
        "-" * 70,
        f"  expected capture   {stats.edge_per_trade * 100:>9.3f}%   ({DEFAULT_ENTRY_Z} sigma)",
        f"  two-leg costs      {stats.cost_per_trade * 100:>9.3f}%",
        f"  net per trade      {stats.net_per_trade * 100:>9.3f}%",
        "-" * 70,
        f"  VERDICT: {'TRADEABLE' if stats.tradeable else 'NO EDGE'} - {stats.reason}",
        "",
        "  NOT a cointegration test. Re-check with statsmodels adfuller/coint",
        "  before risking capital on this pair.",
        "=" * 70,
    ])


def _synthetic_pair(n=180, seed=7):
    """
    Build a deterministic cointegrated pair for offline demonstration.

    :param n: number of observations.
    :param seed: PRNG seed, fixed so the demo is reproducible.
    :return: tuple of (series_a, series_b).
    """
    import random
    rng = random.Random(seed)
    a, b, resid = [100.0], [], 0.0
    for _ in range(n - 1):
        a.append(a[-1] * (1 + rng.gauss(0, 0.01)))
    for price in a:
        resid = 0.85 * resid + rng.gauss(0, 0.35)   # stationary AR(1) residual
        b.append(2.0 * price + 5.0 + resid)
    return a, b


def build_parser():
    """:return: configured ArgumentParser."""
    parser = argparse.ArgumentParser(
        prog="arbitrage.pairs",
        description="Screen an instrument pair for cost-aware mean reversion.",
    )
    parser.add_argument("--demo", action="store_true", help="screen a synthetic pair, no data needed")
    parser.add_argument("--csv", nargs=2, metavar=("FILE_A", "FILE_B"), help="two CSV exports")
    parser.add_argument("--column", default="close", help="price column name (default: close)")
    parser.add_argument("--names", nargs=2, metavar=("A", "B"), default=["A", "B"], help="symbol names")
    parser.add_argument("--cost", type=float, default=0.0005,
                        help="round-trip cost on ONE leg, as a fraction (default 0.05%%)")
    parser.add_argument("--entry-z", type=float, default=DEFAULT_ENTRY_Z, help="entry threshold in sigma")
    parser.add_argument("--log", action="store_true", help="append the screen result to the pairs log")
    parser.add_argument("--path", default=None, help="log file (default ~/.arbitrage/pairs.jsonl)")
    return parser


def main(argv=None):
    """
    Screen a pair from synthetic or CSV data and print the report.

    :param argv: argument list, defaults to sys.argv[1:].
    :return: process exit code.
    """
    args = build_parser().parse_args(argv)
    path = args.path or store.default_path("pairs")

    if args.demo:
        series_a, series_b = _synthetic_pair()
        names = ("SYNTH_A", "SYNTH_B")
        print("[demo mode] synthetic cointegrated pair - not market data\n")
    elif args.csv:
        try:
            series_a = load_csv(args.csv[0], args.column)
            series_b = load_csv(args.csv[1], args.column)
        except (OSError, ValueError) as exc:
            print(f"[error] {exc}", file=sys.stderr)
            return 2
        n = min(len(series_a), len(series_b))
        series_a, series_b = series_a[-n:], series_b[-n:]
        names = tuple(args.names)
    else:
        build_parser().print_help()
        return 0

    try:
        stats = assess_pair(names[0], names[1], series_a, series_b,
                            round_trip_cost=args.cost, entry_z=args.entry_z)
    except ValueError as exc:
        print(f"[error] {exc}", file=sys.stderr)
        return 2

    print(format_report(stats))
    if args.log:
        store.append(path, stats.as_dict())
        print(f"\nlogged -> {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
