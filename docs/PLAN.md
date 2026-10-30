# Currency Dashboard — plan

Status legend: `[ ]` pending · `[~]` in progress · `[x]` accepted.
Every brief references `docs/SPEC.md` by section instead of restating it.

## Task 1 — Scaffold `[x]`  (tier: medium, deps: none, nothing runs in parallel)

Create the Vite + React + TypeScript project per SPEC §3/§4 in the repo root. Install
deps (`@fontsource-variable/nunito`, `vite-plugin-pwa`; dev: vitest, jsdom,
@testing-library/react, @testing-library/jest-dom, prettier, @vite-pwa/assets-generator).
Set `base: './'`, strict TS, path alias `@/` -> `src/`. Write `styles/tokens.css` with every
token from SPEC §8 (light on `:root`, dark both under the `prefers-color-scheme` media
query guarded by `:root:not([data-theme="light"])` and under `:root[data-theme="dark"]`,
per SPEC §5), `styles/global.css` (reset, body font Nunito, layout grid with the §8
breakpoints, safe areas, hinge media query, reduced motion). Create `App.tsx` with the
layout shell mounting four placeholder components (`Header`, `ConverterCard`,
`MarketsSection`, `SettingsSheet`) each rendering a labelled empty card so the grid can
be seen. Create `lib/currencies.ts` with the four currencies. Add `index.html` meta:
viewport `viewport-fit=cover`, theme-color for both schemes, apple-mobile-web-app tags,
title "Currency Dashboard". Scripts: `dev`, `build`, `preview`, `lint`, `format`, `test`,
`test:watch`. Update `filemap.md`.
Verify: `npm run build && npm run lint && npm test` pass (one trivial test), `npm run dev`
serves the shell with visible placeholder cards at 390 px and 904 px.

## Task 2 — Data, money and i18n libraries `[x]`  (tier: careful, deps: 1)

Implement `lib/money.ts` (convert, parseAmount, formatMoney, formatNumber, ozToGram,
quantityFor, formatQuantity), `lib/storage.ts`, `data/rates.ts`, `data/markets.ts`,
`data/usePolling.ts`, `state/SettingsContext.tsx` (language, theme, base, amount; applies
`data-theme` on `<html>` and updates `meta[name=theme-color]`), `i18n/*` per SPEC §5,
§6, §7 and the copy table in §8.
Hooks `useRates()` and `useMarkets()` expose `{ data, status: 'idle'|'loading'|'ok'|'stale', error, refresh }`.
Verify: Vitest unit tests for every exported `lib/money.ts` function (including both
decimal separators, thousands separators, empty, negative-rejected, rounding to cents,
quantity ratio and BTC/gram quantity formatting rules), for the cache/stale logic of
`data/rates.ts` with mocked fetch (fresh, cached-fresh, cached-stale-then-fetch-fails,
timeout), for the CoinGecko->Coinbase fallback, for the theme attribute application, and
for the i18n `t()` with placeholders. `npm test`, `npm run lint`, `npm run build` pass.

## Task 3 — Converter card `[x]`  (tier: careful, deps: 2, parallel with 4 and 5)

Build `components/Converter/*` and `components/ui/{Card,SymbolBadge}` exactly per SPEC
§8 "Converter card" and flows §7.2-7.3, using the hooks from task 2. Only touch files
under `components/Converter`, `components/ui/Card*`, `components/ui/SymbolBadge*`, and
the one line in `App.tsx` that mounts `ConverterCard` (already present from scaffold).
The active row owns the input; tapping another row moves the active state without losing
the typed text; highlight animates 200 ms (none under reduced motion). Empty-state
shimmer when no rates. Keyboard: Enter blurs; input `inputmode="decimal"`,
`enterkeyhint="done"`, font >= 16 px.
Verify: component test (typing `1.234,56` with base EUR shows the three other amounts
formatted per language; tapping USD row makes it active and keeps text). Manual check at
390 and 904 px. Lint/build/test pass.

## Task 4 — Markets tiles `[x]`  (tier: medium, deps: 2, parallel with 3 and 5)

Build `components/Markets/*` and `components/ui/{Pill,LiveDot}` per SPEC §8 "Markets
section", using `useMarkets()`, `useRates()` and settings (base, amount) from task 2.
Only touch files under `components/Markets` and the new `components/ui/Pill*`,
`components/ui/LiveDot*`. If you need `Card`/`SymbolBadge` and they do not exist yet,
keep your own minimal styles inside `components/Markets` and note it in the report.
Tiles show the quantity the typed amount buys (BTC / grams), unit price captions in the
base currency, BTC change pill, gold/silver "≈ oz" caption, LiveDot with "ago" text
ticking every 10 s, stale/offline styling.
Verify: component test (given mocked quotes, rates and amount `1250` in base EUR, tiles
show the expected quantities and prices; with empty amount quantities show `0`).
Manual check at 390 and 904 px. Lint/build/test pass.

## Task 5 — Header and settings sheet `[x]`  (tier: medium, deps: 2, parallel with 3 and 4)

Build `components/Header/*` and `components/Settings/*` (SettingsSheet, Segmented) per
SPEC §8 "Header" and "Settings sheet" and flow §7.5-7.6, using settings and `refresh`
from task 2. Only touch files under `components/Header`, `components/Settings`, and the
lines in `App.tsx` that mount `Header` and `SettingsSheet` (already present from
scaffold; wire the open/close state there). Native `<dialog>` with `showModal()`, bottom
sheet under 640 px and centred dialog above, backdrop click and Escape close, segmented
thumb animates 200 ms (none under reduced motion).
Verify: component test (opening the sheet and choosing English changes the header
caption language; choosing Dark sets `data-theme="dark"` on `<html>`). Manual check at
390 and 904 px. Lint/build/test pass.

## Task 6 — PWA, icons, iOS docs `[x]`  (tier: light, deps: 3, 4, 5)

Add `public/icon.svg` (soft apricot rounded square, two opposing horizontal arrows (exchange symbol), white, round caps, stroke ~64 on a 512 grid),
generate the icon set with `@vite-pwa/assets-generator`, configure `vite-plugin-pwa`
(autoUpdate, precache app shell, runtime `NetworkFirst` for the three API hosts with a
24 h fallback cache), manifest (name "Currency Dashboard", short_name "Currency Dashboard", display standalone,
background/theme colors from tokens). Write `docs/IOS.md` per SPEC §9. Update
`filemap.md` and `README.md` (run/build/test in five lines).
Verify: `npm run build` emits `manifest.webmanifest` and `sw.js`; `npm run preview` ->
Lighthouse PWA installable; lint/test pass.

## Review (orchestrator)

After tasks 3-6: run build/lint/test, open preview in the browser at 390x844, 474x696,
904x640 and 1280x800, both color schemes, check every item of SPEC §10, commit.

## Task 7 — Rates tile `[x]`  (tier: medium, deps: 4)

Add the fourth "rates" tile to the markets section per SPEC §8 "Rates tile": 1 unit of
the base currency to the other three, 4 decimals, same card styling as the asset tiles,
shimmer when rates are missing. New i18n key `exchangeRate` in `nl.ts`/`en.ts`.
Verify: component test (base EUR, rates USD 1.1 / GBP 0.85 / AED 4 -> `1,1000 USD`,
`0,8500 GBP`, `4,0000 AED`; base USD -> `0,9091 EUR`), manual check at 390 and 904 px,
lint/build/test pass.

## Task 8 — Daily change percentages `[x]`  (tier: careful, deps: 7)

Add the daily-snapshot source (`data/history.ts`, SPEC §6 last row + "Daily change"),
`rateChangePct` in `lib/money.ts`, a `history` source in `DataContext` (`useHistory()`,
refreshed with the rates, part of `refreshAll` and `InitialData`), i18n key
`sinceYesterday`, then: change text per line in the rates tile, ChangePill for gold and
silver, and the BTC pill falling back to the snapshot change (SPEC §8 "Markets section"
and "Rates tile"). Verify: unit tests for `rateChangePct` (both directions, eur=1,
unchanged -> 0), for the history fetch (latest + previous day, 404 fallback to -2, cache,
CDN -> pages.dev fallback), component tests for the pills/texts with fixed snapshots;
lint/build/test pass; manual check at 390 and 904 px.

## Task 9 — Rename docs to Currency Dashboard `[x]`  (tier: light, deps: 8)

Product name "Wissel" -> "Currency Dashboard" in all docs; header without title, English default,
rates tile first, exchange-arrows icon recorded in SPEC.

## Task 10 — English default, no title, rates first `[x]`  (tier: medium, deps: 8)

Code side of the rename: remove the header `<h1>`, English as default language with a one-time
settings migration (version 2), rates tile first in the markets section, `<title>`, manifest,
apple-mobile-web-app-title and package name "Currency Dashboard" / `currency-dashboard`, new
exchange-arrows icon regenerated. Verify: lint/build/test pass, manual check at 390 and 904 px.

## Task 11 — Remove settings, English UI, Dutch numbers `[x]`  (tier: careful, deps: 10)

Delete the settings button and sheet; English-only copy; all numbers in nl-NL notation with
English dates; light/dark from the system only; settings v3 = { base, amount }. Verify:
lint/build/test pass; browser check at 390 and 904 px in light and dark.

## Task 12 — Adaptive layout, no truncation `[x]`  (tier: careful, deps: 11)

Two columns only from 900 px; markets grid 1-up / 2-up by container width (560 px);
row vs stacked tile layout by tile width (340 px) for asset and rates tiles; converter
input size by card width (480 px). SPEC §8 "Responsive / foldable". Verify: lint/build/test
pass; every reference viewport (390x844, 474x696, 680x470, 680x900, 904x640, 1280x800) with
amounts 1250 and 10000 shows no truncated text (scripted check: no element with
`scrollWidth > clientWidth` inside tiles/rows) and no horizontal page overflow.
