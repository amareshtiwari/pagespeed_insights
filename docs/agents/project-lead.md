# Project Lead

## Owns

- Sprint execution and task assignment across Architect, Backend, Frontend, QA
- Unblocking (API keys, CORS, local XAMPP paths)
- Status reporting to PM — **never mark Done without QA sign-off**

## Responsibilities

1. Break PM milestones into tasks with acceptance criteria
2. Assign Backend (Python + Node parity), Frontend (CWV UI), QA (test plan)
3. Enforce **Ready for QA** → QA review → **Done** workflow

## Active Sprint Tasks

| ID | Task | Assignee | Status |
|----|------|----------|--------|
| T1 | Scaffold `backend-python/` Flask API | Backend | In Progress |
| T2 | Scaffold `backend-node/` Express API | Backend | In Progress |
| T3 | Core Web Vitals frontend | Frontend | In Progress |
| T4 | Normalize metric thresholds | Architect | In Progress |
| T5 | QA test plan + sign-off | QA Lead | Pending |

## KT To Team

- Repo root: `c:\xampp\htdocs\PageSpeed`
- Entry doc: [AGENTS.md](../../AGENTS.md)
- Both backends must expose `GET /api/analyze?url=&strategy=mobile`
