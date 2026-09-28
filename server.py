#!/usr/bin/env python3
"""Generations demonstration server.

Serves the web pages in docs/ and a small JSON API that coordinates up to
--max-participants devices. All randomness and statistics are computed here,
so every device sees the same world.

Model
  Gen 1   : per column, top/bottom is randomly red/green or green/red.
  Gen >=2 : per participant, per column, top or bottom (p=0.5) turns grey
            (it may already be grey).
  Match   : number of the 100 positions with the same colour; grey never
            matches (also not grey-grey). 1 box = 1 %.
  Related : match > 0.

Usage
  python3 server.py [--port 8080] [--admin-password X] [--tunnel]
"""

import argparse
import json
import logging
import os
import random
import re
import secrets
import shutil
import signal
import subprocess
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

N_COLS = 50
RED, GREEN, GREY = "R", "G", "X"
HERE = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(HERE, "docs")

log = logging.getLogger("server")
err_log = logging.getLogger("server.errors")


# ---------------------------------------------------------------------------
# Model (pure functions — testable without the server)
# ---------------------------------------------------------------------------

def new_profile(rng):
    """Gen-1 profile: per column top is R or G, bottom is the opposite."""
    top = [rng.choice((RED, GREEN)) for _ in range(N_COLS)]
    bottom = [GREEN if c == RED else RED for c in top]
    return {"top": "".join(top), "bottom": "".join(bottom)}


def grey_step(profile, rng):
    """Turn one random box per column grey. Returns (new_profile, rows_hit)."""
    top, bottom = list(profile["top"]), list(profile["bottom"])
    rows_hit = []
    for col in range(N_COLS):
        row = rng.randrange(2)
        (top if row == 0 else bottom)[col] = GREY
        rows_hit.append(row)
    return {"top": "".join(top), "bottom": "".join(bottom)}, rows_hit


def _masks(profile):
    """Bit masks (one bit per box, 100 boxes) of red and green positions."""
    seq = profile["top"] + profile["bottom"]
    red = green = 0
    for i, c in enumerate(seq):
        if c == RED:
            red |= 1 << i
        elif c == GREEN:
            green |= 1 << i
    return red, green


def match(profile_a, profile_b):
    """Percentage overlap: same colour at the same position, grey never matches."""
    ra, ga = _masks(profile_a)
    rb, gb = _masks(profile_b)
    return (ra & rb).bit_count() + (ga & gb).bit_count()


def compute_stats(profiles):
    """profiles: {id: profile}. Returns (per_participant, global_stats)."""
    ids = sorted(profiles)
    masks = {i: _masks(profiles[i]) for i in ids}
    pair = {}
    for ai, a in enumerate(ids):
        ra, ga = masks[a]
        for b in ids[ai + 1:]:
            rb, gb = masks[b]
            pair[(a, b)] = (ra & rb).bit_count() + (ga & gb).bit_count()

    def pm(a, b):
        return pair[(a, b) if a < b else (b, a)]

    per = {}
    for a in ids:
        others = [(pm(a, b), b) for b in ids if b != a]
        if not others:
            per[a] = {"n_others": 0, "best": None, "worst": None,
                      "mean": None, "related": 0}
            continue
        vals = [v for v, _ in others]
        best_v, worst_v = max(vals), min(vals)
        best_ids = sorted(b for v, b in others if v == best_v)
        worst_ids = sorted(b for v, b in others if v == worst_v)
        per[a] = {
            "n_others": len(others),
            "best": {"pct": best_v, "id": best_ids[0], "ties": len(best_ids) - 1},
            "worst": {"pct": worst_v, "id": worst_ids[0], "ties": len(worst_ids) - 1},
            "mean": round(sum(vals) / len(vals), 2),
            "related": sum(1 for v in vals if v > 0),
        }

    hist = [0] * (2 * N_COLS + 1)
    for v in pair.values():
        hist[v] += 1
    glob = {"n": len(ids), "total_pairs": len(pair), "histogram": hist,
            "mean": None, "best_pair": None, "worst_pair": None,
            "related_pairs": sum(1 for v in pair.values() if v > 0)}
    if pair:
        glob["mean"] = round(sum(pair.values()) / len(pair), 2)
        best = max(pair.items(), key=lambda kv: (kv[1], -kv[0][0], -kv[0][1]))
        worst = min(pair.items(), key=lambda kv: (kv[1], kv[0][0], kv[0][1]))
        glob["best_pair"] = {"a": best[0][0], "b": best[0][1], "pct": best[1],
                             "ties": sum(1 for v in pair.values() if v == best[1]) - 1}
        glob["worst_pair"] = {"a": worst[0][0], "b": worst[0][1], "pct": worst[1],
                              "ties": sum(1 for v in pair.values() if v == worst[1]) - 1}
    return per, glob


# ---------------------------------------------------------------------------
# Game state (thread-safe, persisted to JSON)
# ---------------------------------------------------------------------------

class Game:
    def __init__(self, state_file, max_participants, seed=None):
        self.state_file = state_file
        self.max_participants = max_participants
        self.rng = random.Random(seed)
        self.lock = threading.RLock()
        self.public_url = None
        self._reset_fields()
        self._load()

    def _reset_fields(self):
        self.generation = 1
        self.locked = False
        self.participants = {}  # id -> {token, profile, greyed_last, last_seen}
        self.history = []       # one global-stats dict per generation
        self._dirty = True
        self._per = {}

    # -- persistence -------------------------------------------------------
    def _load(self):
        if not os.path.exists(self.state_file):
            return
        try:
            with open(self.state_file) as fh:
                data = json.load(fh)
            self.generation = int(data["generation"])
            self.locked = bool(data["locked"])
            self.participants = {int(k): v for k, v in data["participants"].items()}
            self.history = data.get("history", [])
            for p in self.participants.values():
                assert len(p["profile"]["top"]) == N_COLS
                assert len(p["profile"]["bottom"]) == N_COLS
            log.info("Resumed state: generation %d, %d participants",
                     self.generation, len(self.participants))
        except Exception as exc:  # corrupt state: back it up and start fresh
            backup = f"{self.state_file}.corrupt.{int(time.time())}"
            shutil.copy(self.state_file, backup)
            err_log.error("Corrupt state file (%s); backed up to %s, starting fresh",
                          exc, backup)
            self._reset_fields()

    def _save(self):
        data = {"generation": self.generation, "locked": self.locked,
                "participants": self.participants, "history": self.history}
        tmp = self.state_file + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(data, fh)
        os.replace(tmp, self.state_file)

    def _changed(self):
        self._dirty = True
        self._ensure_stats()
        self._save()

    def _ensure_stats(self):
        if not self._dirty:
            return
        per, glob = compute_stats({i: p["profile"] for i, p in self.participants.items()})
        glob["generation"] = self.generation
        self._per = per
        while len(self.history) < self.generation:
            self.history.append(None)
        self.history[self.generation - 1] = glob
        self._dirty = False

    # -- participant actions -----------------------------------------------
    def _find_token(self, token):
        for pid, p in self.participants.items():
            if p["token"] == token:
                return pid
        return None

    def join(self, token):
        """Returns (status_code, payload)."""
        with self.lock:
            pid = self._find_token(token)
            if pid is not None:
                return 200, {"id": pid}
            if self.generation != 1 or self.locked:
                return 403, {"error": "closed",
                             "message": "Joining is closed: the demonstration has already started."}
            free = [i for i in range(self.max_participants) if i not in self.participants]
            if not free:
                return 409, {"error": "full", "message": "All places are taken."}
            pid = free[0]
            self.participants[pid] = {"token": token, "profile": new_profile(self.rng),
                                      "greyed_last": None, "last_seen": time.time()}
            log.info("Join: id %d", pid)
            self._changed()
            return 200, {"id": pid}

    def me(self, token):
        with self.lock:
            pid = self._find_token(token)
            if pid is None:
                return 404, {"error": "unknown", "joinable": self.generation == 1 and not self.locked}
            p = self.participants[pid]
            p["last_seen"] = time.time()
            self._ensure_stats()
            return 200, {"id": pid, "generation": self.generation,
                         "n_participants": len(self.participants),
                         "profile": p["profile"], "greyed_last": p["greyed_last"],
                         "stats": self._per.get(pid)}

    # -- admin actions -----------------------------------------------------
    def next_generation(self):
        with self.lock:
            for p in self.participants.values():
                p["profile"], p["greyed_last"] = grey_step(p["profile"], self.rng)
            self.generation += 1
            self.locked = True
            log.info("Advanced to generation %d", self.generation)
            self._changed()

    def reset(self):
        with self.lock:
            self._reset_fields()
            log.info("Game reset")
            self._changed()

    def set_locked(self, locked):
        with self.lock:
            self.locked = bool(locked)
            log.info("Joining %s", "locked" if self.locked else "unlocked")
            self._save()

    def remove(self, pid):
        with self.lock:
            if self.participants.pop(pid, None) is not None:
                log.info("Removed id %d", pid)
                self._changed()

    def admin_state(self):
        with self.lock:
            self._ensure_stats()
            now = time.time()
            parts = [{"id": i, "profile": p["profile"],
                      "seen_ago": round(now - p["last_seen"], 1),
                      "stats": self._per.get(i)}
                     for i, p in sorted(self.participants.items())]
            return {"generation": self.generation, "locked": self.locked,
                    "max_participants": self.max_participants,
                    "public_url": self.public_url,
                    "participants": parts, "history": self.history}


# ---------------------------------------------------------------------------
# HTTP layer
# ---------------------------------------------------------------------------

class Handler(SimpleHTTPRequestHandler):
    game = None
    admin_password = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOCS_DIR, **kwargs)

    def log_message(self, fmt, *args):  # keep polling noise out of the log
        log.debug("%s %s", self.address_string(), fmt % args)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def _json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        return json.loads(self.rfile.read(length) or b"{}")

    def _is_admin(self):
        return secrets.compare_digest(self.headers.get("X-Admin-Password", ""),
                                      self.admin_password)

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        if not url.path.startswith("/api/"):
            return super().do_GET()
        try:
            q = parse_qs(url.query)
            if url.path == "/api/me":
                return self._json(*self.game.me(q.get("token", [""])[0]))
            if url.path == "/api/admin/state":
                if not self._is_admin():
                    return self._json(401, {"error": "unauthorized"})
                return self._json(200, self.game.admin_state())
            self._json(404, {"error": "not found"})
        except Exception:
            err_log.exception("GET %s failed", self.path)
            self._json(500, {"error": "server error"})

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self._body()
            if path == "/api/join":
                token = str(body.get("token", ""))
                if not 8 <= len(token) <= 64:
                    return self._json(400, {"error": "bad token"})
                return self._json(*self.game.join(token))
            if not path.startswith("/api/admin/"):
                return self._json(404, {"error": "not found"})
            if not self._is_admin():
                err_log.warning("Rejected admin request from %s", self.address_string())
                return self._json(401, {"error": "unauthorized"})
            if path == "/api/admin/next":
                self.game.next_generation()
            elif path == "/api/admin/reset":
                self.game.reset()
            elif path == "/api/admin/lock":
                self.game.set_locked(body.get("locked", True))
            elif path == "/api/admin/remove":
                self.game.remove(int(body["id"]))
            else:
                return self._json(404, {"error": "not found"})
            self._json(200, {"ok": True})
        except Exception:
            err_log.exception("POST %s failed", self.path)
            self._json(500, {"error": "server error"})


# ---------------------------------------------------------------------------
# Tunnel, logging, main
# ---------------------------------------------------------------------------

def start_tunnel(port, game, binary):
    """Start a cloudflared quick tunnel and record its public URL on the game."""
    try:
        proc = subprocess.Popen([binary, "tunnel", "--no-autoupdate", "--url",
                                 f"http://localhost:{port}"],
                                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    except OSError as exc:
        err_log.error("Could not start cloudflared (%s): %s", binary, exc)
        return None

    def watch():
        for line in proc.stderr:
            m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", line)
            if m and not game.public_url:
                game.public_url = m.group(0)
                log.info("Public URL: %s", game.public_url)
                print(f"\n  Public URL (share this): {game.public_url}\n", flush=True)
        err_log.error("cloudflared exited with code %s", proc.wait())

    threading.Thread(target=watch, daemon=True).start()
    return proc


def setup_logging(log_dir):
    os.makedirs(log_dir, exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    root = logging.getLogger("server")
    root.setLevel(logging.INFO)
    fh = logging.FileHandler(os.path.join(log_dir, "server.log"))
    fh.setFormatter(fmt)
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    root.addHandler(fh)
    root.addHandler(sh)
    eh = logging.FileHandler(os.path.join(log_dir, "error.log"))
    eh.setFormatter(fmt)
    eh.setLevel(logging.WARNING)
    root.addHandler(eh)


def main():
    ap = argparse.ArgumentParser(description="Generations demonstration server")
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--admin-password", default=None,
                    help="password for the admin panel (random if omitted)")
    ap.add_argument("--max-participants", type=int, default=100)
    ap.add_argument("--state-file", default=os.path.join(HERE, "state.json"),
                    help="game state is saved here and resumed on restart")
    ap.add_argument("--log-dir", default=os.path.join(HERE, "logs"))
    ap.add_argument("--seed", type=int, default=None, help="random seed (for testing)")
    ap.add_argument("--tunnel", action="store_true",
                    help="expose the server publicly via a cloudflared quick tunnel")
    ap.add_argument("--cloudflared", default="cloudflared", help="path to cloudflared")
    args = ap.parse_args()

    setup_logging(args.log_dir)
    password = args.admin_password or secrets.token_urlsafe(6)
    shown = {k: ("***" if k == "admin_password" and v else v) for k, v in vars(args).items()}
    log.info("Arguments: %s", shown)

    game = Game(args.state_file, args.max_participants, args.seed)
    Handler.game = game
    Handler.admin_password = password
    # Default listen backlog (5) drops connections when many devices join at once
    ThreadingHTTPServer.request_queue_size = 128
    ThreadingHTTPServer.daemon_threads = True
    server = ThreadingHTTPServer((args.host, args.port), Handler)

    print(f"\n  Participants: http://<this-machine>:{args.port}/")
    print(f"  Admin panel : http://<this-machine>:{args.port}/admin.html")
    if not args.admin_password:
        print(f"  Admin password: {password}")
    print(flush=True)

    tunnel = start_tunnel(args.port, game, args.cloudflared) if args.tunnel else None
    # Treat `kill` like Ctrl+C so the tunnel process is always stopped too
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Shutting down")
    finally:
        if tunnel:
            tunnel.terminate()
        server.server_close()


if __name__ == "__main__":
    main()
