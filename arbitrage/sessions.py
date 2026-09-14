"""
Trading-session and structural-clock awareness.

Arbitrage has no single "best session". It has a liquidity trade-off that runs
against intuition: thin hours show the most mispricings and are the worst hours
to act on them, because slippage exceeds the gap. Deep hours show fewer
mispricings but are the only hours you can fill size at the quoted price.

For 24/7 crypto the session clock matters far less than the *structural* clock:
funding settlements, the CME weekend gap, and quarterly expiry.

All times are UTC.
"""

from datetime import datetime, timedelta, timezone

# name -> (open hour, close hour). A close <= open means the window wraps midnight.
SESSIONS = {
    "sydney": (21, 6),
    "tokyo": (0, 9),
    "london": (7, 16),
    "new_york": (12, 21),
}

# Liquidity regime by count of concurrently open sessions.
LIQUIDITY_BY_OVERLAP = {
    0: "dead",
    1: "thin",
    2: "normal",
    3: "deep",
    4: "deep",
}

# Perpetual funding settlement hours on the major venues.
FUNDING_HOURS = (0, 8, 16)

# Quarterly dated contracts expire on the last Friday of these months at 08:00.
EXPIRY_MONTHS = (3, 6, 9, 12)
EXPIRY_HOUR = 8


def _in_window(hour, start, end):
    """
    Test whether an hour falls inside a session window, handling midnight wrap.

    :param hour: hour of day, 0-23.
    :param start: window opening hour.
    :param end: window closing hour.
    :return: True if inside the window.
    """
    if start < end:
        return start <= hour < end
    return hour >= start or hour < end


def active_sessions(moment):
    """
    List the sessions open at a given instant.

    :param moment: timezone-aware datetime.
    :return: sorted list of session names.
    """
    hour = moment.astimezone(timezone.utc).hour
    return sorted(n for n, (s, e) in SESSIONS.items() if _in_window(hour, s, e))


def liquidity_regime(moment):
    """
    Classify execution quality at a given instant.

    :param moment: timezone-aware datetime.
    :return: one of "dead", "thin", "normal", "deep".
    """
    return LIQUIDITY_BY_OVERLAP.get(len(active_sessions(moment)), "normal")


def next_funding(moment):
    """
    Time of the next perpetual funding settlement.

    :param moment: timezone-aware datetime.
    :return: timezone-aware datetime of the next settlement.
    """
    moment = moment.astimezone(timezone.utc)
    today = moment.replace(minute=0, second=0, microsecond=0)
    for hour in FUNDING_HOURS:
        candidate = today.replace(hour=hour)
        if candidate > moment:
            return candidate
    return (today + timedelta(days=1)).replace(hour=FUNDING_HOURS[0])


def cme_is_closed(moment):
    """
    Whether CME crypto futures are in their weekend closure.

    CME crypto trades roughly Sunday 23:00 UTC to Friday 22:00 UTC. Spot never
    stops, so the closure opens a genuine structural gap between the two.
    This is an approximation and ignores daily maintenance breaks and US DST.

    :param moment: timezone-aware datetime.
    :return: True if inside the weekend closure.
    """
    moment = moment.astimezone(timezone.utc)
    weekday, hour = moment.weekday(), moment.hour
    if weekday == 4 and hour >= 22:      # Friday evening
        return True
    if weekday == 5:                     # Saturday
        return True
    if weekday == 6 and hour < 23:       # Sunday before reopen
        return True
    return False


def last_friday(year, month):
    """
    Date of the last Friday of a month, the standard quarterly expiry day.

    :param year: four-digit year.
    :param month: month number, 1-12.
    :return: datetime at EXPIRY_HOUR UTC on that Friday.
    """
    if month == 12:
        first_next = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        first_next = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    day = first_next - timedelta(days=1)
    while day.weekday() != 4:            # 4 == Friday
        day -= timedelta(days=1)
    return day.replace(hour=EXPIRY_HOUR, minute=0, second=0, microsecond=0)


def next_quarterly_expiry(moment):
    """
    The next quarterly dated-contract expiry after a given instant.

    This is the settlement date a cash-and-carry position is held to, and so the
    date that fixes the trade's holding period.

    :param moment: timezone-aware datetime.
    :return: timezone-aware datetime of the next quarterly expiry.
    """
    moment = moment.astimezone(timezone.utc)
    for year in (moment.year, moment.year + 1):
        for month in EXPIRY_MONTHS:
            expiry = last_friday(year, month)
            if expiry > moment:
                return expiry
    raise RuntimeError("unable to resolve next quarterly expiry")


def days_to_next_expiry(moment):
    """
    Days remaining until the next quarterly expiry.

    :param moment: timezone-aware datetime.
    :return: float number of days.
    """
    delta = next_quarterly_expiry(moment) - moment.astimezone(timezone.utc)
    return delta.total_seconds() / 86400.0


def clock_report(moment=None):
    """
    Summarise every timing signal relevant to a basis trade.

    :param moment: timezone-aware datetime, defaults to now in UTC.
    :return: dict of timing facts.
    """
    moment = moment or datetime.now(timezone.utc)
    moment = moment.astimezone(timezone.utc)
    sessions = active_sessions(moment)
    return {
        "utc": moment.isoformat(),
        "active_sessions": sessions,
        "liquidity": liquidity_regime(moment),
        "execution_advice": (
            "good window for entry"
            if liquidity_regime(moment) == "deep"
            else "widen your slippage assumption; thin books flatter the basis"
        ),
        "next_funding": next_funding(moment).isoformat(),
        "cme_closed": cme_is_closed(moment),
        "next_quarterly_expiry": next_quarterly_expiry(moment).isoformat(),
        "days_to_expiry": round(days_to_next_expiry(moment), 2),
    }
