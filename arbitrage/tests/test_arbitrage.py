"""Unit tests for the basis arbitrage toolkit. Run: python -m unittest discover arbitrage"""

import unittest
from datetime import datetime, timedelta, timezone

from arbitrage import fees, sessions
from arbitrage.basis import (
    BasisQuote, annualise, evaluate, gross_basis, liquidation_move, position_size,
)
from arbitrage.scanner import report, safety_check, scan


class TestBasisMath(unittest.TestCase):

    def test_gross_basis_contango(self):
        self.assertAlmostEqual(gross_basis(100_000, 102_000), 0.02)

    def test_gross_basis_backwardation(self):
        self.assertAlmostEqual(gross_basis(100_000, 98_000), -0.02)

    def test_gross_basis_rejects_nonpositive_spot(self):
        for bad in (0, -1):
            with self.assertRaises(ValueError):
                gross_basis(bad, 100)

    def test_annualise_worked_example(self):
        # 2% over 90 days -> 2 * 365/90 = 8.111%
        self.assertAlmostEqual(annualise(0.02, 90), 0.0811111, places=6)

    def test_annualise_rejects_nonpositive_tenor(self):
        for bad in (0, -5):
            with self.assertRaises(ValueError):
                annualise(0.02, bad)

    def test_shorter_tenor_amplifies_annualised_rate(self):
        self.assertGreater(annualise(0.01, 30), annualise(0.01, 90))


class TestEvaluate(unittest.TestCase):

    def _quote(self, future, days=90.0):
        return BasisQuote("binance", "TEST", 100_000.0, future, days)

    def test_backwardation_is_untradeable(self):
        result = evaluate(self._quote(99_000.0), fee_cost=0.003)
        self.assertFalse(result.tradeable)
        self.assertIn("backwardation", result.reason)

    def test_fees_can_exceed_gross_basis(self):
        # 0.1% gross over a 0.3% fee load is a guaranteed loss.
        result = evaluate(self._quote(100_100.0), fee_cost=0.003)
        self.assertFalse(result.tradeable)
        self.assertLess(result.net_basis, 0)
        self.assertIn("fees exceed", result.reason)

    def test_thin_edge_rejected_by_risk_premium(self):
        result = evaluate(self._quote(101_500.0), fee_cost=0.003,
                          hurdle=0.04, risk_premium=0.03)
        self.assertFalse(result.tradeable)
        self.assertIn("risk premium", result.reason)

    def test_wide_basis_clears(self):
        result = evaluate(self._quote(104_000.0), fee_cost=0.003,
                          hurdle=0.04, risk_premium=0.03)
        self.assertTrue(result.tradeable)
        self.assertGreater(result.edge, 0.03)

    def test_fees_always_reduce_net_return(self):
        free = evaluate(self._quote(103_000.0), fee_cost=0.0)
        costed = evaluate(self._quote(103_000.0), fee_cost=0.003)
        self.assertLess(costed.annualised_net, free.annualised_net)

    def test_higher_hurdle_shrinks_edge(self):
        low = evaluate(self._quote(104_000.0), fee_cost=0.003, hurdle=0.01)
        high = evaluate(self._quote(104_000.0), fee_cost=0.003, hurdle=0.09)
        self.assertGreater(low.edge, high.edge)


class TestSizingAndLiquidation(unittest.TestCase):

    def test_position_size_splits_capital(self):
        notional, spot, collateral = position_size(15_000.0, 0.5)
        self.assertAlmostEqual(spot + collateral, 15_000.0)
        self.assertAlmostEqual(notional, 10_000.0)

    def test_position_size_validates_inputs(self):
        with self.assertRaises(ValueError):
            position_size(-1.0, 0.5)
        with self.assertRaises(ValueError):
            position_size(1000.0, 0.0)

    def test_liquidation_move_shrinks_with_leverage(self):
        self.assertGreater(liquidation_move(0.5, 0.005), liquidation_move(0.1, 0.005))

    def test_liquidation_move_never_negative(self):
        self.assertEqual(liquidation_move(0.002, 0.005), 0.0)

    def test_high_leverage_flagged_unsafe(self):
        result = evaluate(BasisQuote("binance", "T", 100_000.0, 104_000.0, 90.0), 0.003)
        tight = safety_check(result, 10_000.0, margin_ratio=0.10)
        loose = safety_check(result, 10_000.0, margin_ratio=0.50)
        self.assertFalse(tight["safe"])
        self.assertTrue(loose["safe"])
        self.assertIn("TOO TIGHT", tight["note"])


class TestFees(unittest.TestCase):

    def test_unknown_venue_is_pessimistic(self):
        self.assertGreater(fees.round_trip_cost("nonexistent"),
                           fees.round_trip_cost("binance"))

    def test_early_close_costs_at_least_as_much(self):
        for venue in ("binance", "okx", "bybit", "deribit"):
            self.assertGreaterEqual(fees.round_trip_cost(venue, close_early=True),
                                    fees.round_trip_cost(venue, close_early=False))

    def test_venue_lookup_is_case_insensitive(self):
        self.assertEqual(fees.get_schedule("BINANCE").venue, "binance")


class TestSessions(unittest.TestCase):

    def _at(self, hour, day=14):
        return datetime(2026, 9, day, hour, 0, tzinfo=timezone.utc)

    def test_london_new_york_overlap_is_deepest(self):
        overlap = sessions.active_sessions(self._at(14))
        self.assertIn("london", overlap)
        self.assertIn("new_york", overlap)

    def test_sydney_window_wraps_midnight(self):
        self.assertIn("sydney", sessions.active_sessions(self._at(23)))
        self.assertIn("sydney", sessions.active_sessions(self._at(2)))
        self.assertNotIn("sydney", sessions.active_sessions(self._at(12)))

    def test_liquidity_regime_is_known_label(self):
        for hour in range(24):
            self.assertIn(sessions.liquidity_regime(self._at(hour)),
                          {"dead", "thin", "normal", "deep"})

    def test_next_funding_is_a_settlement_hour_in_the_future(self):
        for hour in range(24):
            moment = self._at(hour)
            nxt = sessions.next_funding(moment)
            self.assertGreater(nxt, moment)
            self.assertIn(nxt.hour, sessions.FUNDING_HOURS)

    def test_quarterly_expiries_are_last_fridays(self):
        for month in sessions.EXPIRY_MONTHS:
            expiry = sessions.last_friday(2026, month)
            self.assertEqual(expiry.weekday(), 4)
            self.assertEqual(expiry.month, month)
            self.assertEqual(expiry.hour, sessions.EXPIRY_HOUR)
            # It is genuinely the LAST Friday: seven days on lands in a new month.
            self.assertNotEqual((expiry + timedelta(days=7)).month, month)

    def test_next_expiry_is_always_future(self):
        for month in range(1, 13):
            moment = datetime(2026, month, 15, 12, tzinfo=timezone.utc)
            self.assertGreater(sessions.next_quarterly_expiry(moment), moment)

    def test_cme_weekend_closure(self):
        self.assertTrue(sessions.cme_is_closed(datetime(2026, 9, 12, 12, tzinfo=timezone.utc)))   # Sat
        self.assertTrue(sessions.cme_is_closed(datetime(2026, 9, 11, 23, tzinfo=timezone.utc)))   # Fri late
        self.assertFalse(sessions.cme_is_closed(datetime(2026, 9, 9, 12, tzinfo=timezone.utc)))   # Wed


class TestScanner(unittest.TestCase):

    def setUp(self):
        self.quotes = [
            BasisQuote("binance", "WIDE", 100_000.0, 104_000.0, 90.0),
            BasisQuote("binance", "THIN", 100_000.0, 100_050.0, 90.0),
            BasisQuote("okx", "BACK", 100_000.0, 99_000.0, 90.0),
        ]

    def test_results_ranked_by_edge(self):
        ranked = scan(self.quotes)
        edges = [r.edge for r in ranked]
        self.assertEqual(edges, sorted(edges, reverse=True))
        self.assertEqual(ranked[0].symbol, "WIDE")

    def test_report_counts_only_tradeable(self):
        data = report(self.quotes, capital=10_000.0)
        self.assertEqual(data["scanned"], 3)
        self.assertEqual(data["tradeable"], 1)

    def test_empty_scan_reports_no_opportunity(self):
        data = report([], capital=10_000.0)
        self.assertIsNone(data["best"])
        self.assertIn("nothing clears", data["verdict"])

    def test_report_with_only_losers_is_honest(self):
        data = report(self.quotes[1:], capital=10_000.0)
        self.assertEqual(data["tradeable"], 0)
        self.assertIn("nothing clears", data["verdict"])


if __name__ == "__main__":
    unittest.main()
