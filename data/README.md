# Sample data (included in repo)

This folder ships **demo data only** — no real client brands, API keys, or production reports.

| File | Purpose |
|------|---------|
| `websites.json` | 3 demo brands (Alpha, Beta, Gamma) |
| `reports.json` | 3 sample Lighthouse runs for demo brands |
| `cwv-history.json` | 8-week CrUX-style field data for charts |
| `sync-state.json` | Cron/seed metadata |

## Replace with your data (local only)

1. Copy `.env.example` to `.env` and add your `GOOGLE_PAGESPEED_API_KEY`.
2. Add brands via the Dashboard UI, or replace `data/websites.json` locally.
3. Run **Analyze** / **Analyze All**, or `npm run cron:daily` in `backend-node/`.

## Do not commit

- `.env` (API keys)
- `data/cron.log`
- Production exports with real client URLs

See root `.gitignore`.
