# Agent Hierarchy — Google PageSpeed Application

## 1. Purpose

Six agents govern delivery of the PageSpeed Insights application: Python and Node backends, frontend Core Web Vitals UI, and Google API integration.

## 2. Hierarchy

| Level | Role | Reports To |
|------:|------|------------|
| 1 | Project Manager | Stakeholders |
| 2 | Project Lead | Project Manager |
| 3 | Project Architect | Project Lead |
| 4 | Backend Engineer | Project Lead (via Architect standards) |
| 4 | Frontend Engineer | Project Lead (via Architect standards) |
| 4 | QA Lead | Project Lead |

## 3. Definition of Done

A work item is **Done** only when:

1. Code merged to the agreed branch
2. QA Lead has executed the test plan
3. QA Lead has issued **written sign-off** (date, scope, result)
4. KT handoff documented for the next owner or release

Until QA sign-off, status is **Ready for QA**, not Done.

## 4. Workflow States

```
Backlog → In Progress → Ready for QA → QA Review → Done (signed)
                              ↓
                         Rejected → In Progress
```

## 5. Scope — PageSpeed Application

| Component | Path | Owner |
|-----------|------|-------|
| Python API | `backend-python/` | Backend Engineer |
| Node API | `backend-node/` | Backend Engineer |
| Frontend UI | `frontend/` | Frontend Engineer |
| Agent docs | `docs/agents/` | Project Lead |
| Environment | `.env`, `.env.example` | Backend Engineer |

## 6. Integrations

- **Google PageSpeed Insights API v5** — `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`
- Requires `GOOGLE_PAGESPEED_API_KEY` (Google Cloud Console)
- Strategies: `mobile`, `desktop`
- Categories: `performance`, field data (CrUX) when available

## 7. Quality Gates

| Gate | Owner | Criteria |
|------|-------|----------|
| Architecture review | Architect | API contracts, folder layout, env handling |
| Backend review | Backend Engineer + Architect | Valid PSI responses, error handling, CORS |
| Frontend review | Frontend Engineer + Architect | Matches CWV UI spec, responsive, accessible, **shared control styles on all pages** |
| QA sign-off | QA Lead | Functional, API errors, edge URLs, **UI consistency (T10–T20)**, **spacing & rhythm (T31–T40)**, **CLS = 0 (T21–T30)**, **zero console errors** |

## 8. KT Handoff Matrix

| From | To | Handoff Contents |
|------|-----|------------------|
| PM | Lead | Milestones, URL targets, mobile/desktop scope, API key ownership |
| Lead | Architect | Sprint backlog, priorities (Python vs Node parity) |
| Lead | Backend / Frontend / QA | Task IDs, acceptance criteria, deadlines |
| Architect | Backend | OpenAPI-style routes, metric normalization, `.env` schema |
| Architect | Frontend | JSON response shape, CWV thresholds, UI components |
| Architect | QA | Test environments, sample URLs, expected pass/fail logic |
| Backend | QA | Run commands, ports (5000 Python, 3000 Node), curl examples |
| Frontend | QA | Static serve path, `API_BASE` config, browser matrix |
| QA | Lead | Sign-off doc or defect list with severity |
| Lead | PM | Release readiness, QA sign-off reference |

## 9. Release Checklist

- [ ] `.env.example` documents all required variables
- [ ] Both backends return normalized CWV payload
- [ ] Frontend renders assessment, metrics, progress bars, metadata footer
- [ ] UI controls (buttons, selects, search, inputs, toggles) identical across all 7 pages
- [ ] CLS = 0 verified on all pages; no console errors in DevTools
- [ ] QA written sign-off attached to release notes
- [ ] PM approval recorded
