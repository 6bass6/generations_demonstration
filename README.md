# Generations demonstration

A live classroom demo of how shared DNA between relatives decays over generations.
Up to 100 devices join, each gets an ID (0–99) and a 2×50 box "genome".

## The model

- **Generation 1:** in every column the top box is red or green at random (50/50); the bottom box is the other colour.
- **Every next generation:** in every column, the top or the bottom box (50/50) turns grey — DNA from an
  unrelated partner. A box that is already grey can be picked again.
- **Match** between two participants: 1% for every box that has the same colour at the same position.
  Grey never matches (not even grey vs grey).
- **Related:** a match above 0% (at least one shared box).

Each participant sees their ID, their genome, best match (with ID), worst match (with ID), mean match,
and how many others they are still related to. Because *both* people in a pair lose half of their boxes each
generation, the mean match drops about 4× per generation (≈50% → 12% → 3% → 0.8% …); after 5–8
generations only a handful of pairs are still related.

## Running it

Needs only Python 3.10+ (no packages to install).

```bash
python3 server.py --admin-password <choose-one>
```

It prints the participant link and the admin link, e.g. `http://10.96.25.116:8080/`.
That works for devices on the same network. For phones on mobile data / other networks, add `--tunnel`:

```bash
python3 server.py --admin-password <choose-one> --tunnel
```

This starts a free Cloudflare quick tunnel (`cloudflared` must be on the PATH, or pass `--cloudflared /path/to/cloudflared`)
and prints a public `https://….trycloudflare.com` link. The link changes each time the server starts.

Open `/admin.html`, log in, and project the join link / QR code. Then:

1. Let everyone join (generation 1). Joining closes automatically once you go to generation 2
   (you can also lock it manually).
2. Press **Next generation** to grey out boxes; repeat.
3. **Reset** clears everything for a new round (devices rejoin automatically).

Faded cards in the admin panel are devices that have not checked in for 15 s (e.g. closed tab); **✕** removes one.

### Options

| option | default | meaning |
|---|---|---|
| `--port` | 8080 | port to listen on |
| `--host` | 0.0.0.0 | address to listen on |
| `--admin-password` | random (printed) | admin panel password |
| `--max-participants` | 100 | IDs 0 … N-1 |
| `--state-file` | `state.json` | game state; the server resumes from it after a restart |
| `--log-dir` | `logs/` | `server.log` (all events) and `error.log` (warnings/errors) |
| `--seed` | none | fixed random seed (testing) |
| `--tunnel` | off | public link via cloudflared |

## Hosting the pages on GitHub Pages

GitHub Pages can only serve static files, so the server above is always needed to hand out IDs and keep
everyone in sync. The pages are in `docs/`, so you can still publish them via GitHub:

1. Push this repo to GitHub, then *Settings → Pages → Deploy from a branch → `main` / `docs`*.
2. Start the server with `--tunnel` (GitHub Pages is HTTPS, so it needs the HTTPS tunnel link).
3. Open `https://<user>.github.io/<repo>/admin.html?server=<tunnel-link>`. Participants use
   `https://<user>.github.io/<repo>/?server=<tunnel-link>` (note: when the server runs with `--tunnel`,
   the admin panel's join link/QR shows the tunnel link itself, which serves the same pages).

Alternatively put the tunnel link in `docs/js/config.js` so the `?server=` parameter isn't needed.
Simplest of all: skip GitHub Pages and share the tunnel link directly — the server serves the same pages.

## Tests

```bash
python3 -m unittest discover tests
```
