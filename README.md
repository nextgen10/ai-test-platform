# Agent HUB Platform — frontend

A Vite + React 18 build of the Agent HUB Platform console, in plain JSX with
Tailwind CSS v4. Agent Console dropdowns use MUI (same theme as the Next app).

Includes the FastAPI orchestrator (`backend/`), hub registry (`agent-hub/`), and
local runner (`runner/`) copied from `ai-test-platform` so this folder is a
full stack.

## Running it

**Full stack** (orchestrator `:8100` + Vite UI `:3300`):

```bash
cp .env.example .env   # once
./start.sh             # or: npm start
```

**UI only** (orchestrator already running on `:8100`):

```bash
npm install
npm run dev            # http://localhost:3300
```

The Vite dev server proxies `/api/v1` to `API_TARGET` (default
`http://127.0.0.1:8100`). The browser only ever talks to this origin — in
production, whatever serves `dist/` must proxy the same prefix.

```bash
npm run build          # -> dist/
npm run preview
npm run lint
```

## Layout

```
backend/              FastAPI orchestrator (uvicorn :8100)
agent-hub/            agents, skills, workflows registry
runner/               local job runner
schemas/              shared JSON schemas
start.sh              starts API + Vite together
src/
  main.jsx            entry: router + theme + auth + MUI bridge
  App.jsx             every route, each one lazily loaded
  auth/               Microsoft Entra ID sign-in (opt-in, see below)
  components/
    ui/               Tailwind primitives
    chat/             Agent Console (MUI Selects)
    landing/          marketing sections
  contexts/           theme mode, chat session state, MUI theme
  lib/                API clients, pure logic, exports
  pages/              one file per route
  styles/globals.css  UBS design tokens + the component layer
  theme/              CSS-variable tokens + MUI createTheme port
```

### Where the MUI theme went

`src/styles/globals.css` holds the UBS FIT tokens as CSS variables keyed off
`[data-theme]`, a `@theme` block that exposes them as Tailwind utilities
(`bg-surface`, `text-subtle`, `border-hairline`), and a `@layer components`
block that reproduces what the MUI `createTheme` override used to do —
`.ui-paper`, `.ui-btn`, `.ui-chip`, `.ui-table`, `.ui-input` and so on.

Because the palette is CSS variables, the light/dark toggle is one attribute
write on `<html>`; no React re-render is needed to repaint. `index.html` stamps
the stored theme before first paint, so there is no flash.

`src/components/ui/` wraps those classes in components: `Button`, `Chip`,
`Paper`, `Dialog`, `Menu`, `Drawer`, `Snackbar`, `Tabs`, `Tooltip`,
`LinearProgress`, `Skeleton`, `Spinner`, `TextField`, `Select`, `Switch`.

## Sign-in

Off by default: `VITE_AUTH_ENABLED=false` leaves every route open, which is how
the platform runs against an orchestrator with `AUTH_MODE=disabled`. MSAL is
behind a dynamic import, so a disabled build never downloads it.

To turn it on, set in `.env`:

```
VITE_AUTH_ENABLED=true
VITE_AZURE_CLIENT_ID=<app registration client id>
VITE_AZURE_TENANT_ID=<directory tenant id>
VITE_AZURE_API_SCOPES=api://<app-id>/access_as_user   # optional
```

Every route then sits behind `RequireAuth`, `/login` becomes a real sign-in
page, and the axios client attaches a silently-refreshed bearer token to each
request. The flag is only honoured when both ids are present — turning it on
without them would put a login page in front of an app that cannot sign anyone
in, so the login page says so instead.

## Spreadsheet export

`xlsx` is loaded on demand the first time someone exports, not on page load.
Exports available: a generated test suite (cases + assumptions, from a job's
Results tab), the jobs list, and per-agent usage from the dashboard.

## Deviations from the supplied package.json

- **`@tailwindcss/postcss` added.** Tailwind v4 no longer works as a PostCSS
  plugin under its own name; the plugin moved to this package. `postcss` and
  `autoprefixer` are both in the pipeline as specified — see `postcss.config.js`.

Everything else installs and resolves exactly as listed.
