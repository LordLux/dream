# Dream — a cozy card game

A fan-made web adaptation of the card game *Dream* (Little Rocket Games, by
Giampaolo Razzino & Alessia Iorno). Fill your six slots with Dreams before your
opponent does — and send Nightmares to steal theirs.

- **Play Online** — 2 players, peer-to-peer over WebRTC (PeerJS). One player hosts and shares a 5-character room code.
- **Play vs. Bot** — single player.
- **Pass & Play** — 2 players on one device, with a privacy screen between turns.

## Run it

It is a plain static site: no build step, no backend.

```
python -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` directly also works.

## Deploy to GitHub Pages

Push this folder to a repository, then in **Settings → Pages** choose
*Deploy from a branch* and select the branch root. That's it.

To invite a friend straight into the join screen, send them the site URL with
the room code as the hash, e.g. `https://you.github.io/dream/#ABCDE`.

## Custom art

See [`assets/README.md`](assets/README.md).

## Project layout

| Path | What |
| --- | --- |
| `js/engine.js` | Game rules (pure logic, no DOM) |
| `js/bot.js` | Bot opponent |
| `js/art.js` | Built-in SVG card art + custom PNG loader |
| `js/audio.js` | Web Audio sound effects |
| `js/net.js` | PeerJS host/guest link |
| `js/ui.js` | Screens, rendering, input, game modes |
| `tests/engine.test.js` | Rules + bot tests: `node tests/engine.test.js` |

## Rule notes

- Hand limit is 8. With 8 cards you may discard one card as your turn.
- You cannot cover your own REM with a Dream (so you never destroy it by accident).
- REM on the board is immune to Nightmares unless "Nightmares can also steal REM" is switched on in the menu (the host's setting applies online).
