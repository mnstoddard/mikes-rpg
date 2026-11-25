title: How to update the wiki
category: Wiki
icon: 🛠️
summary: Every game update should update the wiki too. Most of it updates itself.
aliases: Updating the wiki
---
The wiki lives in the game's repository, in the `wiki` folder. It's one web page, `wiki/emberfall-wiki.html`, built from two things.

## 1. Facts from the game (automatic)

Maps, monsters, items, skills, spells, quests, shops, books, the version history and the numbers on the mechanics pages are read straight from the game's code (the `shared` folder). After any change to the game, rebuild the wiki and those pages match the game again. Nobody has to remember to copy numbers across.

To rebuild, run this in the game's folder:

`npm run wiki`

It prints how many pages it made, and lists any links that point to a page that doesn't exist yet.

## 2. The story (written by hand)

Lore, history, places, factions and people are plain text files in `wiki/pages`, one per page. Open one and change the words. The top of each file says the page's title, category and fact box, then a line with three dashes, then the page.

- `[[The Heartfire]]` links to another page. `[[The Heartfire|the land's heart]]` shows different words.
- `## Heading` starts a section.
- A line starting with `- ` is a bullet.
- Put a twist between `::: secret` and `:::` to make a red secret box.

If a written page has the same title as a page made from the game (like [[Old Maren]]), they're joined: the story first, then an "In the game" section with the facts.

## 3. Publishing it

After rebuilding, Claude publishes `wiki/emberfall-wiki.html` to the same Emberfall Wiki link (https://claude.ai/artifact/VCLVMsiJ1uVzdFApngjWJP), so the link never changes. The full guide is `wiki/README.md` in the repository.

## The rule

Every game update that changes something in the world (a new item, monster, quest, person, place, or a change to the story) updates the wiki in the same pull request, the same way it adds a line to the [[Version history]].

## Names

The game's code still uses some old names (Lightkeepers, Kindled, Elderra...). The wiki swaps them for the lore bible's names automatically. See [[Names]].
