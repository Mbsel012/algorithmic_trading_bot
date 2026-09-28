"""
Command-line entry point for the basis scanner.

    python -m arbitrage.cli --demo             # synthetic quotes, no network
    python -m arbitrage.cli --base BTC         # live public market data
    python -m arbitrage.cli --clock            # timing report only

No API keys are needed and no orders are ever placed.
"""

import argparse
import sys

from .basis import BasisQuote
from .scanner import format_report, report
from .sessions import clock_report
from .venues import fetch_all

# Illustrative quotes for offline demonstration. NOT market data.
DEMO_QUOTES = [
    BasisQuote("binance", "BTCUSDT_260925", 100_000.0, 100_450.0, 11.0),
    BasisQuote("binance", "BTCUSDT_261226", 100_000.0, 103_100.0, 103.0),
    BasisQuote("okx", "BTC-USDT-260925", 100_000.0, 100_180.0, 11.0),
    BasisQuote("okx", "BTC-USDT-261226", 100_000.0, 102_050.0, 103.0),
    BasisQuote("okx", "BTC-USDT-270326", 100_000.0, 99_400.0, 193.0),
]


def parse_manual(spec):
    """
    Parse a hand-typed quote of the form VENUE:LABEL:SPOT:FUTURE:DAYS.

    Lets you cost a trade from prices read off any exchange screen, with no API
    access at all.

    :param spec: colon-delimited specification string.
    :return: BasisQuote.
    :raises ValueError: if the spec is malformed or the numbers are unusable.
    """
    parts = spec.split(":")
    if len(parts) != 5:
        raise ValueError(f"expected VENUE:LABEL:SPOT:FUTURE:DAYS, got {spec!r}")
    venue, label, spot, future, days = parts
    try:
        spot, future, days = float(spot), float(future), float(days)
    except ValueError:
        raise ValueError(f"spot, future and days must be numbers in {spec!r}") from None
    if spot <= 0:
        raise ValueError(f"spot must be positive in {spec!r}")
    if days <= 0:
        raise ValueError(f"days must be positive in {spec!r}")
    return BasisQuote(venue.strip().lower(), label.strip(), spot, future, days)


def build_parser():
    """:return: configured ArgumentParser."""
    parser = argparse.ArgumentParser(
        prog="arbitrage.cli",
        description="Scan dated-futures cash-and-carry basis, net of fees.",
    )
    parser.add_argument("--base", default="BTC", help="base asset (default BTC)")
    parser.add_argument("--quote", default="USDT", help="quote asset (default USDT)")
    parser.add_argument("--venues", nargs="*", default=None, help="venues to scan")
    parser.add_argument("--capital", type=float, default=10_000.0, help="capital to size against")
    parser.add_argument("--hurdle", type=float, default=0.04, help="risk-free rate, e.g. 0.04")
    parser.add_argument("--risk-premium", type=float, default=0.03,
                        help="extra annualised return demanded for venue risk")
    parser.add_argument("--margin-ratio", type=float, default=0.5,
                        help="collateral per unit of futures notional (0.5 == 2x)")
    parser.add_argument("--close-early", action="store_true",
                        help="model trading out of the future instead of settling")
    parser.add_argument("--demo", action="store_true", help="use synthetic quotes, no network")
    parser.add_argument("--manual", action="append", metavar="SPEC", default=None,
                        help="quote typed by hand, no network needed. Repeatable. "
                             "Format VENUE:LABEL:SPOT:FUTURE:DAYS  e.g. "
                             "binance:BTC-DEC:100000:103100:103")
    parser.add_argument("--clock", action="store_true", help="print the timing report and exit")
    return parser


def main(argv=None):
    """
    Run a scan and print the report.

    :param argv: argument list, defaults to sys.argv[1:].
    :return: process exit code.
    """
    args = build_parser().parse_args(argv)

    if args.clock:
        for key, value in clock_report().items():
            print(f"{key:>24}  {value}")
        return 0

    if args.manual:
        try:
            quotes = [parse_manual(spec) for spec in args.manual]
        except ValueError as exc:
            print(f"bad --manual spec: {exc}", file=sys.stderr)
            return 2
        errors = {}
    elif args.demo:
        quotes, errors = DEMO_QUOTES, {}
        print("[demo mode] synthetic quotes - not market data\n")
    else:
        quotes, errors = fetch_all(base=args.base, quote=args.quote, venues=args.venues)

    for venue, message in errors.items():
        print(f"[warn] {venue}: {message}", file=sys.stderr)

    if not quotes:
        print("No quotes retrieved. This is a data failure, not an absence of "
              "opportunity - do not read it as a signal.", file=sys.stderr)
        return 1

    print(format_report(report(
        quotes,
        capital=args.capital,
        hurdle=args.hurdle,
        risk_premium=args.risk_premium,
        margin_ratio=args.margin_ratio,
        close_early=args.close_early,
    )))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
