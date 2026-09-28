"""
Public REST adapters for spot and dated-futures prices.

Only public market-data endpoints are used, so no API keys are required to run a
scan. Nothing here places orders.

Each adapter returns a list of BasisQuote. Network failures raise VenueError
rather than returning partial data -- a silently truncated scan is worse than no
scan, because it looks like an absence of opportunity.
"""

import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone

from .basis import BasisQuote

TIMEOUT = 15
USER_AGENT = "basis-arb-scanner/1.0"

# Binance and OKX both encode expiry in the instrument name as YYMMDD.
_BINANCE_DATED = re.compile(r"^(?P<base>[A-Z0-9]+)_(?P<expiry>\d{6})$")
_OKX_DATED = re.compile(r"^(?P<base>[A-Z0-9]+-[A-Z0-9]+)-(?P<expiry>\d{6})$")


class VenueError(RuntimeError):
    """Raised when a venue cannot be reached or returns unusable data."""


def _get(url):
    """
    Fetch and decode a JSON document over HTTPS.

    :param url: absolute URL.
    :return: decoded JSON.
    :raises VenueError: on any transport or decoding failure.
    """
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
        raise VenueError(f"could not reach {url}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise VenueError(f"malformed JSON from {url}: {exc}") from exc


def _days_until(expiry_yymmdd, now=None, hour=8):
    """
    Convert a YYMMDD expiry code into days remaining.

    :param expiry_yymmdd: six-character expiry code, e.g. "260925".
    :param now: reference instant, defaults to now in UTC.
    :param hour: settlement hour in UTC.
    :return: float days remaining, or None if the code cannot be parsed.
    """
    now = now or datetime.now(timezone.utc)
    try:
        expiry = datetime(
            2000 + int(expiry_yymmdd[0:2]),
            int(expiry_yymmdd[2:4]),
            int(expiry_yymmdd[4:6]),
            hour,
            tzinfo=timezone.utc,
        )
    except ValueError:
        return None
    days = (expiry - now).total_seconds() / 86400.0
    return days if days > 0 else None


def fetch_binance(base="BTC", quote="USDT", now=None):
    """
    Spot and dated-futures prices from Binance USD-margined markets.

    :param base: base asset, e.g. "BTC".
    :param quote: quote asset, e.g. "USDT".
    :param now: reference instant, for deterministic testing.
    :return: list of BasisQuote, one per dated contract.
    :raises VenueError: if the venue is unreachable or the spot pair is missing.
    """
    pair = f"{base}{quote}".upper()
    spot_payload = _get(f"https://api.binance.com/api/v3/ticker/price?symbol={pair}")
    if "price" not in spot_payload:
        raise VenueError(f"binance returned no spot price for {pair}")
    spot = float(spot_payload["price"])

    quotes = []
    for row in _get("https://fapi.binance.com/fapi/v1/ticker/price"):
        match = _BINANCE_DATED.match(row.get("symbol", ""))
        if not match or match.group("base") != pair:
            continue
        days = _days_until(match.group("expiry"), now)
        if days is None:
            continue
        quotes.append(
            BasisQuote("binance", row["symbol"], spot, float(row["price"]), days)
        )
    return quotes


def fetch_okx(base="BTC", quote="USDT", now=None):
    """
    Spot and dated-futures prices from OKX.

    :param base: base asset, e.g. "BTC".
    :param quote: quote asset, e.g. "USDT".
    :param now: reference instant, for deterministic testing.
    :return: list of BasisQuote, one per dated contract.
    :raises VenueError: if the venue is unreachable or the spot pair is missing.
    """
    pair = f"{base}-{quote}".upper()
    spot_payload = _get(f"https://www.okx.com/api/v5/market/ticker?instId={pair}")
    rows = spot_payload.get("data") or []
    if not rows:
        raise VenueError(f"okx returned no spot price for {pair}")
    spot = float(rows[0]["last"])

    quotes = []
    for row in _get("https://www.okx.com/api/v5/market/tickers?instType=FUTURES").get("data", []):
        match = _OKX_DATED.match(row.get("instId", ""))
        if not match or match.group("base") != pair:
            continue
        days = _days_until(match.group("expiry"), now)
        if days is None:
            continue
        quotes.append(
            BasisQuote("okx", row["instId"], spot, float(row["last"]), days)
        )
    return quotes


ADAPTERS = {
    "binance": fetch_binance,
    "okx": fetch_okx,
}


def fetch_all(base="BTC", quote="USDT", venues=None, now=None):
    """
    Collect quotes from several venues, tolerating individual venue failures.

    A venue that fails is reported rather than silently dropped, so an empty
    result is never mistaken for an absence of opportunity.

    :param base: base asset.
    :param quote: quote asset.
    :param venues: iterable of venue names, defaults to all adapters.
    :param now: reference instant, for deterministic testing.
    :return: tuple of (list of BasisQuote, dict of venue -> error message).
    """
    selected = list(venues) if venues else list(ADAPTERS)
    collected, errors = [], {}
    for venue in selected:
        adapter = ADAPTERS.get(venue)
        if adapter is None:
            errors[venue] = "no adapter implemented"
            continue
        try:
            collected.extend(adapter(base=base, quote=quote, now=now))
        except VenueError as exc:
            errors[venue] = str(exc)
    return collected, errors
