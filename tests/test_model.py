"""Hand-checked cases for the match model: python3 -m unittest discover tests"""
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server  # noqa: E402

N = server.N_COLS


class TestModel(unittest.TestCase):
    def test_hand_case(self):
        a = {"top": "R" * N, "bottom": "G" * N}
        b = {"top": "R" * N, "bottom": "G" * N}
        c = {"top": "G" * N, "bottom": "R" * N}
        self.assertEqual(server.match(a, b), 100)
        self.assertEqual(server.match(a, c), 0)
        # grey out the top of columns 0..9 in both A and B: those 10 boxes stop matching,
        # grey-grey never counts -> 90
        a2 = {"top": "X" * 10 + "R" * (N - 10), "bottom": "G" * N}
        b2 = {"top": "X" * 10 + "R" * (N - 10), "bottom": "G" * N}
        self.assertEqual(server.match(a2, b2), 90)
        # grey everything but one box in B -> 1 %
        b3 = {"top": "R" + "X" * (N - 1), "bottom": "X" * N}
        self.assertEqual(server.match(a, b3), 1)
        per, glob = server.compute_stats({0: a, 1: b, 2: c})
        self.assertEqual(per[0]["best"], {"pct": 100, "id": 1, "ties": 0})
        self.assertEqual(per[0]["worst"], {"pct": 0, "id": 2, "ties": 0})
        self.assertEqual(per[0]["mean"], 50)
        self.assertEqual(per[0]["related"], 1)
        self.assertEqual(glob["related_pairs"], 1)
        self.assertEqual(glob["best_pair"]["a"], 0)
        self.assertEqual(glob["best_pair"]["b"], 1)

    def test_profile_rules(self):
        rng = random.Random(1)
        p = server.new_profile(rng)
        for t, b in zip(p["top"], p["bottom"]):
            self.assertIn((t, b), {("R", "G"), ("G", "R")})
        q, rows = server.grey_step(p, rng)
        for col, row in enumerate(rows):
            # exactly the chosen box per column is grey after the first step
            self.assertEqual((q["top"][col] == "X", q["bottom"][col] == "X"), (row == 0, row == 1))


if __name__ == "__main__":
    unittest.main()
