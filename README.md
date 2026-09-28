# Arwin's World of Chance

Live classroom demos on up to 100 devices. Every device gets an ID (0–99) that it keeps in all games.
The admin panel chooses what everyone is playing:

| game | what participants do / see | what the admin sees |
|---|---|---|
| **Welcome** (default) | "Welcome to Arwin's world of Chance, your ID number is N" | the IDs that have joined |
| **Generations** | a 2×50 box "genome" and how related they are to others | controls, charts, all genomes |
| **Birthday paradox** | enter day + month; see which IDs share it | all shared birthdays + theoretical chance |
| **Betting** | pick 0, 1, 2 or 3 (only their own pick is shown) | live counts; type the answer → winning IDs |

## Generations: the model

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

1. Let everyone join; they see the welcome screen with their ID. **Lock joining** stops new devices.
2. Pick a game at the top of the admin panel; all devices switch within ~2 seconds.
3. **Generations:** press **Next generation** to grey out boxes; repeat. **New round** deals fresh
   generation-1 genomes to everyone registered. Devices that join after generation 1 wait for the next round.
   Faded cards are devices that have not checked in for 15 s (e.g. closed tab); **✕** removes one.
4. **Birthday paradox:** participants enter their birthday; **Clear birthdays** empties the list.
5. **Betting:** participants tap a number; **Close betting**, type the correct number and **Reveal** to get
   the winners (revealing also closes betting; reveal again to correct a typo). **New round** clears all bets.
6. **Clear all participants** forgets every device (they rejoin with new IDs) and all game data.

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
