# iOS build (Capacitor)

Wraps the static `dist/` build in a native iOS shell. Documented, not executed (SPEC §9).

## Prerequisites

- macOS with Xcode 16+ (and its command line tools), an Apple developer team for signing.
- Node 22 + npm.
- Capacitor 7 uses Swift Package Manager by default for new iOS projects; CocoaPods is only
  needed if you opt into it (`npx cap add ios --packagemanager CocoaPods`).

## Commands

```sh
npm i @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Currency Dashboard" com.ramy.currencydashboard --web-dir dist
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

After every later web change:

```sh
npm run build && npx cap sync ios
```

## Xcode

- Target > General: display name `Currency Dashboard`, bundle id `com.ramy.currencydashboard`, select your team.
- App icon: export `public/icon.svg` to a 1024x1024 PNG and drop it into
  `App/Assets.xcassets/AppIcon` (single-size icon is fine on Xcode 16).
- The default scheme settings (`capacitor://localhost` on iOS; `server.androidScheme` only
  matters for Android) are fine; no `server` block is needed in `capacitor.config.ts`.

## Status bar and safe areas

- `npm i @capacitor/status-bar && npx cap sync ios`.
- Listen to `matchMedia('(prefers-color-scheme: dark)')` and call `StatusBar.setStyle`
  accordingly (`{ style: dark ? Style.Dark : Style.Light }`; guard with
  `Capacitor.isNativePlatform()` so the web build is unaffected).
- `index.html` already sets `viewport-fit=cover`, so `env(safe-area-inset-*)` in
  `global.css` works inside WKWebView.

## Networking

- All three API hosts (open.er-api.com, CoinGecko/Coinbase, gold-api.com) are HTTPS and
  send `Access-Control-Allow-Origin: *`, so no ATS exceptions or proxy are needed.

## Known gotchas

- WKWebView `localStorage` persists per app (settings and `wissel.*` caches survive
  restarts) but is wiped if the user deletes the app.
- The service worker is not used inside Capacitor; that is fine because the app bundles
  every asset and falls back to its own localStorage caches when offline.
- Relative asset base (`base: './'`) and no `window.location` routing keep `dist/` loadable
  from the app bundle unchanged.
