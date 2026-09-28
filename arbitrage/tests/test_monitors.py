"""Unit tests for the premium and pairs monitors and their shared store."""

import math
import os
import tempfile
import unittest

from arbitrage import pairs, premium, store


class TestStore(unittest.TestCase):

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.path = os.path.join(self.dir, "t.jsonl")

    def test_append_then_load_roundtrip(self):
        store.append(self.path, {"premium": 0.01})
        store.append(self.path, {"premium": 0.02})
        rows = store.load(self.path)
        self.assertEqual([r["premium"] for r in rows], [0.01, 0.02])

    def test_append_stamps_time_but_preserves_supplied_one(self):
        self.assertIn("ts", store.append(self.path, {"x": 1}))
        store.append(self.path, {"x": 2, "ts": "2020-01-01T00:00:00+00:00"})
        self.assertEqual(store.load(self.path)[-1]["ts"], "2020-01-01T00:00:00+00:00")

    def test_missing_file_reads_as_empty(self):
        self.assertEqual(store.load(os.path.join(self.dir, "nope.jsonl")), [])

    def test_truncated_line_is_skipped_not_fatal(self):
        store.append(self.path, {"premium": 0.01})
        with open(self.path, "a", encoding="utf-8") as fh:
            fh.write('{"premium": 0.0')      # power-loss style partial write
        store.append(self.path, {"premium": 0.03})
        self.assertEqual([r["premium"] for r in store.load(self.path)], [0.01, 0.03])

    def test_limit_returns_most_recent(self):
        for i in range(5):
            store.append(self.path, {"premium": i})
        self.assertEqual([r["premium"] for r in store.load(self.path, limit=2)], [3, 4])

    def test_summary_counts_and_spans(self):
        store.append(self.path, {"premium": 0.01})
        store.append(self.path, {"premium": 0.02})
        s = store.summary(self.path)
        self.assertEqual(s["count"], 2)
        self.assertIsNotNone(s["first"])
        self.assertLessEqual(s["first"], s["last"])


class TestPremiumMath(unittest.TestCase):

    def test_premium_is_zero_when_local_matches_converted(self):
        self.assertAlmostEqual(premium.local_premium(100 * 4.7, 100, 4.7), 0.0)

    def test_positive_and_negative_premium(self):
        self.assertAlmostEqual(premium.local_premium(470 * 1.02, 100, 4.7), 0.02, places=9)
        self.assertAlmostEqual(premium.local_premium(470 * 0.98, 100, 4.7), -0.02, places=9)

    def test_rejects_nonpositive_inputs(self):
        for bad in ((0, 100, 4.7), (470, 0, 4.7), (470, 100, 0), (-1, 100, 4.7)):
            with self.assertRaises(ValueError):
                premium.local_premium(*bad)

    def test_round_trip_cost_sums_all_three(self):
        self.assertAlmostEqual(premium.round_trip_cost(0.002, 0.002, 0.0005), 0.0045)

    def test_reading_carries_computed_premium(self):
        r = premium.reading(470 * 1.01, 100, 4.7)
        self.assertAlmostEqual(r.premium, 0.01, places=9)
        self.assertIn("premium", r.as_dict())


class TestPremiumAssessment(unittest.TestCase):

    def test_median_below_cost_is_rejected(self):
        out = premium.assess([0.001] * 10, cost=0.0045)
        self.assertFalse(out["tradeable"])
        self.assertIn("does not clear", out["reason"])

    def test_intermittent_edge_is_rejected_even_with_big_spikes(self):
        # Six readings clear cost and four do not: the median passes, but at
        # 60% the edge is present too seldom to plan around.
        out = premium.assess([0.012] * 6 + [0.001] * 4, cost=0.0045)
        self.assertFalse(out["tradeable"])
        self.assertIn("of the time", out["reason"])

    def test_persistent_edge_is_accepted(self):
        out = premium.assess([0.012] * 10, cost=0.0045)
        self.assertTrue(out["tradeable"])
        self.assertGreater(out["net_median"], 0)

    def test_median_not_mean_decides(self):
        # One outlier lifts the mean above cost; the median does not follow.
        out = premium.assess([0.001] * 9 + [0.50], cost=0.0045)
        self.assertGreater(out["mean"], out["cost"])
        self.assertFalse(out["tradeable"])

    def test_sign_is_ignored_a_discount_is_also_an_edge(self):
        self.assertTrue(premium.assess([-0.012] * 10, cost=0.0045)["tradeable"])

    def test_empty_series_raises(self):
        with self.assertRaises(ValueError):
            premium.assess([], cost=0.0045)


class TestPairsMath(unittest.TestCase):

    def test_ols_recovers_a_known_hedge_ratio(self):
        xs = [float(i) for i in range(50)]
        ys = [3.0 * x + 7.0 for x in xs]
        beta, alpha = pairs.ols_beta(xs, ys)
        self.assertAlmostEqual(beta, 3.0, places=9)
        self.assertAlmostEqual(alpha, 7.0, places=9)

    def test_ols_rejects_zero_variance_and_mismatch(self):
        with self.assertRaises(ValueError):
            pairs.ols_beta([1.0] * 10, list(range(10)))
        with self.assertRaises(ValueError):
            pairs.ols_beta([1.0, 2.0], [1.0])

    def test_spread_of_a_perfect_fit_is_flat(self):
        xs = [float(i) for i in range(30)]
        ys = [2.0 * x + 1.0 for x in xs]
        self.assertTrue(all(abs(s) < 1e-9 for s in pairs.spread_series(xs, ys, 2.0, 1.0)))

    def test_zscore_handles_zero_variance(self):
        self.assertEqual(pairs.zscore(5.0, 5.0, 0.0), 0.0)
        self.assertAlmostEqual(pairs.zscore(7.0, 5.0, 2.0), 1.0)

    def test_half_life_finite_for_mean_reverting_series(self):
        spread, v = [], 10.0
        for _ in range(200):
            v *= 0.7                      # decays toward zero
            spread.append(v)
        self.assertLess(pairs.half_life(spread), 10)

    def test_half_life_infinite_for_a_trend(self):
        self.assertEqual(pairs.half_life([float(i) for i in range(100)]), math.inf)

    def test_half_life_needs_three_points(self):
        with self.assertRaises(ValueError):
            pairs.half_life([1.0, 2.0])


class TestPairsAssessment(unittest.TestCase):

    def setUp(self):
        self.a, self.b = pairs._synthetic_pair()

    def test_synthetic_pair_is_tradeable_at_low_cost(self):
        s = pairs.assess_pair("A", "B", self.a, self.b, round_trip_cost=0.0005)
        self.assertTrue(s.tradeable)
        self.assertGreater(abs(s.correlation), 0.9)
        self.assertLess(s.half_life, pairs.MAX_HALF_LIFE_DAYS)

    def test_same_pair_is_rejected_once_costs_are_realistic(self):
        s = pairs.assess_pair("A", "B", self.a, self.b, round_trip_cost=0.05)
        self.assertFalse(s.tradeable)
        self.assertIn("does not cover", s.reason)
        self.assertLess(s.net_per_trade, 0)

    def test_uncorrelated_series_are_rejected(self):
        a = [float((i * 37) % 11) + 50 for i in range(60)]
        b = [float((i * 53) % 7) + 50 for i in range(60)]
        s = pairs.assess_pair("A", "B", a, b, round_trip_cost=0.0)
        if abs(s.correlation) < pairs.MIN_CORRELATION:
            self.assertFalse(s.tradeable)
            self.assertIn("not tracking", s.reason)

    def test_short_series_raises(self):
        with self.assertRaises(ValueError):
            pairs.assess_pair("A", "B", [1.0] * 10, [2.0] * 10, round_trip_cost=0.0)

    def test_mismatched_lengths_raise(self):
        with self.assertRaises(ValueError):
            pairs.assess_pair("A", "B", self.a, self.b[:-1], round_trip_cost=0.0)

    def test_higher_entry_z_raises_expected_capture(self):
        low = pairs.assess_pair("A", "B", self.a, self.b, 0.0005, entry_z=1.0)
        high = pairs.assess_pair("A", "B", self.a, self.b, 0.0005, entry_z=3.0)
        self.assertGreater(high.edge_per_trade, low.edge_per_trade)

    def test_report_always_carries_the_statistical_caveat(self):
        s = pairs.assess_pair("A", "B", self.a, self.b, round_trip_cost=0.0005)
        self.assertIn("NOT a cointegration test", pairs.format_report(s))


class TestCsvLoading(unittest.TestCase):

    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def _write(self, name, text):
        path = os.path.join(self.dir, name)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
        return path

    def test_reads_named_column_and_skips_junk_rows(self):
        path = self._write("a.csv", "time,close\n1,100.5\n2,oops\n3,101.5\n")
        self.assertEqual(pairs.load_csv(path, "close"), [100.5, 101.5])

    def test_missing_column_raises(self):
        path = self._write("b.csv", "time,open\n1,100\n")
        with self.assertRaises(ValueError):
            pairs.load_csv(path, "close")

    def test_column_with_no_numbers_raises(self):
        path = self._write("c.csv", "time,close\n1,n/a\n2,n/a\n")
        with self.assertRaises(ValueError):
            pairs.load_csv(path, "close")


if __name__ == "__main__":
    unittest.main()
