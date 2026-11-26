# Sound credits

Every sound effect in `client3d/src/game/sfx/` is **CC0** (public domain). That means the game can
use them anywhere, including on Steam, and no credit is required. They're listed here anyway so we
always know where each one came from. The file name prefix tells you the source.

| Prefix | Source | License |
| --- | --- | --- |
| `k-impact-…` | Kenney, "Impact Sounds" (kenney.nl) | CC0 |
| `k-rpg-…` | Kenney, "RPG Audio" (kenney.nl) | CC0 |
| `k-plat-…` | Kenney, "Platformer / Digital Audio" packs (kenney.nl) | CC0 |
| `sp-…` | Superpowers sound packs by Pixel-boy / Sparklin Labs (github.com/sparklinlabs/superpowers-asset-packs) | CC0 |
| `beat-snes-…` | Beatscribe, "16-bit (SNES-style) jingles" on OpenGameArt | CC0 |

Mike picked every sound in the Sound Gallery. To swap one, change its name in `PICKS` in
`client3d/src/game/sfx.ts` and drop the new file into the `sfx` folder.

## Music

| File | Where it plays | Source | License |
| --- | --- | --- | --- |
| `client3d/src/game/music/realm-of-exploration.mp3` | Everywhere that has no song of its own (Heartvale, houses, caves) | "Realm of Exploration", the song Mike chose. Made into a seamless loop: the last bar is crossfaded into the first | From Mike. Before the Steam release, write down who made it and its license here |
| `client3d/src/game/music/gregorian-chant.mp3` | Inside the Emberhall | "Gregorian Chant" by Kevin MacLeod (incompetech.com) | CC BY 4.0 |

CC BY means the game **must** credit him wherever the game is shown. The game does this in
⚙️ Settings > 🎶 Credits. The credit line is:

> "Gregorian Chant" Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License
> http://creativecommons.org/licenses/by/4.0/

To add a song for another place, drop the mp3 in `client3d/src/game/music/`, add it to `SONGS` in
`client3d/src/game/music.ts` (places not in `SONGS` play `WORLD_SONG`), and credit it here and in Settings if its license asks for that.
