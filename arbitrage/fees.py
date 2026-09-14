"""
Venue fee schedules for cash-and-carry cost modelling.

IMPORTANT: these are base-tier (VIP 0) taker rates captured as defaults. Fee
schedules change and vary by tier, referral, and settlement asset. Verify the
current rates against your own account before trading real capital -- an
outdated rate here silently turns a losing trade into an apparently winning one.

All rates are expressed as a decimal fraction of notional (0.001 == 0.10%).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class FeeSchedule:
    """
    Taker fee rates for one venue.

    :param venue: venue identifier.
    :param spot_taker: taker rate on the spot leg.
    :param futures_taker: taker rate on the dated futures leg.
    :param futures_settlement: fee applied when a dated contract settles at
        expiry. Several venues charge nothing here; when unsure, leave it at the
        taker rate so the model errs conservative.
    :param maintenance_margin: maintenance margin rate on the short futures leg,
        used to estimate the liquidation distance.
    """

    venue: str
    spot_taker: float
    futures_taker: float
    futures_settlement: float
    maintenance_margin: float = 0.005


# Base-tier taker rates. VERIFY BEFORE TRADING.
SCHEDULES = {
    "binance": FeeSchedule("binance", 0.00100, 0.00050, 0.00050, 0.004),
    "okx": FeeSchedule("okx", 0.00100, 0.00050, 0.00050, 0.005),
    "bybit": FeeSchedule("bybit", 0.00100, 0.00055, 0.00055, 0.005),
    "deribit": FeeSchedule("deribit", 0.00050, 0.00050, 0.00000, 0.005),
}

# Used when a venue is not in SCHEDULES. Deliberately pessimistic: an unknown
# venue should look worse than a known one, never better.
FALLBACK = FeeSchedule("unknown", 0.00150, 0.00075, 0.00075, 0.010)


def get_schedule(venue):
    """
    Look up a venue fee schedule, falling back to a pessimistic default.

    :param venue: venue identifier, case-insensitive.
    :return: FeeSchedule.
    """
    return SCHEDULES.get(str(venue).lower(), FALLBACK)


def round_trip_cost(venue, close_early=False):
    """
    Total fee cost of one cash-and-carry round trip, as a fraction of notional.

    The trade pays fees four times in the general case:
      1. buy spot          (spot taker)
      2. sell future       (futures taker)
      3. future settles    (settlement fee, or taker if closed before expiry)
      4. sell spot         (spot taker)

    :param venue: venue identifier.
    :param close_early: if True, the futures leg is closed by trading out rather
        than held to settlement, so it pays the taker rate instead.
    :return: total cost as a decimal fraction of notional.
    """
    schedule = get_schedule(venue)
    exit_futures = schedule.futures_taker if close_early else schedule.futures_settlement
    return (schedule.spot_taker * 2.0) + schedule.futures_taker + exit_futures
