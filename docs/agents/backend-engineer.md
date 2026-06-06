# Backend Engineer

## Owns

- `backend-node/` — Express API, port **3000**
- PageSpeed Insights v5 client, normalization, CORS, env config
- Shared JSON storage in `data/`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/dashboard` | All websites + latest scores |
| POST | `/api/websites` | Add website |
| POST | `/api/websites/:id/analyze` | Analyze one website |
| DELETE | `/api/websites/:id` | Remove website |
| GET | `/api/analyze` | Run PageSpeed for `url` + `strategy` |
| GET | `/api/reports` | Analysis history |
| GET | `/api/reports/:id` | Single report |

## Setup

```bash
cd backend-node
npm install
copy ..\.env.example ..\.env   # add GOOGLE_PAGESPEED_API_KEY
npm start
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_PAGESPEED_API_KEY` | Yes | Google Cloud API key with PageSpeed Insights API enabled |
| `PORT` | No | Default 3000 |

## KT To QA Lead

- Test: `curl "http://localhost:3000/api/analyze?url=https://web.dev&strategy=mobile"`
- Missing key returns `503` with clear message
- Invalid URL returns `400`
