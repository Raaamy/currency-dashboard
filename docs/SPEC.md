# Currency Dashboard — specification

A soft, modern currency converter for the phone. One screen: convert an amount between
EUR, USD, GBP and AED, and glance at live Bitcoin, gold and silver prices. Built with
browser technology, shaped so it drops into a native iOS shell (Capacitor) later, and
laid out for the foldable iPhone (narrow outer screen, near-square inner screen).

## 1. Goals

- Type one amount, see it in all four currencies at once. Tap any currency to make it
  the input currency.
- Live-ish prices for Bitcoin, gold and silver, shown in the selected currency, plus
  how much Bitcoin / gold / silver the typed amount buys (updates as you type).
- A quiet header without a brand/title: only the "rates updated" caption and the refresh
  button.
- Looks calm and friendly: warm neutrals, rounded surfaces, generous spacing, one soft
  accent. Never a "trading terminal".
- Works on the outer and inner screen of a foldable iPhone, and on any ordinary phone
  or desktop browser.
- UI copy in English; numbers in Dutch notation (nl-NL); light/dark follows the system.
- Installable as a PWA today; portable to Capacitor/iOS in a handful of commands.

## 2. Non-goals (MVP)

- No accounts, no server, no analytics.
- (Superseded) The fixed four-currency list is replaced by user-chosen currencies, see §11.
- No historical charts, no alerts, no portfolio.
- No Capacitor packages installed yet; only the documented path (`docs/IOS.md`).

## 3. Stack (pinned at scaffold time to current stable)

- Node 22, npm.
- Vite 7 + React 19 + TypeScript 5 (strict). Static SPA, no SSR, no router.
- Styling: plain CSS with custom properties (design tokens) and CSS modules per
  component. No Tailwind, no CSS-in-JS. Keeps the bundle small and WKWebView-friendly.
- Font: `@fontsource-variable/nunito` (self-hosted, works offline and inside Capacitor).
- PWA: `vite-plugin-pwa` (auto update, precache app shell), `@vite-pwa/assets-generator`
  for icons from `public/icon.svg` ("Two coins": a navy € coin behind an apricot `#f2a66b` $
  coin, Nunito 900 glyphs as paths, on a `#262422` rounded square; apple and maskable full bleed).
- Tests: Vitest (+ jsdom, @testing-library/react for the few component tests).
- Lint/format: ESLint (Vite's React TS config) + Prettier.
- State: React hooks + one context. No state library.

## 4. Architecture

```
src/
  main.tsx                 bootstrap, PWA registration
  App.tsx                  layout shell: Header, ConverterCard, MarketsSection
  styles/tokens.css        design tokens (colors, radii, shadows, type scale), light + dark
  styles/global.css        reset, body, layout grid, breakpoints, safe areas, foldable
  lib/currencies.ts        CURRENCIES list (code, symbol, names nl/en, decimals, tint)
  lib/money.ts             convert(), parseAmount(), formatMoney(), formatNumber(), ozToGram(), quantityFor(), formatQuantity()
  lib/storage.ts           typed localStorage get/set with namespacing `wissel.*`
  data/rates.ts            fetch + cache fiat rates (open.er-api)
  data/markets.ts          fetch BTC (CoinGecko -> Coinbase fallback), XAU/XAG (gold-api)
  data/usePolling.ts       interval that pauses when document is hidden
  state/SettingsContext.tsx base currency, amount; persisted
  i18n/en.ts, index.ts     English copy + t() / useT()
  components/TopBar/       refresh, "Rates updated", live status, unit toggle slot
  components/Convert/      ConvertCard, AmountInput, TapHint, UnitToggle
  components/Results/      Results, ResultItem (card grid / list rows, tap to convert)
  components/Edit/         EditList, EditRow (remove + dnd-kit reorder of all items)
  components/Picker/       ItemPicker (assets, popular, all currencies; search)
  components/ui/           SymbolBadge, ItemBadge, Pill, LiveDot, Segmented, EditButton,
                           AddButton, useElementWidth (shared primitives)
```

Responsibilities:

- `data/*` knows URLs, response shapes, caching and fallbacks. Returns typed plain
  objects. Never touches React (except the thin hooks `useRates`/`useMarkets`).
- `lib/*` is pure and unit-tested: conversion math, number parsing/formatting.
- `state/*` is the only place that reads/writes persisted settings.
- `components/*` render; they get data via hooks and never fetch directly.

## 5. Data model

```ts
type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'AED';

interface Currency {
  code: CurrencyCode;
  symbol: string;              // EUR: €  USD: $  GBP: £  AED: د.إ
  name: { nl: string; en: string };
  decimals: number;            // 2 for all four
  tint: string;                // token name for its badge background
}

interface Rates {
  base: 'EUR';
  rates: Record<CurrencyCode, number>;  // units of currency per 1 EUR; EUR = 1
  fetchedAt: number;           // ms epoch, when we fetched
  publishedAt: number;         // ms epoch, provider's time_last_update_unix * 1000
}

interface MarketQuote {
  id: 'BTC' | 'XAU' | 'XAG';
  priceUsd: number;            // always normalised to USD
  change24hPct?: number;       // only BTC has it
  updatedAt: number;           // ms epoch
}

interface Settings {
  base: CurrencyCode;          // the input currency
  amount: string;              // raw input text, so the user sees what they typed
}
```

Stored as `{ base, amount, version: 3 }` under `wissel.settings`. `base` and `amount` are
validated and kept from any stored version; `language` / `theme` fields left by older
versions (v1/v2) are ignored and dropped on the next write. Storage keys keep the historical
`wissel.` prefix.

Dark mode: `@media (prefers-color-scheme: dark)` only (`tokens.css` light values on
`:root`, dark values under `@media (prefers-color-scheme: dark) { :root }`).

Conversion: `convert(amount, from, to, rates) = amount / rates[from] * rates[to]`.
Metals and BTC: provider gives USD; display in base via `convert(priceUsd, 'USD', base, rates)`.
Gold/silver per gram = per troy ounce / 31.1034768.
Quantity the typed amount buys: `quantity = convert(amount, base, 'USD', rates) / priceUsd`
(in BTC, or in troy ounces; grams = ounces * 31.1034768).

## 6. External integrations (all free, no key, CORS `*`; verified 2026-10-29)

| Data | Primary | Fallback | Refresh |
|------|---------|----------|---------|
| Fiat rates (EUR base, has AED) | `https://open.er-api.com/v6/latest/EUR` -> `rates`, `time_last_update_unix` | cached copy in localStorage | on load if cache older than 6 h; on `visibilitychange` to visible |
| Bitcoin | `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true` -> `bitcoin.usd`, `bitcoin.usd_24h_change` | `https://api.coinbase.com/v2/prices/BTC-USD/spot` -> `data.amount` (no change %) | every 60 s while visible |
| Gold | `https://api.gold-api.com/price/XAU` -> `price` (USD per troy oz), `updatedAt` | cached copy | every 60 s while visible |
| Silver | `https://api.gold-api.com/price/XAG` -> same shape | cached copy | every 60 s while visible |
| Daily snapshots (for "change since yesterday") | `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{latest\|YYYY-MM-DD}/v1/currencies/eur.min.json` -> `{ date, eur: { usd, gbp, aed, xau, xag, btc, ... } }` (units per 1 EUR; `xau`/`xag` are troy ounces per EUR, `btc` bitcoin per EUR) | `https://{latest\|YYYY-MM-DD}.currency-api.pages.dev/v1/currencies/eur.min.json` | with the fiat rates (6 h, visible) |

Daily change: fetch `latest` (gives `date`), then the snapshot of `date - 1 day` (if that
404s, try -2 and -3). `rateChangePct(today, previous, from, to)` = change of the
quantity "units of `to` per 1 `from`" = `((today[to]/today[from]) / (previous[to]/previous[from]) - 1) * 100`,
with `eur = 1`. Rates tile line `base -> code` uses `rateChangePct(base, code)`; an asset's
price in base uses `rateChangePct(asset, base)`. Both snapshots are cached (`wissel.history`).

Rules:
- Every fetch has an 8 s timeout (`AbortController`). Failure never clears the last good
  value; the UI shows the cached value plus a small "offline / stale" hint.
- Last good values are persisted (`wissel.rates`, `wissel.markets`) so a cold start
  shows numbers immediately.
- Polling stops when `document.hidden`, restarts on visible (immediate refresh).
- Rate limits: CoinGecko free tier is ~30 req/min; we do 1/min. Never retry in a loop.

## 7. Key user flows

1. **Open app** -> cached numbers render instantly, then refresh. Amount input is focused
   on desktop, not on mobile (avoid keyboard jump).
2. **Type an amount** in the active row -> the other three rows update live. Input
   accepts `1.234,56` and `1,234.56` and `1234.56`; comma or dot as decimal is inferred
   (the last separator in the string is the decimal separator; if only one kind of
   separator appears and it appears more than once, it is a thousands separator). Empty
   input shows `0` in the other rows, greyed.
3. **Tap another currency row** -> it becomes the base; the typed amount stays as-is
   (it now means that currency). The active highlight moves with a 200 ms ease.
4. **Markets** show, per asset, how much of it the typed amount buys (big number) and
   the unit price in the current base currency (caption). Typing updates the quantities
   live; changing the base currency updates both. Empty amount -> quantity shows `0`
   greyed, price caption stays.

Appearance follows the system color scheme; there is no in-app setting.

## 8. Design

### Direction
"Soft, warm, modern." Think a well-made notes app, not a trading screen. Warm off-white
canvas, white rounded cards, one apricot accent, sage/rose only for up/down. Nunito
(rounded humanist sans) at generous sizes; numbers use `font-variant-numeric:
tabular-nums`. Lots of air: 20-24 px card padding, 12 px between rows.

### Tokens (light / dark)

| Token | Light | Dark |
|-------|-------|------|
| `--bg` | `#F6F3EE` | `#1C1A18` |
| `--surface` | `#FFFFFF` | `#272421` |
| `--surface-2` (active row) | `#FBF1E8` | `#332A22` |
| `--text` | `#2B2824` | `#F3EFE9` |
| `--text-2` | `#8A827A` | `#A49C92` |
| `--line` | `rgba(43,40,36,.07)` | `rgba(255,255,255,.07)` |
| `--accent` | `#E59A66` | `#EFAE7E` |
| `--accent-soft` | `#FBEADF` | `#3D2E22` |
| `--up` / `--up-soft` | `#4F9E78` / `#E4F2EA` | `#7CC7A1` / `#1F352B` |
| `--down` / `--down-soft` | `#D47A7A` / `#F9E6E6` | `#E79A9A` / `#3A2626` |
| `--tint-eur` | `#E7ECF8` | `#283046` |
| `--tint-usd` | `#E4F2EA` | `#1F352B` |
| `--tint-gbp` | `#F3E6F2` | `#36283A` |
| `--tint-aed` | `#FBEADF` | `#3D2E22` |
| `--tint-btc` | `#FDE7D3` | `#45301C` |
| `--tint-gold` | gradient `#F7E3A1 -> #E9C25A` | `#D8B24E -> #9A7A2C` |
| `--tint-silver` | gradient `#EEF0F3 -> #C9CFD8` | `#C3C9D2 -> #7E8792` |
| `--radius-card` | 24 px | |
| `--radius-row` | 16 px | |
| `--radius-pill` | 999 px | |
| `--shadow-card` | `0 10px 30px rgba(43,40,36,.06)` | `0 10px 30px rgba(0,0,0,.35)` |

Type scale: display 40/44 800 (amount input), title 22/28 800, row 17/22 600,
amount 20/24 700 tabular, caption 13/18 500, micro 11/14 600 uppercase tracking .04em.

### Screen: Dashboard (the only screen)

**Header** (no card): only the caption row (`--font-caption`, `--text-2`) with the 32 px
refresh icon button (tap = refresh everything) and "Rates updated 29 Oct, 02:02";
`display: flex; align-items: center; min-height: 44px`. No `<h1>`; the page title lives in
`<title>` only.

**Converter card** (`--surface`, `--radius-card`, `--shadow-card`, padding 20):
- Micro label "CONVERT".
- Four rows, 64 px tall, `--radius-row`. Each row: 40 px SymbolBadge (tinted circle,
  symbol 18/800) · code 17/700 + name 13 caption stacked · amount right-aligned 20/700
  tabular.
- Active row: `--surface-2` background, 1 px `--accent` at 30 % border, the amount is an
  `<input inputmode="decimal">` styled as text (display size 28/800 on narrow, 32 on
  wide), caret `--accent`. Inactive rows are buttons; whole row tappable; hover/press
  lightens to `--line`.
- Empty state (no rates yet, no cache): rows show "—" and a soft shimmer.

**Markets section** below (narrow) or right column (wide):
- No visible heading (the section has `aria-label` "Markets"); the live/offline status line
  (LiveDot + caption, e.g. "live · 12s ago" or cloud-off + "offline") is centred below the
  tiles.
- The rates tile followed by three MarketTiles, gap 10, in the markets grid (see
  "Responsive / foldable" for the grid and the row/stacked tile layouts). Row layout tile:
  card styling, `--radius-row` + 4 px (20 px), padding 14 16; layout = badge · texts ·
  right-aligned numbers:
  - 38 px badge (BTC: `--tint-btc` with ₿; gold/silver: metallic gradient circle, no
    glyph).
  - texts: name 16/700 ("Bitcoin"/"Gold"/"Silver"); caption 13 = unit price in base
    currency: BTC "€ 63.209 per bitcoin"; gold/silver "€ 116,03 per gram" with a second
    caption "€ 3.608,95 per troy ounce".
  - numbers (right): quantity the typed amount buys, 20/800 tabular, with unit:
    BTC "0,01978 BTC"; gold/silver in grams "10,77 g" (ounces not shown as quantity).
    Under it: BTC -> ChangePill (`−3,1 %`, up/down soft pill; CoinGecko 24 h, falling
    back to the daily-snapshot change when CoinGecko's figure is missing); gold/silver ->
    one row `≈ 0,346 oz` caption followed by the same ChangePill with the daily-snapshot
    change of the asset's price in the base currency (pill omitted while no snapshots).
    Every pill carries `title`/`aria-label` "t.o.v. gisteren" / "vs yesterday".
  - Quantity formatting: BTC = up to 5 significant digits, max 8 decimals, trailing
    zeros stripped (`0,01978`, `1,2345`, `12,5`); grams = 2 decimals under 100, else 0.
  - Empty/zero amount: quantity `0 BTC` / `0 g` in `--text-2`.
- Stale/offline: tile shows a small cloud-off glyph next to the timestamp, numbers dim
  to 70 %.
- **Rates tile**: superseded by the chip grid in §11 "Rates tile (chip grid)"; the text
  below describes the previous three-line version and is kept for history only.
  (old) (first tile, above Bitcoin, same card styling): left a 38 px SymbolBadge
  of the base currency; texts: `1 EUR` (16/700, the base code) with caption
  "Wisselkoers" / "Exchange rate"; right column: one line per other currency in
  `CURRENCIES` order, `0,8373 GBP` style: value 17/700 tabular (4 decimals,
  `formatNumber`) followed by the code 13/600 in `--text-2`, right-aligned, lines 2 px
  apart. Values are `convert(1, base, code, rates)`. No rates -> `—` and shimmer. Follows
  the base currency: with USD as base it shows 1 USD to EUR, GBP, AED. After the code,
  the daily change `rateChangePct(base, code)` as plain text 13/700 in `--up` (> 0),
  `--down` (< 0) or `--text-2` (0), formatted with `formatPercent`, `min-width: 4.2em`
  right-aligned so the three lines align; omitted while no snapshots are known.

### Responsive / foldable

Rule: no text is ever cut off. Layout decisions use the space a component actually
gets (container queries, `container-type: inline-size`), not only the viewport.

- `< 900 px` wide (phones, foldable outer screen, foldable inner screen ~680 px in
  either orientation): single column, 16 px gutters (24 px from 640 px), card stack.
- `>= 900 px` (tablets landscape, desktop): two columns `1.15fr 1fr`, gap 24, content
  max-width 1040 centred, 24 px gutters. Converter left, markets right.
- **Markets grid** (container `markets` on the section): one tile per row below 560 px
  of section width; `repeat(2, minmax(0, 1fr))` from 560 px (so the foldable inner
  screen shows a 2x2 grid). Status line spans the full width below.
- **Tile layouts** (container `tile` on every tile, rates tile included):
  - *Row* (tile >= 340 px): badge · texts · right-aligned numbers, as described above.
  - *Stacked* (tile < 340 px): line 1 = 32 px badge + name (16/700, may wrap to two
    lines, never ellipsis) + the change pill pushed to the right (BTC/metals); line 2 =
    the quantity 22/800 tabular; then the captions, each on its own line, wrapping
    allowed (unit price per bitcoin; per gram; per troy oz; `≈ 0,346 oz`). Rates tile
    stacked: line 1 = badge + `1 EUR` with "Exchange rate" caption under it; then the
    three lines full width as a 3-column grid (value right-aligned, code, change
    right-aligned).
  - In both layouts the texts column keeps a minimum of its longest word; numbers never
    shrink below their content; if the row layout cannot honour that, it is the stacked
    layout's job (choose the 340 px threshold accordingly and adjust it if a measured
    case still truncates).
- **Converter rows**: the amount input is 28/32 px; it grows to 32/36 px only when the
  card is >= 480 px wide (container query on the card), not by viewport width. The
  currency name (caption) may ellipsize only below 300 px of row width; at every layout
  in this spec it must be fully visible.
- Reference viewports that must show every text in full: 390x844, 474x696 (foldable
  outer), 680x470 and 680x900 (foldable inner, landscape/portrait), 904x640, 1280x800,
  each with amounts `1250` and `10000`.
- Safe areas: `viewport-fit=cover`, padding with `env(safe-area-inset-*)`.
- Foldable hinge: `@media (horizontal-viewport-segments: 2)` sets the two-column gap to
  span the fold using `env(viewport-segment-left 1 0) - env(viewport-segment-right 0 0)`.
  Progressive enhancement; ignored elsewhere.
- Motion: 200 ms ease for highlight moves and number changes; respects
  `prefers-reduced-motion`.
- Touch targets >= 44 px. Inputs 16 px+ font so iOS does not zoom.

### Copy (en)

| key | en |
|-----|----|
| convert | Convert |
| markets | Markets |
| updated | Rates updated {time} |
| live | live · {ago} |
| ago.s / ago.m | {n}s ago / {n} min ago |
| offline | Offline, showing last rates |
| perOunce | per troy oz |
| perGram | per gram |
| perBitcoin | per bitcoin |
| exchangeRate | Exchange rate |
| sinceYesterday | vs yesterday |
| approxOz | ≈ {n} oz |
| refresh | Refresh |
| cur.EUR | Euro |
| cur.USD | US dollar |
| cur.GBP | British pound |
| cur.AED | UAE dirham |
| asset.BTC / XAU / XAG | Bitcoin / Gold / Silver |

Number formatting: Text in English (en-GB dates: `29 Oct, 01:02`); all numbers in Dutch
notation via `nl-NL`: `1.250,00`, currencies with `currencyDisplay: 'narrowSymbol'`
(`€ 1.250,00`, `$ 1.393,20`), percentages `−3,1%`. 2 decimals for fiat, 0 for BTC, 2 for
metals.

## 9. iOS path (documented, not executed)

`docs/IOS.md` lists the exact commands: install `@capacitor/core @capacitor/cli
@capacitor/ios`, `npx cap init`, `npm run build`, `npx cap add ios`, `npx cap open ios`,
plus status-bar/safe-area notes. Constraints kept now so that works unchanged: static
`dist/`, relative asset base (`base: './'`), fetch-only networking to CORS-open hosts,
no `window.location` routing.

## 10. Definition of done (MVP)

- `npm run build`, `npm run lint`, `npm test` all pass.
- Dashboard renders live numbers for the four currencies and the three assets within
  2 s on a normal connection; cached numbers render instantly on reload.
- Conversion matches `amount / rate[from] * rate[to]` to the cent in tests.
- English copy, Dutch number notation, system light/dark.
- Typing an amount updates the BTC / gold / silver quantities to the correct ratio
  (tested against `convert(amount, base, 'USD') / priceUsd`).
- Layout verified at 390x844 (phone), 474x696 (foldable outer), 904x640 (foldable inner,
  open) and 1280x800 (desktop): no horizontal scroll, no clipped text, no overlap.
- Dark mode has no unreadable contrast (text on surface >= 4.5:1).
- PWA installable (manifest + icons + service worker), Lighthouse PWA checks pass.

## 11. User-chosen currencies (supersedes the fixed four)

### Model
- Any currency that open.er-api returns (~160 ISO codes) can be chosen. `Rates.rates`
  keeps every code from the response (`Record<string, number>`, EUR = 1); the history
  snapshots keep every 3-letter fiat key present in the response (lower-case).
- `src/lib/currencies.ts` becomes a registry: `getCurrency(code): Currency` builds
  `{ code, symbol, name, decimals, tint }` on demand: `name` from
  `new Intl.DisplayNames(['en'], { type: 'currency' })`, falling back to the code;
  `symbol` from `Intl.NumberFormat('nl-NL', { style: 'currency', currency: code,
  currencyDisplay: 'narrowSymbol' })` parts, falling back to the code; `decimals` from
  that formatter's `resolvedOptions().maximumFractionDigits` (JPY 0, EUR 2, KWD 3).
  Hand-tuned overrides stay for EUR, USD, GBP, AED (symbol + their named tints).
  `POPULAR = [EUR, USD, GBP, AED, CHF, JPY, CNY, CAD, AUD, TRY, SAR, INR, SEK, NOK, DKK,
  PLN, THB, SGD, HKD, ZAR]`.
- Tints: EUR/USD/GBP/AED keep `--tint-eur/usd/gbp/aed`; every other code gets one of six
  new soft tokens `--tint-1` to `--tint-6` chosen by a stable hash of the code (sum of
  char codes mod 6). Light: `#E3F0F4 #F4EBDD #E9E6F7 #E6F2E4 #F7E4E8 #EDEBE7`; dark:
  `#20343B #3A3125 #2C2940 #233325 #3D262C #312E2A`. Badge text colour stays `--text`.
- `CurrencyCode` becomes `string` (validated against the rates table where it matters).

### Settings
- `Settings = { currencies: string[]; base: string; amount: string }`, version 4.
  Default `currencies = [EUR, USD]`, `base = EUR`.
- Migration: stored version < 4 (users who saw the fixed four) get
  `[EUR, USD, GBP, AED]`; their base and amount are kept.
- Invariants: at least 2 currencies, no duplicates, `base` is always in `currencies`
  (removing the base makes the first remaining currency the base). Order = insertion
  order (new ones are appended). Setters: `addCurrency(code)`, `removeCurrency(code)`.
- Codes not present in the current rates table are kept but render as `—` (the
  provider may drop a code temporarily).

### Converter card
- Rows follow `settings.currencies` order. Header line: micro label "CONVERT" left, a
  text button "Edit" / "Done" right (`--accent` text, 13/700, 44 px hit area).
- Below the last row: an "Add currency" row (same 64 px height, `--radius-row`): 40 px
  dashed circle (`1.5px dashed var(--accent)`) with a "+" glyph in `--accent`, label
  "Add currency" 15/700 in `--accent`. Hover/press `--line` background. Opens the picker.
- Edit mode: every row gets a 22 px round remove button (`--down` background, white
  minus) at the far left, before the badge, with `aria-label` "Remove {code}"; tapping
  a row in edit mode does nothing else (no base switch); the amount column is empty in
  edit mode (row shows badge, code and name only). With only 2 currencies the remove
  buttons are hidden. The "Add currency" row stays visible in edit mode. "Done" leaves
  edit mode.
- Currencies with 0 decimals (JPY) format without decimals.

### Currency picker (sheet)
- Native `<dialog>` with `showModal()`: bottom sheet below 640 px (full width, top
  corners `--radius-card`, max-height 85dvh, slides up 200 ms, drag handle 36x4
  `--line`), centred dialog 440 px wide (max-height 80dvh) from 640 px. Backdrop
  `rgba(43,40,36,.35)`. Escape, backdrop tap and the close button close it; body scroll
  locked while open; the search field is focused on open only on `(pointer: fine)`
  devices (no keyboard pop on phones).
- Content: title "Add currency" 22/800 + 44 px round close button; a search field
  (`--bg` background, `--radius-pill`, 44 px tall, 16 px font, search glyph, placeholder
  "Search currency", `type="search"`, `enterkeyhint="search"`); then a scrolling list:
  section "POPULAR" (the POPULAR codes that the rates table has) and section "ALL
  CURRENCIES" (every other code in the rates table, sorted by English name). While the
  search has text, sections collapse into one filtered list matching code or name
  (case- and accent-insensitive); "No currencies found" when empty.
- List item 52 px: 32 px SymbolBadge, code 15/700 + name 13 `--text-2`, and on the right
  a check glyph in `--up` when the currency is already chosen. Tapping a non-chosen item
  adds it (sheet stays open so several can be added); tapping a chosen item removes it
  unless that would leave fewer than 2 (then nothing happens). `aria-pressed` reflects
  the chosen state.

### Rates tile (chip grid)
- Always the first tile and always the full width of the markets grid
  (`grid-column: 1 / -1`). Header: 28 px SymbolBadge of the base + "1 EUR" (16/700) with
  "Exchange rate" caption.
- Below: one chip per chosen currency except the base, in settings order, in
  `display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px`.
  Chip: `--bg` background, radius 14 px, padding 10 12; line 1 = 18 px SymbolBadge +
  code 12/700 in `--text-2`; line 2 = value 16/800 tabular (`formatRate`); line 3 =
  daily change 12/700 (`--up` / `--down` / `--text-2`, `formatPercent`, omitted without
  snapshots). Codes missing from the rates table show `—`.
- `formatRate(value)` in `lib/money.ts`: nl-NL, 4 decimals below 10, 3 below 100,
  2 from 100 (`1,1162`, `38,215`, `169,42`).
- With the 2-up markets grid (>= 560 px of section width) the asset tiles follow below:
  Bitcoin spans the full width, Gold and Silver side by side.

### Copy (en) additions
| key | en |
|-----|----|
| edit | Edit |
| done | Done |
| addCurrency | Add currency |
| removeCurrency | Remove {code} |
| searchCurrency | Search currency |
| popular | Popular |
| allCurrencies | All currencies |
| noResults | No currencies found |
| close | Close |

## 12. Formatted amount input and reordering

### Amount input formatting (live, while typing)
- The active row's input always shows the amount in nl-NL notation: thousands grouped
  with `.`, decimal separator `,` (`10.000`, `1.234,5`, `0,75`). Stored `amount` is that
  display text (it stays parseable by `parseAmount`).
- Pure helper in `src/lib/amountInput.ts`:
  `formatAmountInput(raw: string, caret: number, decimals: number, lastKey?: string)
  -> { text: string; caret: number }`. Rules:
  - Keep digits and at most one decimal separator; drop everything else.
  - Which character is the decimal separator (as implemented, must agree with
    `parseAmount` for every pasted value): both `,` and `.` present -> the last one is
    the decimal (`1,234.56` -> `1.234,56`); only `,` -> the `,` is the decimal (Dutch
    keypad, also `1,234` = 1,234); only `.`: a `.` typed at the end is the decimal, a
    lone pasted `.` before 1-2 digits is the decimal (`12.5`), before exactly three
    digits it groups only after 1-3 non-zero digits (`1.234` = 1234, `0.123` = 0,123),
    several `.` group. A separator typed while one exists is ignored.
  - Integer part: strip leading zeros (keep a single `0` before a decimal or alone),
    group per three with `.`.
  - Fraction: at most `decimals` digits (extra digits are dropped); when `decimals` is 0
    the separator is ignored.
  - A trailing separator is kept while typing (`12,`), shown as `,`.
  - Caret: count the significant characters (digits and the decimal separator) left of
    the caret in `raw`, and place the new caret after the same count in `text`.
  - Deleting a thousands `.` with Backspace (the formatted text would come back
    unchanged) deletes the digit before it instead; Delete removes the digit after it.
- The input applies the result and restores the caret with `setSelectionRange` in a
  layout effect. Paste works through the same path. Empty input stays empty
  (placeholder `0`).
- When the base currency changes, the stored amount is re-formatted with the new
  currency's decimals (extra decimals dropped).

### Reordering in edit mode
- Each row in edit mode shows a drag handle at the far right (grip glyph, six dots,
  `--text-2`, 44x44 hit area, `aria-label` "Reorder {code}", `touch-action: none`,
  cursor `grab`). Only the handle starts a drag, so the page still scrolls on touch.
- Library: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (current stable),
  vertical list strategy, `restrictToVerticalAxis` / parent-element modifiers from
  `@dnd-kit/modifiers`. Sensors: Pointer (activation distance 4 px) and Keyboard
  (`sortableKeyboardCoordinates`: Space/Enter lifts, arrows move, Space/Enter drops,
  Escape cancels). Screen-reader announcements in English via dnd-kit `accessibility`
  `announcements` (e.g. "Picked up USD", "USD moved to position 2 of 4", "USD dropped at
  position 2 of 4") built from the i18n dictionary.
- While dragging: the row lifts (`--shadow-card`, `--surface` background, scale 1.02),
  the others slide with `transform` transitions (`var(--dur) var(--ease)`; none under
  reduced motion). The "Add currency" row is not sortable.
- On drop the new order is saved via a settings setter `moveCurrency(from: string,
  to: string)` (moves `from` to the index of `to`); the base stays the base. The
  converter rows and the rates-tile chips follow the stored order.

### Copy (en) additions
| key | en |
|-----|----|
| reorder | Reorder {code} |
| dnd.picked | Picked up {code}. |
| dnd.moved | {code} moved to position {pos} of {total}. |
| dnd.dropped | {code} dropped at position {pos} of {total}. |
| dnd.cancelled | Reordering cancelled. {code} returned to position {pos}. |

## 13. "Faster at a glance" redesign (supersedes the §8 screen and the §11 rates tile)

Source of truth for the look: the owner's design canvas
https://claude.ai/artifact/5C1ey6SPo4LwK22nFNJRXa (artboards "Desktop" 1280 fluid and
"iPhone" 390x844, dark). Its markup and values are copied into this section; where this
section and the canvas differ, this section wins. Owner's changes to the canvas: NO
quick-amount chips (1 / 100 / 1K / 10K / 100K), and the hint under the input reads
"Click any result to convert from that currency or metal." (no "Tip:").

### Items model (currencies AND assets)
- An item is a fiat code (`EUR`, `USD`, …) or an asset id: `XAU` (Gold), `XAG` (Silver),
  `BTC` (Bitcoin). The user's list is `settings.items: string[]` (order = display order).
  Any item can be the base (the "convert from" item), including Gold and Bitcoin.
- Settings v5 `{ items, base, amount, metalUnit }`, `metalUnit: 'g' | 'oz' | 'kg'`
  (default `g`). Defaults: `items = ['EUR','USD','XAU','XAG','BTC']`, `base = 'EUR'`.
  Migration from v4: `items = currencies + ['XAU','XAG','BTC']` (they always saw the
  markets); from < 4: legacy four + the three assets. Invariants: >= 2 items, no
  duplicates, base in items (removing the base makes the first remaining item the base).
- Value of one unit of an item in EUR (`eurPer(item, metalUnit)`): fiat `1 / rates[code]`;
  BTC `convert(priceUsd, 'USD', 'EUR')`; metals `convert(priceUsdPerOz, 'USD', 'EUR') /
  31.1034768 * gramsPerUnit` with `g = 1`, `oz = 31.1034768`, `kg = 1000`. Missing data ->
  `NaN` -> the UI shows `—`.
- Converted amount of target `t`: `amount * eurPer(base) / eurPer(t)`.
- Display decimals of a converted amount: fiat = currency decimals (Intl); BTC = 6 below
  1, else 4; metals: `g` 2 below 100 else 0, `oz` 2, `kg` 3.
- Input decimals (for `formatAmountInput`) when the base is an asset: BTC 8, metal `g` 2,
  `oz` 3, `kg` 3.
- Rate line per result: if the target is fiat: `1 {L(base)} = {r} {L(target)}`; if the
  target is an asset: `1 {L(target)} = {r} {L(base)}`. `L(x)` = the code for fiat, `{unit}
  {name lower}` for metals (`g gold`, `oz silver`), `BTC` for Bitcoin. `r` decimals: 0 from
  10.000, 2 from 10, 4 from 0,01, else 6 (nl-NL).
- Change badge per result: daily snapshot change of the quantity shown in the rate line,
  via `rateChangePct(today, previous, from, to)` with the same from/to as the rate line
  (`xau`, `xag`, `btc` exist in the snapshots). Omitted without snapshots. Badge: rounded
  to 1 decimal; 0,0% neutral, > 0 up, < 0 down.
- Tapping/clicking a result makes it the base and sets the amount to that result's value
  (formatted with `formatAmountInput` for the new base's input decimals).

### Colours
- Dark = the canvas: `--bg #262422`, `--surface #363230`, `--line #423c38` (result card
  border), `--text #f3eee8`, `--text-2 #b3aba1`, `--accent #f2a66b`, `--input-bg #45382c`,
  `--input-border #8a6a48`, `--input-text #fbf7f2`, segmented track `--surface`, active
  segment `#4a4440` (`--seg-active`). Badges: up `#86e3ad` on `rgba(111,211,155,.14)`,
  down `#ffa3a3` on `rgba(242,139,139,.15)`, neutral `#c4bcb2` on `rgba(255,255,255,.07)`
  (tokens `--up/--up-soft/--down/--down-soft/--flat/--flat-soft`). Live dot `#6fd39b`,
  live text `#8fd9ad` (`--live`, `--live-text`). Icon tints dark: EUR `#2f3a5c`/fg
  `#e3e8ff`, USD `#264536`/`#d6f5e3`, GBP `#3e2f4c`/`#efe2ff`, AED `#4a3628`/`#ffe6cf`, BTC
  `#4f3720`/`#ffd9a8` (`--tint-x` + new `--tint-x-fg`); generic tints keep `--tint-1..6`
  with `--text`. Metals: `--tint-gold: radial-gradient(circle at 32% 30%, #f6dc8c,
  #c99a36 60%, #9c7424)`, `--tint-silver: radial-gradient(circle at 32% 30%, #f2f4f8,
  #b8bfcc 60%, #8a93a3)` (both schemes).
- Light: keep today's light tokens; `--input-bg = --surface-2` (`#FBF1E8`),
  `--input-border = color-mix(in srgb, var(--accent) 45%, transparent)`, `--input-text =
  --text`, `--seg-active = --surface` with `--shadow-card` at half strength, `--live
  #4F9E78`, `--live-text #3F8A65`, `--flat #8A827A` on `rgba(43,40,36,.06)`, icon fg =
  `--text`. Contrast >= 4.5:1 for all text.
- Light text tokens darkened for >= 5:1 (orchestrator, 2026-10-31): `--text-2 #6E665E`,
  `--up #2B6F4F`, `--down #A23F3F`, `--flat #6B645D`, `--live-text #2E7553`. New
  `--accent-text` for accent-coloured TEXT (Edit, Add currency or asset): light
  `#9C5420`, dark `#F2A66B`; `--accent` stays for fills, borders and the dashed circle.
- Font stays Nunito; numbers tabular.

### Screen (one page)
- **Top bar.** Left: 44 px round refresh button (surface background on wide, transparent
  on narrow) + "Rates updated 30 Oct, 01:02" (15 px, `--text`-ish) with under it (wide) or
  at the far right (narrow) the live status: 8 px dot + "Live · 9s ago" (wide) / "Live"
  (narrow) in `--live-text`; stale: grey dot + "Offline". Right on wide layouts: "Metals
  in" + segmented `g | oz | kg` (only when the list contains a metal).
- **Convert card** (`--surface`, radius 28 wide / 24 narrow, padding 24 / 16):
  - Wide: header "CONVERT FROM" (13 px, tracking .08em, `--text-2`) + "Edit" (accent,
    16/700, 44 px hit area); base row: 52 px icon + code 22/800 over name 15 `--text-2`
    (metals/BTC: name on top, code under); label "Amount in EUR" / "Amount in g gold" (13
    px `--text-2`, `<label for>`); the input: full width, `--input-bg`, 1 px
    `--input-border`, radius 18, padding 14 18, 44/800, right-aligned, `--input-text`;
    the hint "Click any result to convert from that currency or metal." (14 px,
    `--text-2`); "Add currency or asset" button (48 px dashed accent circle + plus, 17/700
    accent).
  - Narrow (< 560 px of card width): one row: 44 px icon, code 18/800 over name 13, and
    the input inline (flex 1, radius 16, padding 10 14, 30/800). Below the card: a line
    with "TAP A ROW TO CONVERT FROM IT" (12 px, tracking .08em) left and the `g | oz | kg`
    segmented control right (when a metal is listed). "Edit" sits in the list card
    header on narrow (right-aligned above the rows), "Add currency or asset" below the
    list (40 px dashed circle, 16/700).
- **Results** (every item except the base, in list order), a `results` container:
  - >= 560 px wide: grid `repeat(auto-fill, minmax(240px, 1fr))`, gap 16. Card = a
    `<button>`: `--surface`, 1 px `--line` border, radius 24, padding 20, min-height 168,
    gap 14: top row = 44 px icon + title 17/800 over name 13 `--text-2` (fiat: code over
    name; assets: name over code) and the badge right (14/700, radius 12, padding 4 10);
    middle = amount 30/800 + unit 16/700 `--text-2`-ish (unit = code, or `g`/`oz`/`kg` for
    metals, `BTC`); bottom = rate line 14 `--text-2`.
  - < 560 px: one `--surface` card (radius 24, padding 6 0) with rows = `<button>`s, min
    height 64, padding 10 16, gap 12: 40 px icon; title 16/800 over the rate line 12
    `--text-2` (wraps rather than ellipsis); right: amount 18/800 + unit 13, under it the
    badge 12/700 (radius 8, padding 1 7).
  - Hover/press: border/background shifts one step (`--line` → `--text-2` at 30 %);
    focus-visible ring 2 px accent.
- **Layout.** >= 900 px: top bar full width, then convert card (flex 1 1 340, max 420)
  left and results (flex 999 1 560) right, gap 24, max-width 1200 centred. < 900 px: top
  bar, convert card full width, (narrow line), results. Gutters 16 / 24 from 640 px; safe
  areas as before. No text truncation anywhere (wrap instead).
- **Edit mode** (Edit -> Done): the results area becomes one sortable list of ALL items
  (base included, marked with a small "From" pill), each row: remove button (hidden at
  2 items), icon, title + name, drag handle (dnd-kit as §12). Tapping rows does nothing in
  edit mode. "Add currency or asset" stays visible.
- **Picker** ("Add currency or asset"): as §11, plus a first section "ASSETS" (Gold,
  Silver, Bitcoin, with their badges) above "POPULAR"; search also matches asset names.
- Removed: the markets section, the rates tile, the converter's per-currency rows, the
  quick-amount chips (never built). Metal per-ounce/per-gram captions and the BTC
  CoinGecko 24 h figure are dropped (the rate line and snapshot change replace them).

### Copy (en) additions
| key | en |
|-----|----|
| convertFrom | Convert from |
| amountIn | Amount in {unit} |
| clickHint | Click any result to convert from that currency or metal. |
| tapHint | Tap a row to convert from it |
| addItem | Add currency or asset |
| metalsIn | Metals in |
| liveAgo | Live · {ago} |
| liveShort | Live |
| offlineShort | Offline |
| updatedShort | Updated {time} |
| assets | Assets |
| fromPill | From |
| unit.g / unit.oz / unit.kg | g / oz / kg |

### Orchestrator decisions after review (2026-10-31)
- Compact vs wide form: decided by the width of the two-column wrapper (< 400 px =
  compact), because the desktop convert card is only ~340 px wide.
- Compact form: "Edit"/"Done" sits on the same line as "Add currency or asset", below the
  list (no separate Edit row above it); the tap hint is 11 px / tracking .04em so it fits
  beside the `g | oz | kg` toggle on a 390 px phone.
- Segmented track: `--seg-track` (light `rgba(43,40,36,.07)`, dark `--surface`).
- Changing the metal unit while a metal is the base converts the typed quantity
  (895,93 g -> 28,805 oz), so every result stays the same.
- `parseAmount`: a lone `,` is always the decimal separator (as the input shows it), so
  `28,805` = 28,805; a lone `.` + 3 digits after 1-3 non-zero digits stays a thousands dot.
