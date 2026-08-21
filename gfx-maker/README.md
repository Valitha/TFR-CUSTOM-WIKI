# TFR GFX Maker (from-scratch alpha v31)

This folder is a new implementation written for the custom wiki project. It does **not** contain CreativeTFR application/source code.

It uses reusable TFR-style template/frame PNGs and the wiki's existing ideology/faction icon library. The generator itself is plain HTML/CSS/JavaScript and does not require npm or a build step.

## Current generators

- Country overview / diplomacy header
- Major event
- Local news
- Super event

Each generator can export a PNG. The country generator also has an editable ideology pie chart, built-in ideology/alliance icon pickers, TFR cursor styling, and click sounds.

## Built-in assets

- Ideology icons: shared from `../assets/icon-library/ideology/`
- Alliance/faction icons: shared from `../assets/icon-library/factions/`
- Default leader: `assets/placeholders/leader_unknown.png`
- Default flag: `assets/placeholders/flag_eu.png`
- Black major/local-news/super-event placeholders supplied for this project
- Unknown national-focus placeholder

## Choosing your own pictures

The site never scans a user's computer. Use the normal **Upload image** buttons and navigate to the pictures you want.

Useful locations inside a local The Fire Rises mod install include:

- `gfx/leaders/` — leader portraits
- `gfx/flags/` — full-size flags (avoid `small/` and `medium/` when possible)
- `gfx/interface/goals/` — national-focus graphics
- `gfx/event_pictures/` — event/news pictures
- `gfx/super_events/` — super-event pictures

Selected images are stored locally in that browser using IndexedDB so they survive a reload. They are not uploaded anywhere by this static site.

## Disclaimer

This is an unofficial fan-made project and is not affiliated with, endorsed by, or operated by The Fire Rises development team or The Fire Rises Wiki.
