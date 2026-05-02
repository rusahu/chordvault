---
name: chordvault-maintenance
description: Standards and workflows for maintaining the ChordVault codebase. Use when performing bug fixes, feature implementations, or refactoring within the ChordVault repository to ensure consistency with project-specific architectural standards, security mandates, and testing protocols.
---
# ChordVault Maintenance

This skill provides expert guidance for developing and maintaining ChordVault, a self-hosted chord sheet web app.

## Core Mandates

- **Surgical Changes**: Prioritize minimal, high-impact edits that respect existing patterns.
- **Single Source of Truth**: `ChordPro` is the source of truth for song content. All metadata (title, artist, BPM, etc.) is derived from directives within the ChordPro text.
- **Security**: Rigorously protect JWT tokens and the `data/chordvault.db` SQLite database.

## Development Workflow

### 1. Research & Analysis
- Verify current behavior against `ChordVault/CHORDVAULT_CONTEXT.md`.
- Analyze both frontend (`ChordVault/Code/frontend/src/`) and backend (`ChordVault/Code/routes/`, `ChordVault/Code/lib/`) for cross-cutting changes.

### 2. Implementation
- **Backend**: Adhere to Express 5 patterns and `better-sqlite3` usage in `lib/db.js`.
- **Frontend**: Use React 19, TypeScript, and standard components in `src/components/`.
- **Routing**: Follow the hash-based routing pattern in `App.tsx`.

### 3. Testing & Verification
- **Frontend Unit Tests**: Run `npm test` in `ChordVault/Code/frontend/`.
- **Backend Linting**: Run `npm run lint` in `ChordVault/Code/`.
- **Smoke Tests**: Run `node test/smoke.js` from `ChordVault/Code/` after starting the server (`node server.js`).

## Common Workflows

### Deep-Linking & Routing
When adding or modifying views, ensure the URL hash is correctly parsed in `App.tsx:parseHash` and formatted in `App.tsx:navigate`. For setlist playback, use `history.replaceState` to sync the URL without triggering a full re-render.

### Setlist Logic
- **Server Setlists**: Fetched via `/api/setlists`.
- **Local Setlists**: Stored in `localStorage` via `useLocalSetlists` hook.
- **Playback**: Use `useSetlistPlayer` hook for navigation and `autoSave` logic.

## Documentation
Always update `ChordVault/CHORDVAULT_CONTEXT.md` when introducing new features, changing API endpoints, or modifying the database schema.
