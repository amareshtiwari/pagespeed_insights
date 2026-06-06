# Project Architect

## Owns

- System design: dual backends + shared frontend contract
- Google PageSpeed Insights v5 integration patterns
- Metric normalization and CWV pass/fail rules

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│  frontend/  │────▶│ backend-python   │────▶│ Google PSI API v5       │
│  (static)   │     │ :5000            │     │ runPagespeed            │
└─────────────┘     └──────────────────┘     └─────────────────────────┘
       │            ┌──────────────────┐
       └───────────▶│ backend-node     │────▶ (same upstream)
                    │ :3000            │
                    └──────────────────┘
```

## API Contract — `GET /api/analyze`

**Query:** `url` (required), `strategy` (`mobile`|`desktop`, default `mobile`)

**Response:**

```json
{
  "url": "https://example.com",
  "strategy": "mobile",
  "assessment": { "passed": false, "label": "Failed" },
  "coreWebVitals": [
    { "id": "LCP", "name": "Largest Contentful Paint (LCP)", "value": 3.8, "unit": "s", "displayValue": "3.8 s", "category": "needs-improvement", "percentile": 75, "thresholds": { "good": 2500, "needsImprovement": 4000 } }
  ],
  "otherMetrics": [ ... ],
  "metadata": {
    "period": "Latest 28-day period",
    "dataSource": "Chrome UX Report",
    "strategy": "mobile"
  },
  "performanceScore": 62
}
```

## Metric Categories

Use CrUX field data (`loadingExperience.metrics`) when present; fall back to lab `audits` / Lighthouse metrics.

| ID | CrUX key | Fallback audit |
|----|----------|----------------|
| LCP | `LARGEST_CONTENTFUL_PAINT_MS` | `largest-contentful-paint` |
| INP | `INTERACTION_TO_NEXT_PAINT` | `experimental-interaction-to-next-paint` |
| CLS | `CUMULATIVE_LAYOUT_SHIFT_SCORE` | `cumulative-layout-shift` |
| FCP | `FIRST_CONTENTFUL_PAINT_MS` | `first-contentful-paint` |
| TTFB | `EXPERIMENTAL_TIME_TO_FIRST_BYTE` | `server-response-time` |

## KT To Backend + Frontend

- Shared thresholds in each backend `metrics.js` / `metrics.py`
- CORS enabled for local frontend origin
- Frontend uses configurable `window.PAGESPEED_API` (default Python `:5000`)
