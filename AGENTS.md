This project uses six connected agents to cover planning, architecture, implementation, and quality for the **Google PageSpeed Insights Portfolio Dashboard** (Node.js backend + web UI for Core Web Vitals scoring).

Open-source **self-hosted PageSpeed / CWV monitoring** for multi-site portfolios. See [README.md](README.md) and [llms.txt](llms.txt) for features and SEO keywords.

## Governance (Non-Negotiable)

1. **Nothing delivered without QC** — No task, feature, module, UI change, or release is **delivered** or **done** until **QA Lead** has reviewed and issued **written sign-off**. Engineers and leads use **Ready for QA** until then.

2. **KT and communication** — Every agent documents and communicates handoffs to the next role (scope, paths, verification steps, risks). See the [KT Handoff Matrix](docs/agents/HIERARCHY.md#8-kt-handoff-matrix) in [HIERARCHY.md](docs/agents/HIERARCHY.md).

Full rules, workflow, and Definition of Done: [docs/agents/HIERARCHY.md](docs/agents/HIERARCHY.md)

## Agent Hierarchy (Top → Bottom)

```
Level 1 ── Project Manager
              │
Level 2 ── Project Lead
              │
Level 3 ── Project Architect
              │
Level 4 ──┬── Backend Engineer
          ├── Frontend Engineer
          └── QA Lead  ← mandatory gate before delivery
```

## Quick Reference

| Level | Agent | Owns |
|------:|-------|------|
| 1 | [Project Manager](docs/agents/project-manager.md) | Scope, timeline, milestones, stakeholders |
| 2 | [Project Lead](docs/agents/project-lead.md) | Sprint execution, task assignment, unblocking |
| 3 | [Project Architect](docs/agents/project-architect.md) | App architecture, API design, integrations |
| 4 | [Backend Engineer](docs/agents/backend-engineer.md) | Node API, PageSpeed Insights integration, env config |
| 4 | [Frontend Engineer](docs/agents/frontend-engineer.md) | UI, Core Web Vitals display, progress bars, UX |
| 4 | [QA Lead](docs/agents/qa-lead.md) | Test plans, regression, **UI consistency**, **spacing & rhythm**, **CLS = 0**, **mandatory** sign-off |

## Task Flow (Who Connects to Whom)

```
PM defines WHAT + WHEN  →  KT to Lead
  → Lead breaks work + assigns WHO  →  KT to Architect / engineers / QA
    → Architect defines HOW  →  KT to Backend + Frontend + QA
      → Backend + Frontend build  →  status: Ready for QA (not Done)
        → QA validates + sign-off  →  only then: delivered
          → Lead reports QA-signed status  →  PM approves release (with QA release sign-off)
```

Full details: [docs/agents/HIERARCHY.md](docs/agents/HIERARCHY.md)

## Project Structure

```
PageSpeed/
├── backend-node/       Express API — PageSpeed Insights v5 (port 3000)
├── frontend/           Dashboard, Analyze, History UI
├── data/               websites.json + reports.json
├── docs/agents/        Agent roles and handoff matrix
└── .env                GOOGLE_PAGESPEED_API_KEY
```

## Run

```powershell
cd backend-node
npm start
```

Open: `http://localhost/PageSpeed/frontend/dashboard.html`
