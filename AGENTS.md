# AGENTS.md — łokar site

## What this is

Static single-page website (Belarusian game localization portal) at **https://lokar.page/**.
Custom domain via `CNAME`, hosted on GitHub Pages. No build step, no CI, no package.json.

## File structure

- `index.html` — single HTML entry point (SPA with modal).
- `assets/app.js` — vanilla JS: language switcher, game card rendering, modal/carousel.
- `assets/styles.css` — all CSS, mobile-first, no preprocessor.
- `assets/ui.{be,ru,en,pl}.json` — UI text strings per language.
- `assets/games.{be,ru,en,pl}.json` — game catalog data per language.
- `images/` — game covers, screenshots (`images/` subdir per game), store icons.
- `icons/` — favicons + PWA icons (referenced from `site.webmanifest`).

## Adding a game

1. Add entry to **all four** `games.*.json` files (keep in sync).
2. Add cover image + screenshot files to `images/`.
3. Store icons (Steam, GOG, etc.) go in `images/icons/`.
4. `pageUrl` points to a per-game HTML page (`games/*.html`). If absent, the modal still works from the main page.

## i18n conventions

- Language stored in `localStorage` key `"lang"` (default: `"be"`).
- `data-ui="path.to.key"` attributes on HTML elements; text content replaced by `app.js`.
- `data-ui-aria` sets `aria-label`.
- Add new keys to all four `ui.*.json` files.

## Dev workflow

No dev server needed — open `index.html` directly in a browser (or serve with any static server).
All asset paths are root-relative (`/assets/...`, `/images/...`). No build, no watch, no preprocessors.

## Deployment

Push to `main` branch on GitHub; Pages serves from root automatically.
No `gh-pages` branch, no Actions workflow, no build step.
