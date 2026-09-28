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


class TestBirthday(unittest.TestCase):
    def test_groups_by_hand(self):
        # IDs 1, 4, 7 on 5 March; 2 on 6 May; 3 on 5 May -> one group of three
        b = {1: (3, 5), 4: (3, 5), 7: (3, 5), 2: (5, 6), 3: (5, 5)}
        self.assertEqual(server.birthday_groups(b), [{"month": 3, "day": 5, "ids": [1, 4, 7]}])
        self.assertEqual(server.birthday_groups({}), [])

    def test_validation(self):
        self.assertTrue(server.valid_birthday(2, 29))
        self.assertFalse(server.valid_birthday(2, 30))
        self.assertFalse(server.valid_birthday(4, 31))
        self.assertFalse(server.valid_birthday(13, 1))
        self.assertFalse(server.valid_birthday("3", 5))

    def test_probability(self):
        # known values: 23 people ~ 50.7 %, 50 ~ 97.0 %, 1 person 0 %
        self.assertAlmostEqual(server.p_shared_birthday(23), 0.5073, places=4)
        self.assertAlmostEqual(server.p_shared_birthday(50), 0.9704, places=4)
        self.assertEqual(server.p_shared_birthday(1), 0.0)
        self.assertEqual(server.p_shared_birthday(400), 1.0)


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
        # birthdays: A and C share 5 March, B does not
        g.set_mode("birthday")
        self.assertEqual(g.set_birthday("tokenAAAA", 3, 5)[0], 200)
        self.assertEqual(g.set_birthday("tokenBBBB", 5, 6)[0], 200)
        self.assertEqual(g.set_birthday("tokenCCCC", 3, 5)[0], 200)
        self.assertEqual(g.set_birthday("tokenBBBB", 2, 30)[0], 400)
        self.assertEqual(g.me("tokenAAAA")[1]["birthday"]["same_ids"], [2])
        self.assertEqual(g.me("tokenBBBB")[1]["birthday"]["same_ids"], [])
        self.assertEqual(g.admin_state()["birthday"]["groups"], [{"month": 3, "day": 5, "ids": [0, 2]}])
        # state survives a restart
        g2 = server.Game(g.state_file, max_participants=5)
        self.assertEqual((g2.mode, len(g2.participants)), ("birthday", 3))
        self.assertEqual(g2.participants[2]["birthday"], [3, 5])


if __name__ == "__main__":
    unittest.main()
