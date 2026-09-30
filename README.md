# Arwin's World of Chance

Live classroom demos on up to 100 devices. Every device gets an ID (0–99) that it keeps in all games.
The admin panel chooses what everyone is playing:

| game | what participants do / see | what the admin sees |
|---|---|---|
| **Welcome** (default) | "Welcome to Arwin's world of Chance, your ID number is N" | the IDs that have joined |
| **Generations** | a 2×50 box "genome" and how related they are to others | controls, charts, all genomes |
| **Birthday paradox** | enter day + month; see which IDs share it | all shared birthdays + theoretical chance |
| **Betting** | pick 0, 1, 2 or 3 (only their own pick is shown) | live counts; type the answer → winning IDs |
| **Y-STR** | one block per Y-STR marker, their changed markers, how many others share their haplotype | panel switch, generations, % still identical to the start, differentiated IDs |

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

## Y-STR: the model

- Two panels: **PowerPlex Y23** (22 blocks; DYS385 is one block) and **RMplex** (30 blocks), with a
  per-generation mutation rate per marker (the tables are in `YSTR_PANELS` in `server.py`).
- **Generation 0:** every participant is an independent male line with the same starting haplotype:
  allele 10 on every marker.
- **Every next generation:** each marker of each participant goes up one repeat with probability rate/2
  (red) or down one with probability rate/2 (green). Alleles keep changing, so 10 → 11 → 12 or back to 10
  is possible; a block at 10 is plain again.
- Participants see their blocks, their changed markers with name and allele (e.g. `DYS458: 11`) and the
  number of **other** participants with exactly the same haplotype.
- The admin sees the % of participants still identical to the starting haplotype and the IDs that differ,
  with their changed markers. Per generation about 8% of men get at least one mutation on PowerPlex Y23 and about 45% on RMplex.

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

To keep the **same link across server restarts**, run the tunnel on its own and tell the server its link:

```bash
nohup cloudflared tunnel --no-autoupdate --url http://localhost:8080 > logs/tunnel.log 2>&1 &
grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' logs/tunnel.log | head -1     # the public link
python3 server.py --admin-password <choose-one> --public-url https://….trycloudflare.com
```

Now the server can be stopped and restarted freely; the link only changes when the tunnel itself stops
(e.g. a reboot). Stop the tunnel with `kill <PID>` (find it with `pgrep -ax cloudflared`).

Open `/admin.html`, log in, and project the join link / QR code. Then:

1. Let everyone join; they see the welcome screen with their ID. **Lock joining** stops new devices.
2. Pick a game at the top of the admin panel; all devices switch within ~2 seconds.
3. **Generations:** press **Next generation** to grey out boxes; repeat. **New round** deals fresh
   generation-1 genomes to everyone registered. Devices that join after generation 1 wait for the next round.
   Faded cards are devices that have not checked in for 15 s (e.g. closed tab); **✕** removes one.
4. **Birthday paradox:** participants enter their birthday; **Clear birthdays** empties the list.
5. **Betting:** participants tap a number; **Close betting**, type the correct number and **Reveal** to get
   the winners (revealing also closes betting; reveal again to correct a typo). **New round** clears all bets.
6. **Y-STR:** choose **PowerPlex Y23** or **RMplex** (switching restarts at generation 0), then press
   **Next generation**; **Restart** sends everyone back to allele 10. Devices that join after generation 0
   wait for the next round.
7. **Clear all participants** forgets every device and all game data. Open pages show "The game was reset"
   and stop; a device only rejoins (with a new ID) when the link/QR code is scanned again or the page is reloaded.

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
| `--tunnel` | off | public link via cloudflared (new link on every start) |
| `--public-url` | none | link of a tunnel you run yourself; shown in the admin panel (not with `--tunnel`) |

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
