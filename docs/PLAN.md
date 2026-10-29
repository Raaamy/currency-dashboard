# Wissel — plan

Status legend: `[ ]` pending · `[~]` in progress · `[x]` accepted.
Every brief references `docs/SPEC.md` by section instead of restating it.

## Task 1 — Scaffold `[ ]`  (tier: medium, deps: none, nothing runs in parallel)

Create the Vite + React + TypeScript project per SPEC §3/§4 in the repo root. Install
deps (`@fontsource-variable/nunito`, `vite-plugin-pwa`; dev: vitest, jsdom,
@testing-library/react, @testing-library/jest-dom, prettier, @vite-pwa/assets-generator).
Set `base: './'`, strict TS, path alias `@/` -> `src/`. Write `styles/tokens.css` with every
token from SPEC §8 (light + dark via `prefers-color-scheme`), `styles/global.css` (reset,
body font Nunito, layout grid with the §8 breakpoints, safe areas, hinge media query,
reduced motion). Create `App.tsx` with the layout shell mounting three placeholder
components (`Header`, `ConverterCard`, `MarketsSection`) each rendering a labelled
empty card so the grid can be seen. Create `lib/currencies.ts` with the four currencies.
Add `index.html` meta: viewport `viewport-fit=cover`, theme-color for both schemes,
apple-mobile-web-app tags, title "Wissel". Scripts: `dev`, `build`, `preview`, `lint`,
`format`, `test`, `test:watch`. Update `filemap.md`.
Verify: `npm run build && npm run lint && npm test` pass (one trivial test), `npm run dev`
serves the shell with visible placeholder cards at 390 px and 904 px.

## Task 2 — Data, money and i18n libraries `[ ]`  (tier: careful, deps: 1)

Implement `lib/money.ts` (convert, parseAmount, formatMoney, formatNumber, ozToGram),
`lib/storage.ts`, `data/rates.ts`, `data/markets.ts`, `data/usePolling.ts`,
`state/SettingsContext.tsx`, `i18n/*` per SPEC §5, §6, §7 and the copy table in §8.
Hooks `useRates()` and `useMarkets()` expose `{ data, status: 'idle'|'loading'|'ok'|'stale', error, refresh }`.
Verify: Vitest unit tests for every exported `lib/money.ts` function (including both
decimal separators, thousands separators, empty, negative-rejected, rounding to cents),
for the cache/stale logic of `data/rates.ts` with mocked fetch (fresh, cached-fresh,
cached-stale-then-fetch-fails, timeout), for the CoinGecko->Coinbase fallback, and for the
i18n `t()` with placeholders. `npm test`, `npm run lint`, `npm run build` pass.

## Task 3 — Converter card `[ ]`  (tier: careful, deps: 2, parallel with 4)

Build `components/Converter/*` and `components/ui/{Card,SymbolBadge}` exactly per SPEC
§8 "Converter card" and flows §7.2-7.3, using the hooks from task 2. Only touch files
under `components/Converter`, `components/ui`, and the one line in `App.tsx` that mounts
`ConverterCard` (already present from scaffold). The active row owns the input; tapping
another row moves the active state without losing the typed text; highlight animates
200 ms (none under reduced motion). Empty-state shimmer when no rates. Keyboard: Enter
blurs; input `inputmode="decimal"`, `enterkeyhint="done"`, font >= 16 px.
Verify: component test (typing `1.234,56` with base EUR shows the three other amounts
formatted per language; tapping USD row makes it active and keeps text). Manual check at
390 and 904 px. Lint/build/test pass.

## Task 4 — Header, markets tiles, language toggle `[ ]`  (tier: medium, deps: 2, parallel with 3)

Build `components/Header/*`, `components/Markets/*`, `components/ui/{Pill,LiveDot}` per
SPEC §8 "Header" and "Markets section", using `useMarkets()`, `useRates()` and settings
from task 2. Only touch files under `components/Header`, `components/Markets`,
`components/ui` (new files only; `Card` and `SymbolBadge` belong to task 3, if you need
them and they do not exist yet, create minimal versions in your own files and note it).
Header shows "updated" caption and refresh button; language pill toggles settings.
Tiles show prices in the base currency, BTC change pill, gold/silver per-ounce and
per-gram captions, LiveDot with "ago" text ticking every 10 s, stale/offline styling.
Verify: component test (given mocked quotes and rates in base EUR, tiles show expected
formatted prices; toggling language changes labels). Manual check at 390 and 904 px.
Lint/build/test pass.

## Task 5 — PWA, icons, iOS docs `[ ]`  (tier: light, deps: 3, 4)

Add `public/icon.svg` (soft apricot rounded square, white "W" in Nunito-like geometry),
generate the icon set with `@vite-pwa/assets-generator`, configure `vite-plugin-pwa`
(autoUpdate, precache app shell, runtime `NetworkFirst` for the three API hosts with a
24 h fallback cache), manifest (name "Wissel", short_name "Wissel", display standalone,
background/theme colors from tokens). Write `docs/IOS.md` per SPEC §9. Update
`filemap.md` and `README.md` (run/build/test in five lines).
Verify: `npm run build` emits `manifest.webmanifest` and `sw.js`; `npm run preview` ->
Lighthouse PWA installable; lint/test pass.

## Review (orchestrator)

After tasks 3-5: run build/lint/test, open preview in the browser at 390x844, 474x696,
904x640 and 1280x800, both color schemes, check every item of SPEC §10, commit.
