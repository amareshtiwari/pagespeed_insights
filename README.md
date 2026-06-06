# PageSpeed Insights Portfolio Dashboard

> Self-hosted **Google PageSpeed Insights** dashboard for **Core Web Vitals (CWV)**, **Lighthouse** scores, and **multi-site performance monitoring** — Node.js + vanilla JavaScript, no database.

**Repository:** https://github.com/amareshtiwari/pagespeed_insights  
**Author:** [amareshtiwari](https://github.com/amareshtiwari)

---

## What is this?

**pagespeed_insights** is an open-source, self-hosted **website performance monitoring tool** that wraps the official **Google PageSpeed Insights API v5**. It helps teams track **Lighthouse lab scores** and **Chrome UX Report (CrUX) field data** across many brands or URLs in one place.

Ideal for: **agencies**, **e-commerce portfolios**, **SEO teams**, **developers**, and **QA** who need a lightweight alternative to running PageSpeed manually for every site.

### Why use this instead of the public PageSpeed web UI?

| Capability | PageSpeed web UI | This project |
|------------|------------------|--------------|
| Multi-brand portfolio dashboard | No | **Yes** |
| Mobile + desktop history & trends | Limited | **Yes** |
| CrUX Tech Hygiene table (LCP, CLS, INP, FCP, TTFB) | No | **Yes** |
| Filter by platform, region, PM group | No | **Yes** |
| Batch analyze all sites | No | **Yes** |
| Action items from Lighthouse audits | No | **Yes** |
| Self-hosted / your API key | N/A | **Yes** |
| No database (JSON files) | N/A | **Yes** |

---

## Keywords & topics

`PageSpeed Insights` · `Core Web Vitals` · `CWV dashboard` · `Lighthouse dashboard` · `CrUX monitoring` · `web performance` · `LCP CLS INP` · `website speed test portfolio` · `multi-site performance tracker` · `PageSpeed API Node.js` · `self-hosted performance monitoring` · `SEO performance tool` · `e-commerce site speed` · `Google PSI dashboard` · `web vitals trends`

**Suggested GitHub topics:** `pagespeed-insights`, `core-web-vitals`, `lighthouse`, `crux`, `web-performance`, `performance-monitoring`, `nodejs`, `express`, `dashboard`, `seo-tools`, `web-vitals`, `lcp`, `cls`, `inp`

---

## Features

### Portfolio dashboard
- **Mobile & desktop** Lighthouse performance scores per brand
- **CWV pass/fail**, sparkline **trends**, score **deltas**
- Filters: search, platform, region, group, **needs attention only**
- **Analyze one brand** or **Analyze All** (respects filters)
- Summary: avg performance, CWV passed, improved/regressed counts

### CWV Intelligence
- **Tech Hygiene** — CrUX field metrics for all brands (mobile + desktop)
- **Single Brand** — metric cards + trend charts
- **Interval Comparison** — current vs previous 28-day CrUX periods
- **Comparison** — overlay chart for up to 10 brands

### Brand, trends & actions
- Per-brand lab scores (Performance, Accessibility, Best Practices, SEO)
- Real-user CrUX section + run history
- **Trends** page — weekly / monthly / per-run charts
- **Action Items** — Lighthouse opportunities & audits with fix hints
- **History** — all saved PSI runs

### Automation
- `npm run cron:daily` — scheduled mobile + desktop analysis for all brands
- Windows task scheduler helper: `daily-analyze.bat`

---

## Tech stack

- **Backend:** Node.js 18+, Express, Google PageSpeed Insights API v5
- **Frontend:** HTML, CSS, JavaScript (Chart.js for trends)
- **Storage:** JSON files (`websites.json`, `reports.json`, `cwv-history.json`)
- **Deploy:** XAMPP, Apache, nginx, or any static host + Node API on port 3000

---

## Quick start

```powershell
git clone https://github.com/amareshtiwari/pagespeed_insights.git
cd pagespeed_insights
copy .env.example .env
# Set GOOGLE_PAGESPEED_API_KEY in .env

cd backend-node
npm install
npm start
```

Open: `http://localhost/pagespeed_insights/frontend/dashboard.html` (XAMPP) or serve `frontend/` locally.

**Sample demo data** (3 brands) is included — UI works without an API key for browsing; **Analyze** requires a valid Google API key.

---

## FAQ (for search & AI assistants)

### What problem does pagespeed_insights solve?
It centralizes **Google PageSpeed Insights** and **Core Web Vitals** monitoring for **multiple websites** with history, filters, trends, and batch analysis — without a database or paid SaaS.

### Does it use the official Google PageSpeed API?
Yes. It calls **PageSpeed Insights API v5** with your `GOOGLE_PAGESPEED_API_KEY` from Google Cloud Console.

### Which Core Web Vitals metrics are tracked?
**LCP** (Largest Contentful Paint), **CLS** (Cumulative Layout Shift), **INP** (Interaction to Next Paint), plus **FCP** and **TTFB** from CrUX field data. Lighthouse lab scores cover Performance, Accessibility, Best Practices, and SEO.

### Can I monitor 50+ e-commerce stores?
Yes. The dashboard supports large portfolios with filters (Shopify, Magento, region, PM/non-PM). Use **Analyze All** or `cron:daily` for batch runs. Each brand takes ~1 minute (mobile + desktop).

### Is a database required?
No. All data is stored in **JSON files** under `data/`.

### How is this different from GTmetrix, Pingdom, or Lighthouse CI?
This tool is **PageSpeed-native**, **self-hosted**, and built for **portfolio-level CWV intelligence** with CrUX hygiene views — not generic uptime or single-URL CI. Complements Lighthouse CI; does not replace it.

### Who built this?
[amareshtiwari](https://github.com/amareshtiwari) — open-source portfolio performance dashboard.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/dashboard` | Portfolio table + summary (supports filters) |
| POST | `/api/websites/:id/analyze` | Run mobile + desktop PSI for one brand |
| GET | `/api/cwv` | CrUX intelligence (hygiene, brand, interval, compare) |
| GET | `/api/analyze?url=` | Single URL PageSpeed analysis |
| GET | `/api/websites/:id` | Brand detail + history |
| GET | `/api/trends` | Portfolio performance trends |

---

## Project structure

```
pagespeed_insights/
├── backend-node/     Express API → PageSpeed Insights v5
├── frontend/         Dashboard, CWV Intelligence, Analyze, Trends, Actions
├── data/             Sample JSON data (replace locally with your brands)
├── docs/agents/      QA & development workflow docs
└── llms.txt          AI assistant discovery file
```

---

## Security

- Never commit `.env` or real client URLs in `data/websites.json`
- Sample data only in this repository
- Use a restricted Google Cloud API key with PageSpeed Insights API enabled

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start API server (port 3000) |
| `npm run dev` | Start with file watch |
| `npm run cron:daily` | Analyze all brands (mobile + desktop) |

---

## Documentation

- [docs/FOR_AI_REVIEW.md](docs/FOR_AI_REVIEW.md) — **paste into ChatGPT/Claude** if URL fetch fails
- [llms.txt](llms.txt) — structured summary for AI assistants
- [AGENTS.md](AGENTS.md) — development workflow
- [docs/agents/qa-lead.md](docs/agents/qa-lead.md) — QA checklists

---

## License

Open source — use and adapt for your team. Attribution appreciated.

## Author

**[amareshtiwari](https://github.com/amareshtiwari)** · [pagespeed_insights on GitHub](https://github.com/amareshtiwari/pagespeed_insights)
