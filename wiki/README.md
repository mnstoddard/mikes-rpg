# The Emberfall Wiki

A linked, Wikipedia-style wiki for the team: the lore, and how the game actually works.
It's one web page, `emberfall-wiki.html`, published (privately) at
https://claude.ai/artifact/VCLVMsiJ1uVzdFApngjWJP. Always republish to that same link.

## Rebuild it

```
npm run wiki
```

This reads the game's code and the written pages and writes `wiki/emberfall-wiki.html`.
It prints how many pages it made and any links to pages that don't exist yet.

## What's in here

| File | What it is |
|---|---|
| `pages/*.md` | Hand-written pages: lore, history, places, factions, people, the story plan. One page per file. Edit freely. |
| `build.ts` | Makes the game pages from `shared/` (monsters, items, skills, spells, quests, shops, books, version history, mechanics) and joins everything up. |
| `template.html` | The wiki's look and behaviour (search, categories, secrets toggle). |
| `emberfall-wiki.html` | The built wiki. Don't edit by hand; rebuild it. |

## Writing a page

The top of each `.md` file is its header, then a line of three dashes, then the page:

```
title: The Heartfire
category: Lore
icon: ❤️‍🔥
aliases: Heartfire, Wellspring
summary: One line under the title.
infobox.Where: Deep under [[Heartvale]]
---
The page. [[Link to a page]] or [[Link to a page|with other words]].

## A section

- A bullet

::: secret
A twist players shouldn't learn early. Shown in a red box; readers can hide them all.
:::
```

Categories in the sidebar: Wiki, Lore, History, Story, Places, Factions, People, Quests,
Skills, Spells, Monsters, Items, Mechanics, Books, Updates.

If a written page has the same title as a game page (a person, a place, a skill), the two are
joined: the written story first, then an "In the game" section with the facts.

## Names

Since version 0.10 the game uses the lore bible's names. `RENAMES` in `build.ts` lists the
old names (the Names page shows them) and still swaps any that slip back into the game's text.
When a name changes, change it in the game's text and the wiki together, and add the old name
to `RENAMES`. Ids inside the code (`lighthall`, `soul_trap`...) keep their old spelling so
saved games keep working.

## The rule

Every update that changes something in the world (new item, monster, quest, person, place,
skill or story change) updates the wiki in the same pull request, like the version history.
