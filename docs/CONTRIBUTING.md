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
- Node.js >= 18
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
```bash
# Lint backend
npm run lint

# Lint frontend
cd frontend && npm run lint

# Format all code
npm run format

# Build frontend
cd frontend && npm run build

# Run smoke test (requires built frontend + running server)
JWT_SECRET=test node server.js &
npx playwright install chromium
node test/smoke.js
```

## Coding Conventions

### Backend
- **Factory router pattern**: Each route file exports a `createXxxRouter()` function
- **Prepared statements**: Use `db.prepare()` for all queries (SQL injection prevention)
- **Transactions**: Wrap multi-step DB operations in `db.transaction()`
- **Constants**: Import from `lib/constants.js` — no magic strings or numbers in routes
- **Validation**: Import validators from `lib/validation.js` — don't inline checks
- **Auth middleware**: Chain `requireAuth`, `requireAdmin`, `optionalAuth` as needed

### Frontend
- **Context for state**: AuthContext, ThemeContext, ToastContext (no Redux)
- **Hash-based routing**: `#song/42`, `#setlist/42/play` — parsed in App.tsx
- **TypeScript interfaces**: Define in `types/` directory
- **CSS custom properties**: Use theme variables from `variables.css`

### General
- Single quotes, 2-space indent, trailing commas (enforced by Prettier)
- No `any` types in TypeScript (warn level)
- Keep route handlers focused — extract validation and helpers

## PR Process

1. Create a feature branch from `main`
2. Make your changes
3. Run `npm run lint` and `npm run format`
4. Build the frontend: `cd frontend && npm run build`
5. Run the smoke test: `node test/smoke.js`
6. Open a PR with a clear description of what changed and why
