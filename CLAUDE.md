# Wissel (currency converter)

Stack: Vite 7 + React 19 + TypeScript (strict), plain CSS modules + tokens, Vitest. Static SPA, Capacitor-ready. Node 22, npm.

## Commands
- `npm run dev` — dev server (Vite)
- `npm run build` — type-check + production build to `dist/`
- `npm run lint` — ESLint; `npm run format` — Prettier write
- `npm test` — Vitest once; `npm run test:watch` — watch mode

## Conventions
- Design is decided in `docs/SPEC.md` §8; use only the tokens in `src/styles/tokens.css`. No hard-coded colors, radii or shadows in components.
- Components never call `fetch`; they use hooks from `src/data/` and `src/state/`. Provider URLs and response shapes live only in `src/data/`.
- `src/lib/*` stays pure (no React, no DOM) and every exported function has a Vitest test.
- All user-visible copy goes through `useT()` from `src/i18n`; never inline a Dutch or English string in a component.
- Numbers through `formatMoney`/`formatNumber` in `src/lib/money.ts`; never `toFixed` in a component.
- Keep it portable to Capacitor: no SSR, no `window.location` routing, relative asset base, fetch only.
- Touch targets >= 44 px; input fonts >= 16 px; respect `prefers-reduced-motion`.
- When you add or move files, update `filemap.md`.

## Pointers
- `docs/SPEC.md` — goals, data model, APIs, design tokens and screen spec
- `docs/PLAN.md` — task list and status
- `filemap.md` — where things live
