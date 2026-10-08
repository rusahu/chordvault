# Contributing to ChordVault

## Project Structure

```
├── server.js          # Express server setup, middleware, rate limiting
├── lib/               # Backend modules
│   ├── db.js          # SQLite database schema and initialization
│   ├── auth.js        # JWT authentication middleware
│   ├── constants.js   # Shared constants (roles, status, limits)
│   ├── validation.js  # Input validation functions
│   ├── errors.js      # AppError class, DB error handling
│   └── languages.js   # ISO 639-1 language code registry
├── shared/            Browser-safe keys, languages and public limits/defaults
├── routes/
│   ├── auth.js        # Login, register, invite redemption
│   ├── songs.js       # Song CRUD, versions, corrections
│   ├── setlists.js    # Setlist management and entries
│   ├── admin.js       # Admin dashboard and user management
│   └── settings.js    # User settings and OCR proxy
├── frontend/          # React + TypeScript SPA (Vite)
│   └── src/
│       ├── components/  # Reusable UI components
│       ├── views/       # Page-level views
│       ├── context/     # React context providers
│       ├── hooks/       # Custom React hooks
│       ├── lib/         # API client, chord parsing, utilities
│       ├── types/       # TypeScript interfaces
│       └── styles/      # CSS stylesheets
├── public/            # Built frontend assets (served by Express)
├── test/              # Smoke test (Playwright)
├── scripts/           # Dev tooling (seed data, audit screenshots)
└── docs/              # Contributor guide (this file)
```

## Local Development

### Prerequisites
- Node.js >= 24 (Docker and CI use Node.js 24)
- npm

### Setup
```bash
# Clone and install backend deps
npm install

# Install frontend deps
cd frontend && npm install && cd ..

# Create env file
cp .env.example .env
# Edit .env and set JWT_SECRET

# Start both backend and frontend dev servers
npm run dev
```

The backend runs on `http://localhost:3100`. The Vite dev server proxies API calls there.

### Running checks
Run these from the repository root:

```bash
npm run lint
npm test
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
npm run format:check

# Browser smoke test against an already running disposable instance
npx playwright install chromium
BASE_URL=http://localhost:3118 node test/smoke.js

# Optional local container verification; CI runs this against the built image
# Both containers and their temporary database volumes are removed afterward.
docker build -t chordvault:ci .
node test/docker-smoke.js
```

Use a disposable database and an unused port for integration checks. Do not run
write tests against an existing personal library. The browser smoke script covers
anonymous navigation and local setlists; backend HTTP tests cover permissions,
validation and quotas.


## Coding Conventions

### Backend
- **Factory router pattern**: Each route file exports a `createXxxRouter()` function
- **Prepared statements**: Use `db.prepare()` for all queries (SQL injection prevention)
- **Transactions**: Wrap multi-step DB operations in `db.transaction()`
- **Constants**: Use `lib/constants.js` for backend values. Public limits/defaults come from `shared/public-constants.json`; keep server-only settings out of shared code.
- **Validation**: Import validators from `lib/validation.js` — don't inline checks
- **Auth middleware**: Chain `requireAuth`, `requireAdmin`, `optionalAuth` as needed

### Frontend
- **Context for state**: AuthContext, ThemeContext, ToastContext (no Redux)
- **Hash-based routing**: `#song/42`, `#setlist/42/play` — parsed in App.tsx
- **TypeScript interfaces**: Define in `types/` directory
- **CSS custom properties**: Use theme variables from `variables.css`

### Shared code
- `shared/` contains runtime-neutral music keys, language data and public limits.
- Node 24 loads the synchronous `.mjs` helpers from CommonJS; Vite bundles them for the browser. Keep shared modules free of server/browser globals and top-level await.
- Frontend and backend adapters retain their own responsibilities, including backend-only German key acceptance and browser transposition.
- Docker copies shared sources into both the frontend build stage and final server image. Verify development imports as well as production builds when changing them.

### General
- Single quotes, 2-space indent, trailing commas (enforced by Prettier)
- No `any` types in TypeScript (warn level)
- Keep route handlers focused — extract validation and helpers

## PR Process

1. Create a feature branch from `main`.
2. Make focused changes and include the version bump in both manifests and lockfiles.
3. Run backend/frontend lint and tests, then build the frontend.
4. Check the affected flows locally using disposable data.
5. Open a PR describing the problem, resulting behaviour and relevant verification.
6. Wait for `lint-and-build`, `smoke-test` and `docker-build` to pass before merging. The Docker check builds one image and starts it in normal and demo modes; it does not publish or deploy it.
