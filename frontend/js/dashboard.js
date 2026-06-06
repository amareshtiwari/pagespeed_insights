const addForm = document.getElementById('add-website-form');
const addError = document.getElementById('add-error');
const addSuccess = document.getElementById('add-success');
const dashboardSummary = document.getElementById('dashboard-summary');
const insightsGrid = document.getElementById('insights-grid');
const dashboardBody = document.getElementById('dashboard-body');
const dashboardError = document.getElementById('dashboard-error');
const dashboardStatus = document.getElementById('dashboard-status');
const dashboardLoading = document.getElementById('dashboard-loading');
const dashboardTableWrap = document.getElementById('dashboard-table-wrap');
const dashboardEmpty = document.getElementById('dashboard-empty');
const refreshBtn = document.getElementById('refresh-btn');
const analyzeAllBtn = document.getElementById('analyze-all-btn');
const filterSearch = document.getElementById('filter-search');
const filterPlatform = document.getElementById('filter-platform');
const filterRegion = document.getElementById('filter-region');
const filterGroup = document.getElementById('filter-group');
const filterAttention = document.getElementById('filter-attention');
const filterResetBtn = document.getElementById('filter-reset-btn');

let filterTimer;

refreshBtn.addEventListener('click', loadDashboard);
analyzeAllBtn.addEventListener('click', analyzeAllWebsites);
filterResetBtn.addEventListener('click', resetFilters);

filterSearch.addEventListener('input', () => {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(loadDashboard, 250);
});

[filterPlatform, filterRegion, filterGroup, filterAttention].forEach((el) => {
  el.addEventListener('change', loadDashboard);
});

function resetFilters() {
  clearTimeout(filterTimer);
  filterSearch.value = '';
  filterPlatform.value = '';
  filterRegion.value = '';
  filterGroup.value = '';
  filterAttention.checked = false;
  loadDashboard();
}

addForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  addError.hidden = true;
  addSuccess.hidden = true;

  const formData = new FormData(addForm);
  const body = {
    url: formData.get('url').toString().trim(),
    name: formData.get('name').toString().trim(),
    platform: formData.get('platform').toString(),
    region: formData.get('region').toString(),
    group: formData.get('group').toString(),
  };

  addForm.querySelector('button[type="submit"]').disabled = true;

  try {
    const response = await fetch(`${getApiBase()}/api/websites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to add website');

    if (addForm.analyzeNow.checked) {
      setStatus(`Analyzing ${data.name || body.url} (mobile + desktop)…`);
      const analyzeResponse = await fetch(`${getApiBase()}/api/websites/${data.id}/analyze`, { method: 'POST' });
      const analyzeData = await analyzeResponse.json();
      if (!analyzeResponse.ok) throw new Error(analyzeData.error || 'Website added, but analysis failed');
      addSuccess.textContent = `${data.name || body.url} added and analyzed.`;
    } else {
      addSuccess.textContent = `${data.name || body.url} added to dashboard.`;
    }

    addSuccess.hidden = false;
    addForm.reset();
    addForm.analyzeNow.checked = true;
    await loadDashboard();
  } catch (error) {
    addError.hidden = false;
    addError.textContent = error.message;
  } finally {
    addForm.querySelector('button[type="submit"]').disabled = false;
    setStatus('');
  }
});

function buildFilterQuery() {
  const params = new URLSearchParams();
  if (filterSearch.value.trim()) params.set('search', filterSearch.value.trim());
  if (filterPlatform.value) params.set('platform', filterPlatform.value);
  if (filterRegion.value) params.set('region', filterRegion.value);
  if (filterGroup.value) params.set('group', filterGroup.value);
  if (filterAttention.checked) params.set('attention', 'true');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function fillFilterOptions(filters) {
  const fill = (select, values) => {
    const current = select.value;
    select.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    select.value = current;
  };
  fill(filterPlatform, filters.platforms || []);
  fill(filterRegion, filters.regions || []);
  fill(filterGroup, filters.groups || []);
}

function strategyBlock(label, report, delta, trend) {
  if (!report) {
    return `<div class="strategy-block strategy-block--empty"><span class="strategy-block__label">${label}</span><span class="strategy-block__pending">Not run</span></div>`;
  }
  return `
    <div class="strategy-block">
      <span class="strategy-block__label">${label}</span>
      <span class="strategy-block__score" style="color:${scoreColor(report.performanceScore)}">${report.performanceScore ?? '—'}</span>
      <span class="strategy-block__meta">CWV ${report.cwvPassed ? 'Pass' : 'Fail'} · ${renderDelta(delta)}</span>
      <a class="link-btn strategy-block__link" href="index.html?reportId=${report.id}">View</a>
    </div>
  `;
}

function renderSummary(summary) {
  const cards = [
    { label: 'Total brands', value: summary.totalWebsites, tone: 'neutral' },
    { label: 'Avg performance', value: summary.averagePerformance ?? '—', tone: 'score', score: summary.averagePerformance },
    { label: 'CWV passed', value: summary.cwvPassed, tone: 'good' },
    { label: 'Needs attention', value: summary.needsAttention ?? 0, tone: 'poor' },
    { label: 'Improved', value: summary.improvedBrands ?? 0, tone: 'good' },
    { label: 'Regressed', value: summary.regressedBrands ?? 0, tone: 'pending' },
  ];

  dashboardSummary.innerHTML = cards
    .map((card) => {
      const valueStyle = card.tone === 'score' && card.score != null ? `style="color:${scoreColor(card.score)}"` : '';
      return `<article class="summary-card summary-card--${card.tone}"><span class="summary-card__value" ${valueStyle}>${card.value}</span><span class="summary-card__label">${card.label}</span></article>`;
    })
    .join('');
}

function renderInsights(insights) {
  const top = (insights.topPerformers || [])
    .map((s) => `<li><a href="brand.html?id=${s.id}">${s.name}</a> · ${s.avgPerformance}</li>`)
    .join('') || '<li class="text-muted">No data yet</li>';
  const attention = (insights.needsAttention || [])
    .map((s) => `<li><a href="brand.html?id=${s.id}">${s.name}</a> · needs review</li>`)
    .join('') || '<li class="text-muted">All brands look healthy</li>';

  insightsGrid.innerHTML = `
    <article class="insight-card card"><h3>Top performers</h3><ul>${top}</ul></article>
    <article class="insight-card card insight-card--alert"><h3>Needs attention</h3><ul>${attention}</ul></article>
  `;
}

function renderWebsites(websites) {
  if (!websites.length) {
    dashboardEmpty.hidden = false;
    dashboardBody.innerHTML = '';
    return;
  }

  dashboardEmpty.hidden = true;
  dashboardBody.innerHTML = websites
    .map((site) => {
      const rowClass = site.needsAttention ? 'reports-row reports-row--alert' : 'reports-row';
      const trend = [...(site.mobileTrend || []), ...(site.desktopTrend || [])];
      return `
        <tr class="${rowClass}" data-id="${site.id}">
          <td class="reports-url">
            <strong><a href="brand.html?id=${site.id}">${site.name}</a></strong>
            <span>${site.url}</span>
            ${renderTags(site)}
          </td>
          <td>${strategyBlock('Mobile', site.mobileReport, site.mobileDelta, site.mobileTrend)}</td>
          <td>${strategyBlock('Desktop', site.desktopReport, site.desktopDelta, site.desktopTrend)}</td>
          <td class="sparkline-cell">
            <div class="trend-mini">
              <span class="trend-mini__label">M</span>
              ${renderSparkline(site.mobileTrend, 72, 24, { change: site.mobileDelta, start: site.mobileTrend?.[0]?.score, end: site.mobileReport?.performanceScore }, false)}
              ${renderTrendBadge(site.mobileTrend, { change: site.mobileDelta, start: site.mobileTrend?.[0]?.score, end: site.mobileReport?.performanceScore })}
            </div>
            <div class="trend-mini">
              <span class="trend-mini__label">D</span>
              ${renderSparkline(site.desktopTrend, 72, 24, { change: site.desktopDelta, start: site.desktopTrend?.[0]?.score, end: site.desktopReport?.performanceScore }, false)}
              ${renderTrendBadge(site.desktopTrend, { change: site.desktopDelta, start: site.desktopTrend?.[0]?.score, end: site.desktopReport?.performanceScore })}
            </div>
          </td>
          <td><span class="score-pill" style="color:${scoreColor(site.avgPerformance)}">${site.avgPerformance ?? '—'}</span></td>
          <td>${site.lastChecked ? formatDate(site.lastChecked) : '—'}</td>
          <td class="dashboard-actions-cell">
            <div class="dashboard-actions">
              <a class="link-btn" href="brand.html?id=${site.id}">Brand</a>
              <button type="button" class="link-btn analyze-one-btn" data-id="${site.id}">Analyze</button>
              <button type="button" class="link-btn link-btn--danger remove-btn" data-id="${site.id}">Remove</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  dashboardBody.querySelectorAll('.analyze-one-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const name = btn.closest('tr')?.querySelector('.reports-url strong a')?.textContent?.trim();
      analyzeWebsite(btn.dataset.id, name);
    });
  });
  dashboardBody.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      removeWebsite(btn.dataset.id);
    });
  });
}

async function loadDashboard() {
  await preserveScroll(async () => {
    dashboardError.hidden = true;
    pageLoadStart(dashboardTableWrap, dashboardLoading);

    try {
      const response = await apiFetch(`/api/dashboard${buildFilterQuery()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load dashboard');

      fillFilterOptions(data.filters || {});
      renderSummary(data.summary || {});
      renderInsights(data.insights || {});
      renderWebsites(data.websites || []);
    } catch (error) {
      dashboardError.hidden = false;
      dashboardError.textContent = error.message || 'Unable to load dashboard.';
    } finally {
      pageLoadEnd(dashboardTableWrap, dashboardLoading);
    }
  });
}

async function analyzeWebsite(id, name = '') {
  const label = name || 'brand';
  setStatus(`Analyzing ${label} (mobile + desktop)…`);
  const rowBtn = dashboardBody.querySelector(`.analyze-one-btn[data-id="${id}"]`);
  if (rowBtn) rowBtn.disabled = true;
  try {
    const response = await fetch(`${getApiBase()}/api/websites/${id}/analyze`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Analysis failed');
    await loadDashboard();
  } catch (error) {
    dashboardError.hidden = false;
    dashboardError.textContent = error.message;
  } finally {
    if (rowBtn) rowBtn.disabled = false;
    setStatus('');
  }
}

async function analyzeAllWebsites() {
  dashboardError.hidden = true;

  let websites = [];
  try {
    const response = await fetch(`${getApiBase()}/api/dashboard${buildFilterQuery()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load dashboard');
    websites = data.websites || [];
  } catch (error) {
    dashboardError.hidden = false;
    dashboardError.textContent = error.message || 'Cannot reach the backend. Start it with: cd backend-node && npm start';
    return;
  }

  if (!websites.length) {
    setStatus('No brands match your filters — nothing to analyze.');
    setTimeout(() => setStatus(''), 4000);
    return;
  }

  const total = websites.length;
  const estMinutes = Math.max(1, Math.ceil((total * 70) / 60));
  if (
    total > 3 &&
    !window.confirm(
      `Analyze ${total} brand${total === 1 ? '' : 's'} (mobile + desktop each)?\n\nThis uses the Google PageSpeed API and may take about ${estMinutes} minute${estMinutes === 1 ? '' : 's'}. You can leave this tab open — each row updates as it finishes.`
    )
  ) {
    return;
  }

  analyzeAllBtn.disabled = true;
  addForm.querySelector('button[type="submit"]').disabled = true;
  const analyzeAllDefaultLabel = analyzeAllBtn.textContent;

  let completed = 0;
  try {
    for (let i = 0; i < websites.length; i += 1) {
      const site = websites[i];
      const progress = `${i + 1}/${total}`;
      analyzeAllBtn.textContent = `Analyzing ${progress}…`;
      setStatus(`Analyzing ${site.name} (${progress}) — about 1 min per brand. Do not close this tab.`);

      try {
        const res = await fetch(`${getApiBase()}/api/websites/${site.id}/analyze`, { method: 'POST' });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || `Failed ${site.name}`);
        completed += 1;
        await loadDashboard();
      } catch (error) {
        dashboardError.hidden = false;
        dashboardError.textContent =
          completed > 0
            ? `${error.message} (stopped after ${completed} of ${total} brands — partial results saved.)`
            : error.message;
        break;
      }
    }
  } finally {
    analyzeAllBtn.disabled = false;
    analyzeAllBtn.textContent = analyzeAllDefaultLabel;
    addForm.querySelector('button[type="submit"]').disabled = false;
    if (completed === total) {
      setStatus(`Finished analyzing ${total} brand${total === 1 ? '' : 's'}.`);
      setTimeout(() => setStatus(''), 5000);
    } else if (!dashboardError.hidden) {
      setStatus('');
    } else {
      setStatus('');
    }
  }
}

async function removeWebsite(id) {
  if (!window.confirm('Remove this brand from the dashboard?')) return;
  try {
    const response = await fetch(`${getApiBase()}/api/websites/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error((await response.json()).error || 'Failed to remove');
    await loadDashboard();
  } catch (error) {
    dashboardError.hidden = false;
    dashboardError.textContent = error.message;
  }
}

function setStatus(message) {
  dashboardStatus.hidden = !message;
  dashboardStatus.textContent = message || '';
}

loadDashboard();
