# File map

One line per entry: `path — what / when to touch`.

- `CLAUDE.md` — agent conventions and commands; keep under 60 lines
- `docs/SPEC.md` — product + design + data spec; the source of truth for decisions
- `docs/PLAN.md` — ordered tasks with status; update when a task is accepted
- `docs/IOS.md` — (task 5) steps to wrap the build in Capacitor for iOS
- `filemap.md` — this index
- `package.json` — deps and scripts (dev, build, preview, lint, format, test, test:watch); touch when adding deps/scripts
- `vite.config.ts` — Vite (`base: './'`, `@/` alias) + Vitest config (jsdom, globals, setup file); PWA plugin goes here (task 6)
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — strict TS; `@/*` path alias (keep in sync with vite.config.ts)
- `eslint.config.js` — ESLint flat config from the Vite React TS template
- `.prettierrc`, `.prettierignore` — Prettier settings; Markdown is excluded so docs keep their hand formatting
- `index.html` — HTML entry: lang, viewport-fit=cover, theme-color (light/dark), apple-mobile-web-app tags, title
- `src/main.tsx` — bootstrap: imports global.css, mounts `<App />`; PWA registration goes here (task 6)
- `src/App.tsx` — layout shell: `.app` > `.layout` grid with Header, ConverterCard, MarketsSection; SettingsSheet
- `src/vite-env.d.ts` — Vite client types
- `src/styles/tokens.css` — all SPEC §8 design tokens (light, dark via media query and `data-theme`); change only with the spec
- `src/styles/global.css` — reset, body font, `.app`/`.layout` grid and breakpoints, safe areas, hinge, reduced motion
- `src/lib/` — pure helpers (no React/DOM), each with a `*.test.ts` next to it
- `src/lib/currencies.ts` — `CurrencyCode`, `Currency`, `CURRENCIES` (EUR, USD, GBP, AED); touch to add a currency
- `src/lib/currencies.test.ts` — sanity test for the currency list
- `src/test/setup.ts` — Vitest setup (jest-dom matchers)
- `src/components/Header/` — Header (placeholder card until task 5)
- `src/components/Converter/` — ConverterCard (placeholder card until task 3)
- `src/components/Markets/` — MarketsSection (placeholder card until task 4)
- `src/components/Settings/` — SettingsSheet (renders null until task 5)
