"""Unit tests for the prediction-market sum-identity screen."""

import io
import os
import tempfile
import unittest
from contextlib import redirect_stdout, redirect_stderr

from arbitrage import prediction, store


class TestEffectivePrice(unittest.TestCase):
    """The touch price is not the fill price; these pin down the difference."""

    def test_single_level_fill_is_the_touch(self):
        self.assertAlmostEqual(prediction.effective_price([(0.48, 100)], 50), 0.48)

    def test_walking_the_book_costs_more_than_the_touch(self):
        book = [(0.48, 10), (0.50, 40), (0.55, 100)]
        price = prediction.effective_price(book, 50)
        # 10 @ 0.48 + 40 @ 0.50 = 24.80 over 50 shares.
        self.assertAlmostEqual(price, 0.496)
        self.assertGreater(price, 0.48)

    def test_partial_level_is_weighted_not_counted_whole(self):
        # Only 5 of the 100 at 0.60 are taken, so the average stays near 0.40.
        self.assertAlmostEqual(
            prediction.effective_price([(0.40, 10), (0.60, 100)], 15),
            (10 * 0.40 + 5 * 0.60) / 15,
        )

    def test_book_too_thin_raises_rather_than_quoting_a_partial_fill(self):
        with self.assertRaises(ValueError) as ctx:
            prediction.effective_price([(0.48, 10)], 50)
        self.assertIn("book too thin", str(ctx.exception))

    def test_empty_book_raises(self):
        with self.assertRaises(ValueError):
            prediction.effective_price([], 1)

    def test_non_positive_size_raises(self):
        for size in (0, -5):
            with self.assertRaises(ValueError):
                prediction.effective_price([(0.5, 100)], size)


class TestAssessRejections(unittest.TestCase):
    """Every way a headline edge fails to become a trade."""

    def test_legs_summing_over_one_have_no_edge_before_fees(self):
        r = prediction.assess("dear", [0.52, 0.49], 30)
        self.assertFalse(r.tradeable)
        self.assertIn("no edge before fees", r.reason)
        self.assertLess(r.gross_edge, 0)

    def test_legs_summing_to_exactly_one_are_rejected(self):
        r = prediction.assess("flat", [0.50, 0.50], 30)
        self.assertFalse(r.tradeable)
        self.assertIn("no edge before fees", r.reason)

    def test_fees_can_consume_the_whole_discount(self):
        # 0.1% gross edge against a 1% fee: cost lands above 1.00.
        r = prediction.assess("thin", [0.4995, 0.4995], 7, fee=0.01, oracle_risk=0.0)
        self.assertFalse(r.tradeable)
        self.assertEqual(r.reason, "fees consume the entire sum discount")
        self.assertGreaterEqual(r.total_cost, 1.0)

    def test_edge_that_does_not_survive_resolution_risk_is_rejected(self):
        # 1% gross edge, 1-in-50 bad resolutions: the claim is worth less than
        # the stake, so this is a losing trade dressed as a riskless one.
        r = prediction.assess("disputed", [0.495, 0.495], 7, fee=0.0, oracle_risk=0.02)
        self.assertFalse(r.tradeable)
        self.assertIn("does not survive", r.reason)
        self.assertLess(r.net_return, 0)

    def test_real_edge_locked_up_too_long_is_rejected_on_annualised_return(self):
        # 2.5% net over two years is a positive number and still not worth it.
        r = prediction.assess("slow", [0.4875, 0.4875], 730, fee=0.0, oracle_risk=0.0)
        self.assertFalse(r.tradeable)
        self.assertGreater(r.net_return, 0)
        self.assertIn("below the", r.reason)

    def test_same_edge_passes_when_the_wait_is_short(self):
        short = prediction.assess("fast", [0.4875, 0.4875], 9, fee=0.0, oracle_risk=0.0)
        self.assertTrue(short.tradeable)
        long = prediction.assess("slow", [0.4875, 0.4875], 730, fee=0.0, oracle_risk=0.0)
        self.assertAlmostEqual(short.net_return, long.net_return)
        self.assertGreater(short.annualised, long.annualised)


class TestAssessAcceptance(unittest.TestCase):

    def test_wide_short_dated_discount_clears_every_gate(self):
        r = prediction.assess("clean", [0.483, 0.489], 9)
        self.assertTrue(r.tradeable)
        self.assertAlmostEqual(r.gross_edge, 0.028)
        self.assertGreater(r.annualised, r.hurdle)

    def test_expected_payout_is_never_a_full_dollar_under_oracle_risk(self):
        r = prediction.assess("clean", [0.483, 0.489], 9, oracle_risk=0.01)
        self.assertAlmostEqual(r.expected_payout, 0.99)

    def test_multi_outcome_markets_use_the_same_identity(self):
        r = prediction.assess("four-way", [0.41, 0.33, 0.14, 0.09], 45)
        self.assertEqual(r.legs, 4)
        self.assertAlmostEqual(r.gross_edge, 0.03)

    def test_hurdle_recorded_is_the_sum_of_rate_and_premium(self):
        r = prediction.assess("x", [0.48, 0.49], 30, hurdle=0.04, risk_premium=0.03)
        self.assertAlmostEqual(r.hurdle, 0.07)

    def test_result_serialises_for_the_log(self):
        d = prediction.assess("x", [0.48, 0.49], 30).as_dict()
        self.assertEqual(d["market"], "x")
        self.assertIn("annualised", d)


class TestAssessValidation(unittest.TestCase):

    def test_no_legs_raises(self):
        with self.assertRaises(ValueError):
            prediction.assess("x", [], 30)

    def test_non_positive_leg_price_raises(self):
        for legs in ([0.0, 0.5], [-0.1, 0.5]):
            with self.assertRaises(ValueError):
                prediction.assess("x", legs, 30)

    def test_non_positive_horizon_raises(self):
        for days in (0, -1):
            with self.assertRaises(ValueError):
                prediction.assess("x", [0.48, 0.49], days)


class TestBreakEvenCost(unittest.TestCase):

    def test_frictionless_break_even_is_one_dollar(self):
        be = prediction.break_even_cost(30, oracle_risk=0.0, fee=0.0,
                                        hurdle=0.0, risk_premium=0.0)
        self.assertAlmostEqual(be, 1.0)

    def test_resolution_risk_alone_sets_the_ceiling(self):
        # With no fees and no hurdle, you can pay at most the expected payout.
        be = prediction.break_even_cost(30, oracle_risk=0.02, fee=0.0,
                                        hurdle=0.0, risk_premium=0.0)
        self.assertAlmostEqual(be, 0.98)

    def test_longer_horizons_demand_a_cheaper_entry(self):
        costs = [prediction.break_even_cost(d) for d in (7, 30, 90, 365, 730)]
        self.assertEqual(costs, sorted(costs, reverse=True))

    def test_break_even_agrees_with_assess_at_the_boundary(self):
        days = 45
        be = prediction.break_even_cost(days)
        just_inside = prediction.assess("in", [be - 0.002], days)
        just_outside = prediction.assess("out", [be + 0.002], days)
        self.assertTrue(just_inside.tradeable)
        self.assertFalse(just_outside.tradeable)

    def test_non_positive_horizon_raises(self):
        with self.assertRaises(ValueError):
            prediction.break_even_cost(0)


class TestReport(unittest.TestCase):

    def test_report_states_the_verdict_and_flags_the_assumption(self):
        text = prediction.format_report(prediction.assess("clean", [0.483, 0.489], 9))
        self.assertIn("TRADEABLE", text)
        self.assertIn("ASSUMPTION", text)

    def test_report_recovers_the_raw_leg_sum_from_the_costed_figure(self):
        legs = [0.483, 0.489]
        text = prediction.format_report(prediction.assess("clean", legs, 9))
        self.assertIn(f"{sum(legs):.4f}", text)


class TestCli(unittest.TestCase):

    def _run(self, argv):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = prediction.main(argv)
        return code, out.getvalue(), err.getvalue()

    def test_demo_screens_every_synthetic_market(self):
        code, out, _ = self._run(["--demo"])
        self.assertEqual(code, 0)
        for name, _legs, _days in prediction.DEMO:
            self.assertIn(name, out)

    def test_table_prints_break_even_by_horizon(self):
        code, out, _ = self._run(["--table"])
        self.assertEqual(code, 0)
        self.assertIn("MAX SUM", out)
        self.assertIn("1 year", out)

    def test_manual_without_days_is_a_usage_error(self):
        code, _, err = self._run(["--manual", "0.48", "0.49"])
        self.assertEqual(code, 2)
        self.assertIn("--days", err)

    def test_manual_with_bad_prices_reports_rather_than_crashes(self):
        code, _, err = self._run(["--manual", "0", "0.49", "--days", "9"])
        self.assertEqual(code, 2)
        self.assertIn("positive", err)

    def test_log_writes_a_readable_record(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "prediction.jsonl")
            code, out, _ = self._run(["--manual", "0.483", "0.489", "--days", "9",
                                      "--name", "logged", "--log", "--path", path])
            self.assertEqual(code, 0)
            self.assertIn("logged ->", out)
            rows = store.load(path)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["market"], "logged")
            self.assertTrue(rows[0]["tradeable"])

    def test_bare_invocation_prints_help(self):
        code, out, _ = self._run([])
        self.assertEqual(code, 0)
        self.assertIn("usage", out)


if __name__ == "__main__":
    unittest.main()
