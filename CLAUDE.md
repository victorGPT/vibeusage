# Project Guidelines for Claude Code

## Project Structure

- `src/` - CLI source code (Node.js, CommonJS)
- `bin/` - CLI entry points
- `dashboard/` - React dashboard (Vite)
- `insforge-src/` - Backend Edge Functions source
- `insforge-functions/` - Built backend functions (generated)
- `db/migrations/` - Historical database migration SQL

## Key Commands

```bash
npm test                          # Run tests
npm run build:insforge            # Build backend functions
npm run dashboard:dev             # Start dashboard dev server
npm run validate:copy             # Validate copy registry
```

## Conventions

- Platform: macOS-first
- All user-facing text managed in `dashboard/src/content/copy.csv`
- Token data only - never store or upload conversation content
- Use UTC for all timestamps
- Half-hour buckets for aggregation
