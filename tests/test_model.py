"""Hand-checked cases for the match model: python3 -m unittest discover tests"""
import os
import random
import sys
import tempfile
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


class TestGame(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.game = server.Game(os.path.join(self.tmp.name, "s.json"), max_participants=5, seed=1)

    def tearDown(self):
        self.tmp.cleanup()

    def test_modes_and_late_join(self):
        g = self.game
        self.assertEqual(g.mode, "welcome")
        self.assertEqual(g.join("tokenAAAA"), (200, {"id": 0}))
        self.assertEqual(g.join("tokenBBBB"), (200, {"id": 1}))
        self.assertEqual(g.me("tokenAAAA")[1]["mode"], "welcome")
        g.set_mode("generations")
        g.next_generation()
        # late joiner gets an ID but is not part of the running generations round
        self.assertEqual(g.join("tokenCCCC"), (200, {"id": 2}))
        late = g.me("tokenCCCC")[1]["generations"]
        self.assertFalse(late["in_round"])
        self.assertEqual(g.me("tokenAAAA")[1]["generations"]["stats"]["n_others"], 1)
        # a new round includes everyone registered
        g.reset_generations()
        self.assertTrue(g.me("tokenCCCC")[1]["generations"]["in_round"])
        self.assertEqual(g.me("tokenAAAA")[1]["generations"]["stats"]["n_others"], 2)
        with self.assertRaises(ValueError):
            g.set_mode("nonsense")
        # state survives a restart
        g2 = server.Game(g.state_file, max_participants=5)
        self.assertEqual((g2.mode, len(g2.participants)), ("generations", 3))


if __name__ == "__main__":
    unittest.main()
