"""
Local-premium monitor: is Malaysian BTC persistently dearer than global BTC?

    premium = (BTC/MYR local) / (BTC/USD global x USD/MYR) - 1

A positive premium means the local market pays above the globally-converted
price. Emerging markets with capital controls and fragmented local venues often
show one; Korea's is the famous case. Whether Malaysia's is real, large enough
to survive fees, and *persistent* is an empirical question -- which is why this
module logs rather than merely computes.

The stance is the scanner's: one wide reading proves nothing. A premium is
tradeable only if it clears fees on most observations, not on its best one.
Stdlib only.
"""

import argparse
import json
import statistics
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass

from . import store

TIMEOUT = 15
USER_AGENT = "local-premium-monitor/1.0"

#: Fraction of observations that must clear costs before a premium counts as
#: persistent. Below this it is noise you would be chasing, not an edge.
MIN_PERSISTENCE = 0.70


class FeedError(RuntimeError):
    """Raised when a price source cannot be reached or returns unusable data."""


@dataclass
class Reading:
    """One observation of the local premium."""

    local_myr: float
    global_usd: float
    usd_myr: float
    premium: float

    def as_dict(self):
        """:return: dataclass contents as a plain dict."""
        return asdict(self)


def local_premium(local_myr, global_usd, usd_myr):
    """
    Premium of the local MYR price over the globally-converted price.

    :param local_myr: BTC price in MYR on a Malaysian exchange.
    :param global_usd: BTC price in USD on a global venue.
    :param usd_myr: MYR per USD.
    :return: premium as a decimal fraction; 0.02 is a 2% local premium.
    :raises ValueError: if any input is not positive.
    """
    if local_myr <= 0 or global_usd <= 0 or usd_myr <= 0:
        raise ValueError("all three prices must be positive")
    return local_myr / (global_usd * usd_myr) - 1.0


def reading(local_myr, global_usd, usd_myr):
    """
    Build a Reading, computing the premium from the three inputs.

    :param local_myr: BTC price in MYR.
    :param global_usd: BTC price in USD.
    :param usd_myr: MYR per USD.
    :return: Reading.
    """
    return Reading(local_myr, global_usd, usd_myr,
                   local_premium(local_myr, global_usd, usd_myr))


def round_trip_cost(buy_fee, sell_fee, transfer_fee=0.0005):
    """
    Cost of capturing a premium once: buy one side, sell the other, move funds.

    :param buy_fee: taker fee on the buying venue, decimal fraction.
    :param sell_fee: taker fee on the selling venue.
    :param transfer_fee: withdrawal/transfer cost as a fraction of notional.
    :return: total cost as a decimal fraction of notional.
    """
    return buy_fee + sell_fee + transfer_fee


def assess(premiums, cost, min_persistence=MIN_PERSISTENCE):
    """
    Decide whether a series of premiums represents a tradeable edge.

    Two gates, and both must pass. The median must clear cost -- using the
    median, not the mean, so a single spike cannot carry the result. And the
    *share* of observations clearing cost must reach min_persistence, because an
    edge present a third of the time is not something you can plan around.

    :param premiums: iterable of premium fractions.
    :param cost: round-trip cost as a decimal fraction.
    :param min_persistence: required share of observations clearing cost.
    :return: dict describing the distribution and the verdict.
    :raises ValueError: if premiums is empty.
    """
    values = [abs(p) for p in premiums]
    if not values:
        raise ValueError("no readings to assess")

    clearing = [v for v in values if v > cost]
    persistence = len(clearing) / len(values)
    median = statistics.median(values)
    net_median = median - cost

    if median <= cost:
        tradeable, reason = False, "median premium does not clear round-trip cost"
    elif persistence < min_persistence:
        tradeable, reason = False, (
            f"clears cost only {persistence * 100:.0f}% of the time "
            f"(need {min_persistence * 100:.0f}%) - intermittent, not an edge"
        )
    else:
        tradeable, reason = True, (
            f"median clears cost by {net_median * 100:.2f}% "
            f"on {persistence * 100:.0f}% of observations"
        )

    return {
        "observations": len(values),
        "mean": statistics.fmean(values),
        "median": median,
        "stdev": statistics.pstdev(values) if len(values) > 1 else 0.0,
        "minimum": min(values),
        "maximum": max(values),
        "cost": cost,
        "net_median": net_median,
        "persistence": persistence,
        "tradeable": tradeable,
        "reason": reason,
    }


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


def fetch_luno(pair="XBTMYR"):
    """
    Last-traded price from Luno's public ticker.

    Luno is SC-registered in Malaysia, so this is a venue a Malaysian resident
    can legally trade on -- which is the whole point of measuring it.

    :param pair: Luno pair code, e.g. "XBTMYR".
    :return: last trade price as a float.
    :raises FeedError: if the feed is unreachable or lacks a price.
    """
    payload = _get(f"https://api.luno.com/api/1/ticker?pair={pair}")
    price = payload.get("last_trade")
    if price is None:
        raise FeedError(f"luno returned no last_trade for {pair}")
    return float(price)


def fetch_fx(base="USD", quote="MYR"):
    """
    Reference FX rate from a public endpoint.

    This is an indicative mid, not the rate your bank gives you. Real
    conversion costs sit in `transfer_fee`, not here.

    :param base: base currency code.
    :param quote: quote currency code.
    :return: units of quote per base.
    :raises FeedError: if the feed is unreachable or lacks the rate.
    """
    payload = _get(f"https://api.frankfurter.app/latest?from={base}&to={quote}")
    rate = (payload.get("rates") or {}).get(quote)
    if rate is None:
        raise FeedError(f"fx feed returned no {base}/{quote} rate")
    return float(rate)


def format_report(stats, log_summary=None):
    """
    Render an assessment as plain text.

    :param stats: dict returned by assess().
    :param log_summary: optional dict from store.summary().
    :return: formatted multi-line string.
    """
    lines = [
        "=" * 70,
        "  MALAYSIAN LOCAL PREMIUM - PERSISTENCE REPORT",
        "=" * 70,
    ]
    if log_summary:
        lines += [
            f"  log        {log_summary['path']}",
            f"  span       {log_summary['first']}  ->  {log_summary['last']}",
        ]
    lines += [
        f"  readings   {stats['observations']}",
        "-" * 70,
        f"  median premium     {stats['median'] * 100:>8.3f}%   <- the number that decides it",
        f"  mean               {stats['mean'] * 100:>8.3f}%",
        f"  range              {stats['minimum'] * 100:>8.3f}%  to {stats['maximum'] * 100:.3f}%",
        f"  std deviation      {stats['stdev'] * 100:>8.3f}%",
        "-" * 70,
        f"  round-trip cost    {stats['cost'] * 100:>8.3f}%",
        f"  median net of cost {stats['net_median'] * 100:>8.3f}%",
        f"  clears cost on     {stats['persistence'] * 100:>8.0f}% of readings",
        "-" * 70,
        f"  VERDICT: {'TRADEABLE' if stats['tradeable'] else 'NO EDGE'} - {stats['reason']}",
        "=" * 70,
    ]
    return "\n".join(lines)


def build_parser():
    """:return: configured ArgumentParser."""
    parser = argparse.ArgumentParser(
        prog="arbitrage.premium",
        description="Log and assess the Malaysian BTC local premium.",
    )
    parser.add_argument("--log", action="store_true", help="fetch live prices and append a reading")
    parser.add_argument("--manual", nargs=3, type=float, metavar=("LOCAL_MYR", "GLOBAL_USD", "USD_MYR"),
                        help="append a reading from three hand-typed prices")
    parser.add_argument("--report", action="store_true", help="assess the logged history")
    parser.add_argument("--demo", action="store_true", help="assess synthetic readings, no network")
    parser.add_argument("--buy-fee", type=float, default=0.002, help="taker fee on the buy venue")
    parser.add_argument("--sell-fee", type=float, default=0.002, help="taker fee on the sell venue")
    parser.add_argument("--transfer-fee", type=float, default=0.0005, help="transfer cost as a fraction")
    parser.add_argument("--path", default=None, help="log file (default ~/.arbitrage/premium.jsonl)")
    return parser


def main(argv=None):
    """
    Log a reading or report on history.

    :param argv: argument list, defaults to sys.argv[1:].
    :return: process exit code.
    """
    args = build_parser().parse_args(argv)
    path = args.path or store.default_path("premium")
    cost = round_trip_cost(args.buy_fee, args.sell_fee, args.transfer_fee)

    if args.demo:
        # Illustrative only: a modest premium that clears cost most days.
        synthetic = [0.0121, 0.0098, 0.0143, 0.0087, 0.0156, 0.0112,
                     0.0034, 0.0129, 0.0105, 0.0167, 0.0091, 0.0118]
        print("[demo mode] synthetic readings - not market data\n")
        print(format_report(assess(synthetic, cost)))
        return 0

    if args.manual:
        rec = reading(*args.manual)
        store.append(path, rec.as_dict())
        print(f"logged premium {rec.premium * 100:+.3f}%  ->  {path}")
        return 0

    if args.log:
        try:
            local = fetch_luno()
            fx = fetch_fx()
        except FeedError as exc:
            print(f"[error] {exc}", file=sys.stderr)
            print("A feed failure is not a zero premium. Nothing was logged.", file=sys.stderr)
            return 1
        print("[error] no global USD price source configured; use --manual",
              file=sys.stderr)
        print(f"        luno XBTMYR = {local:,.2f}   USD/MYR = {fx:.4f}", file=sys.stderr)
        return 1

    if args.report:
        records = store.load(path)
        if not records:
            print(f"No readings logged yet at {path}.", file=sys.stderr)
            print("Add one with --manual LOCAL_MYR GLOBAL_USD USD_MYR", file=sys.stderr)
            return 1
        premiums = [r["premium"] for r in records if "premium" in r]
        print(format_report(assess(premiums, cost), store.summary(path)))
        return 0

    build_parser().print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
