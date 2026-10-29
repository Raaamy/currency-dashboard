# Wissel — specification

A soft, modern currency converter for the phone. One screen: convert an amount between
EUR, USD, GBP and AED, and glance at live Bitcoin, gold and silver prices. Built with
browser technology, shaped so it drops into a native iOS shell (Capacitor) later, and
laid out for the foldable iPhone (narrow outer screen, near-square inner screen).

## 1. Goals

- Type one amount, see it in all four currencies at once. Tap any currency to make it
  the input currency.
- Live-ish prices for Bitcoin, gold and silver, shown in the selected currency, plus
  how much Bitcoin / gold / silver the typed amount buys (updates as you type).
- A small settings sheet: interface language (NL/EN) and appearance (system/light/dark).
- Looks calm and friendly: warm neutrals, rounded surfaces, generous spacing, one soft
  accent. Never a "trading terminal".
- Works on the outer and inner screen of a foldable iPhone, and on any ordinary phone
  or desktop browser.
- Interface language switchable between Dutch and English, persisted on the device.
- Installable as a PWA today; portable to Capacitor/iOS in a handful of commands.

## 2. Non-goals (MVP)

- No accounts, no server, no analytics.
- No extra currencies beyond the four (the code must make adding one a one-line change
  in `src/lib/currencies.ts`, but there is no picker UI).
- No historical charts, no alerts, no portfolio.
- No Capacitor packages installed yet; only the documented path (`docs/IOS.md`).

## 3. Stack (pinned at scaffold time to current stable)

- Node 22, npm.
- Vite 7 + React 19 + TypeScript 5 (strict). Static SPA, no SSR, no router.
- Styling: plain CSS with custom properties (design tokens) and CSS modules per
  component. No Tailwind, no CSS-in-JS. Keeps the bundle small and WKWebView-friendly.
- Font: `@fontsource-variable/nunito` (self-hosted, works offline and inside Capacitor).
- PWA: `vite-plugin-pwa` (auto update, precache app shell), `@vite-pwa/assets-generator`
  for icons from `public/icon.svg`.
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
  state/SettingsContext.tsx language, base currency, amount; persisted
  i18n/nl.ts, en.ts, index.ts  dictionaries + useT()
  components/Header/       brand, "last updated", settings button
  components/Settings/     SettingsSheet (language + appearance), Segmented control
  components/Converter/    ConverterCard, CurrencyRow, AmountInput
  components/Markets/      MarketsSection, MarketTile, ChangePill, LiveDot
  components/ui/           Card, Pill, SymbolBadge (shared primitives)
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
  language: 'nl' | 'en';
  theme: 'system' | 'light' | 'dark';
  base: CurrencyCode;          // the input currency
  amount: string;              // raw input text, so the user sees what they typed
}
```

Theme is applied as `data-theme="light" | "dark"` on `<html>` (attribute removed for
`system`). `tokens.css` defines light values on `:root`, dark values under
`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and again under
`:root[data-theme="dark"]`. The `<meta name="theme-color">` is updated to `--bg` on change.

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
5. **Settings** (gear button in header) opens a sheet with two segmented controls:
   language `NL | EN` and appearance `Systeem | Licht | Donker`. Changes apply instantly
   and persist. Close via the X, tapping the backdrop, or Escape.
6. **Appearance** defaults to `system`; `light`/`dark` override `prefers-color-scheme`.

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

**Header** (no card): brand "Wissel" title-size left; right: a 44 px round settings
button (`--surface` background, gear glyph in `--text-2`, inline SVG, no icon library).
Below brand, caption: "Koersen bijgewerkt 29 okt, 02:02" with a small refresh icon
button (tap = refresh everything).

**Settings sheet** (`components/Settings`): native `<dialog>`; on `< 640 px` a bottom
sheet (full width, top corners `--radius-card`, slides up 200 ms, drag handle 36x4 px in
`--line`); on `>= 640 px` a centred dialog 420 px wide, `--radius-card`. Backdrop
`rgba(43,40,36,.35)`. Content, padding 20: title "Instellingen"/"Settings" 22/800 with a
44 px X close button top-right; two groups, each micro label + Segmented control:
- "TAAL"/"LANGUAGE": `Nederlands | English`
- "WEERGAVE"/"APPEARANCE": `Systeem | Licht | Donker` / `System | Light | Dark`
Segmented control: `--bg` track, `--radius-pill`, 4 px padding, segments 40 px tall,
active segment `--surface` with `--shadow-card` at half strength and `--text`, inactive
`--text-2`; thumb slides 200 ms. Changes apply immediately (no save button). Focus is
trapped in the dialog; Escape and backdrop click close it.

**Converter card** (`--surface`, `--radius-card`, `--shadow-card`, padding 20):
- Micro label "OMREKENEN" / "CONVERT".
- Four rows, 64 px tall, `--radius-row`. Each row: 40 px SymbolBadge (tinted circle,
  symbol 18/800) · code 17/700 + name 13 caption stacked · amount right-aligned 20/700
  tabular.
- Active row: `--surface-2` background, 1 px `--accent` at 30 % border, the amount is an
  `<input inputmode="decimal">` styled as text (display size 28/800 on narrow, 32 on
  wide), caret `--accent`. Inactive rows are buttons; whole row tappable; hover/press
  lightens to `--line`.
- Empty state (no rates yet, no cache): rows show "—" and a soft shimmer.

**Markets section** below (narrow) or right column (wide):
- Micro label "MARKTEN" / "MARKETS" with LiveDot + "live · 12 s geleden".
- Three MarketTiles stacked as full-width rows, gap 10 (narrow and wide alike). Tile:
  card styling, `--radius-row` + 4 px (20 px), padding 14 16; layout = badge · texts ·
  right-aligned numbers:
  - 38 px badge (BTC: `--tint-btc` with ₿; gold/silver: metallic gradient circle, no
    glyph).
  - texts: name 16/700 ("Bitcoin"/"Goud"/"Zilver"); caption 13 = unit price in base
    currency: BTC "€ 63.209 per bitcoin"; gold/silver "€ 116,03 per gram" with a second
    caption "€ 3.608,95 per troy ounce".
  - numbers (right): quantity the typed amount buys, 20/800 tabular, with unit:
    BTC "0,01978 BTC"; gold/silver in grams "10,77 g" (ounces not shown as quantity).
    Under it: BTC -> ChangePill (`−3,1 %`, up/down soft pill); gold/silver -> caption
    "≈ 0,346 oz".
  - Quantity formatting: BTC = up to 5 significant digits, max 8 decimals, trailing
    zeros stripped (`0,01978`, `1,2345`, `12,5`); grams = 2 decimals under 100, else 0.
  - Empty/zero amount: quantity `0 BTC` / `0 g` in `--text-2`.
- Stale/offline: tile shows a small cloud-off glyph next to the timestamp, numbers dim
  to 70 %.

### Responsive / foldable

- `< 640 px` wide (outer screen, ordinary phones): single column, 16 px gutters, card
  stack, markets tiles as full-width rows.
- `>= 640 px` (inner screen open, tablets, desktop): two columns `1.15fr 1fr`, gap 24,
  content max-width 1040 centered, 24 px gutters. Converter left, markets right stacked
  vertically (each tile full width of column).
- Safe areas: `viewport-fit=cover`, padding with `env(safe-area-inset-*)`.
- Foldable hinge: `@media (horizontal-viewport-segments: 2)` sets the two-column gap to
  span the fold using `env(viewport-segment-left 1 0) - env(viewport-segment-right 0 0)`.
  Progressive enhancement; ignored elsewhere.
- Motion: 200 ms ease for highlight moves and number changes; respects
  `prefers-reduced-motion`.
- Touch targets >= 44 px. Inputs 16 px+ font so iOS does not zoom.

### Copy (nl / en)

| key | nl | en |
|-----|----|----|
| convert | Omrekenen | Convert |
| markets | Markten | Markets |
| updated | Koersen bijgewerkt {time} | Rates updated {time} |
| live | live · {ago} | live · {ago} |
| ago.s / ago.m | {n} s geleden / {n} min geleden | {n}s ago / {n} min ago |
| offline | Geen verbinding, laatste koersen | Offline, showing last rates |
| perOunce | per troy ounce | per troy ounce |
| perGram | per gram | per gram |
| perBitcoin | per bitcoin | per bitcoin |
| approxOz | ≈ {n} oz | ≈ {n} oz |
| refresh | Vernieuwen | Refresh |
| settings | Instellingen | Settings |
| close | Sluiten | Close |
| language | Taal | Language |
| lang.nl / lang.en | Nederlands / English | Nederlands / English |
| appearance | Weergave | Appearance |
| theme.system / light / dark | Systeem / Licht / Donker | System / Light / Dark |
| cur.EUR | Euro | Euro |
| cur.USD | Amerikaanse dollar | US dollar |
| cur.GBP | Britse pond | British pound |
| cur.AED | VAE-dirham | UAE dirham |
| asset.BTC / XAU / XAG | Bitcoin / Goud / Zilver | Bitcoin / Gold / Silver |

Number formatting: `Intl.NumberFormat('nl-NL' | 'en-GB')`, currency style with the
currency's symbol placement per locale, 2 decimals for fiat, 0 for BTC, 2 for metals.

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
- Settings sheet: language switches all copy and formats; appearance overrides the
  system scheme; both survive reload.
- Typing an amount updates the BTC / gold / silver quantities to the correct ratio
  (tested against `convert(amount, base, 'USD') / priceUsd`).
- Layout verified at 390x844 (phone), 474x696 (foldable outer), 904x640 (foldable inner,
  open) and 1280x800 (desktop): no horizontal scroll, no clipped text, no overlap.
- Dark mode has no unreadable contrast (text on surface >= 4.5:1).
- PWA installable (manifest + icons + service worker), Lighthouse PWA checks pass.
