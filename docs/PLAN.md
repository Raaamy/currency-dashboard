# Wissel — plan

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
title "Wissel". Scripts: `dev`, `build`, `preview`, `lint`, `format`, `test`,
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

Add `public/icon.svg` (soft apricot rounded square, white "W" in Nunito-like geometry),
generate the icon set with `@vite-pwa/assets-generator`, configure `vite-plugin-pwa`
(autoUpdate, precache app shell, runtime `NetworkFirst` for the three API hosts with a
24 h fallback cache), manifest (name "Wissel", short_name "Wissel", display standalone,
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
