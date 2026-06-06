# QA Lead

## Owns

- Test plans, regression, **mandatory sign-off** before any delivery
- Blocking release until defects at P0/P1 are resolved or waived by PM
- **Visual consistency** across all frontend pages (fonts, controls, spacing, margins, padding)
- **Zero layout shift (CLS = 0)** on every page — no exceptions

## Test Plan — MVP

### API (Node)

| # | Case | Expected |
|---|------|----------|
| 1 | Valid URL, mobile | 200, `coreWebVitals` length ≥ 3 |
| 2 | Valid URL, desktop | 200, strategy reflected in response |
| 3 | Missing `url` | 400 |
| 4 | Missing API key | 503 |
| 5 | `/api/health` | 200 `{ "status": "ok" }` |

### Frontend — Functional

| # | Case | Expected |
|---|------|----------|
| 6 | Submit example.com | Metrics render, bars show marker |
| 7 | Assessment logic | Failed when any CWV is poor OR ≥2 need improvement (CrUX rules simplified) |
| 8 | Backend reachable | Node API on port 3000 populates UI |
| 9 | Loading / error states | Spinner and user-readable error; no console errors |

### Frontend — UI consistency (mandatory on every page)

**Pages in scope:** `cwv.html`, `dashboard.html`, `trends.html`, `actions.html`, `index.html`, `reports.html`, `brand.html`

| # | Case | Expected |
|---|------|----------|
| 10 | **Font family** | Same font stack on all pages (`Google Sans` / `Roboto` via `styles.css`; no page-specific overrides) |
| 11 | **Primary buttons** | `.btn-primary` — same height, padding, border-radius, font size, and hover state everywhere |
| 12 | **Secondary buttons** | `.btn-secondary` — same styling on Dashboard, CWV, Brand, Reports, Analyze |
| 13 | **Select / dropdown filters** | All filter `<select>` elements use `.filters-bar select` rules: **46px height**, same padding (`0 14px`), border, radius, font size (`0.9375rem`), min/max width (`160px`–`240px`) |
| 14 | **Search inputs** | Search fields match filter height (46px), border, radius, and font — same as Dashboard |
| 15 | **Checkboxes** | Checkbox labels (e.g. “Needs attention only”) align to 46px row height like Dashboard filters |
| 16 | **Period / segmented toggles** | `.period-toggle__btn` and `.segmented__btn` — consistent height, padding, active state across Trends, CWV, Brand |
| 17 | **Text inputs (forms)** | Add-brand form, analyze URL input, brand metadata form — same field height, border, focus ring |
| 18 | **Navigation** | All six nav links present on every page; active state correct; no nav re-render flash on load |
| 19 | **Container width** | Main `.container` max-width **1280px** on all pages — content aligns with header |
| 20 | **Cards & spacing** | `.card` padding, shadows, and section gaps consistent; no page uses one-off control styles when a shared class exists |

### Frontend — Spacing & rhythm (mandatory on every page)

Visual spacing is as important as control styling. Any cramped, double, or missing gap is **P1**.

| # | Case | Expected |
|---|------|----------|
| 31 | **Section stack gap** | Major page sections use **24px** vertical gap (16px on mobile ≤768px) — no sections touching without a deliberate separator |
| 32 | **Card padding** | Card content inset **20px 24px** (16px on mobile); text and grids never flush to card edges |
| 33 | **Section headers** | Title block → body content gap **16–20px**; subtitle (`.reports-header__sub`) has no extra stray margin |
| 34 | **Internal grids** | Summary cards, metric grids, score grids use **12–16px** gap; columns align evenly (no orphan narrow columns) |
| 35 | **Empty states** | “Not run”, “Not analyzed”, “No data” placeholders use same padding/min-height as filled blocks — no collapsed sections |
| 36 | **Form rhythm** | Label → field **6px**; field groups **12px**; submit button aligns to field baseline |
| 37 | **Table in cards** | Card header padding matches card body; row borders span full width (no broken borders from `display:flex` on `<td>`) |
| 38 | **Actions / toolbars** | Header actions, filter bars, and row action links vertically centered within their row or card header |
| 39 | **Brand page** | CrUX card, lab scores, trends, metadata, and history each have equal **24px** separation and consistent inner padding |
| 40 | **CWV views** | Single Brand, **Interval Comparison**, Compare, and Hygiene — **20px/24px** card padding, **20px** header-to-body gap, tables in bordered scroll container |
| 41 | **Visual scan** | Hard refresh every page; scan top-to-bottom for uneven whitespace before sign-off |

**Spacing rule:** If two sections look “stuck together” or a card looks “empty inside”, treat as **P1** until padding/gap matches the Dashboard reference.

**UI consistency rule:** If a control type exists on Dashboard (button, select, search, checkbox, toggle), every other page must use the **same shared CSS class** — not a duplicate or page-specific variant. Any mismatch is **P1** until fixed.

### Frontend — Zero layout shift (CLS = 0)

| # | Case | Expected |
|---|------|----------|
| 21 | **Initial page load** | No visible jump of header, nav, hero, filters, or main content after paint |
| 22 | **Async data load** | Summary cards, tables, and charts reserve space (min-height / skeleton) — content fills in without pushing layout down |
| 23 | **Filter / tab change** | Switching filters, view tabs, or period toggles does not collapse or expand the page unexpectedly |
| 24 | **Loading states** | Loading spinners use fixed-height containers (`.loading--reserve`); hiding loader does not shift content above/below |
| 25 | **Table horizontal scroll** | Wide tables scroll inside `.table-scroll` — page width does not grow; no clipped card corners |
| 26 | **Images / screenshots** | Report screenshots use fixed aspect-ratio / min-height — no jump when image loads |
| 27 | **Charts (Chart.js)** | Canvas containers have min-height before chart renders |
| 28 | **Font load** | Google Fonts use `display=swap`; no large reflow after fonts apply |
| 29 | **Scrollbar** | `scrollbar-gutter: stable` — no horizontal shift when vertical scrollbar appears |
| 30 | **Console** | **Zero console errors** on every page (load, filter, navigate, refresh) — any error is **P0** |

**CLS rule:** QA must verify each page in Chrome DevTools → **Performance** (or Lighthouse) with **CLS = 0** on load and after primary interactions (filter change, tab switch, data refresh). Any CLS > 0 is **P1** unless documented and waived by PM.

### Sign-off Template

```
QA Sign-off — PageSpeed MVP
Date:
Scope: T1–T4 + UI consistency (T10–T20) + spacing (T31–T41) + CLS (T21–T30)
Result: PASS / FAIL
Tester:
Notes:
UI consistency: PASS / FAIL (list pages checked)
Spacing & rhythm: PASS / FAIL (list pages checked)
CLS (0 required): PASS / FAIL (per-page scores)
Console errors: NONE / LIST
```

## Regression checklist (run before every release)

- [ ] All 7 frontend pages checked for UI control parity vs Dashboard
- [ ] Selects, search, buttons, inputs, checkboxes, toggles — same size and style
- [ ] Section gaps (24px), card padding (20px/24px), header-to-body spacing — consistent on all pages
- [ ] Brand page: CrUX, lab scores, trends, metadata, history — even vertical rhythm
- [ ] CWV views (Single Brand, Interval, Compare, Hygiene) — even padding and section gaps
- [ ] Container width 1280px aligned with header on all pages
- [ ] CLS = 0 on load and after filter/tab interactions (all pages)
- [ ] No console errors in browser DevTools (all pages)
- [ ] Hard refresh (Ctrl+F5) — no stale CSS/JS cache issues

## Status

**Pending** — Awaiting implementation complete → Ready for QA
