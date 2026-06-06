const params = new URLSearchParams(window.location.search);
const brandId = params.get('id');

const brandLoading = document.getElementById('brand-loading');
const brandError = document.getElementById('brand-error');
const brandContent = document.getElementById('brand-content');
const brandName = document.getElementById('brand-name');
const brandUrl = document.getElementById('brand-url');
const brandTags = document.getElementById('brand-tags');
const brandSummary = document.getElementById('brand-summary');
const mobileScores = document.getElementById('mobile-scores');
const desktopScores = document.getElementById('desktop-scores');
const mobileTrend = document.getElementById('mobile-trend');
const desktopTrend = document.getElementById('desktop-trend');
const mobileImprovement = document.getElementById('mobile-improvement');
const desktopImprovement = document.getElementById('desktop-improvement');
const periodToggle = document.getElementById('period-toggle');
const brandHistoryBody = document.getElementById('brand-history-body');
const brandHistoryEmpty = document.getElementById('brand-history-empty');
const brandCwvSection = document.getElementById('brand-cwv-section');
const brandCwvGrid = document.getElementById('brand-cwv-grid');
const brandCwvLink = document.getElementById('brand-cwv-link');
const cruxDeviceToggle = document.getElementById('crux-device-toggle');
const historyFilterLink = document.getElementById('history-filter-link');
const analyzeBtn = document.getElementById('analyze-btn');
const editForm = document.getElementById('brand-edit-form');
const editSuccess = document.getElementById('edit-success');
const breadcrumbName = document.getElementById('breadcrumb-name');

let currentPeriod = 'week';
let cachedSite = null;
let cruxDevice = 'mobile';

if (!brandId) {
  brandError.hidden = false;
  brandError.textContent = 'Missing brand id. Open a brand from the dashboard.';
} else {
  analyzeBtn.addEventListener('click', analyzeBrand);
  editForm.addEventListener('submit', saveMetadata);
  periodToggle.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-period]');
    if (!btn) return;
    currentPeriod = btn.dataset.period;
    periodToggle.querySelectorAll('.period-toggle__btn').forEach((el) => {
      el.classList.toggle('period-toggle__btn--active', el === btn);
    });
    loadTrends();
  });
  cruxDeviceToggle.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-device]');
    if (!btn) return;
    cruxDevice = btn.dataset.device;
    cruxDeviceToggle.querySelectorAll('[data-device]').forEach((el) => {
      el.classList.toggle('segmented__btn--active', el === btn);
    });
    if (cachedSite?.cwvHistory) renderCrux(cachedSite.cwvHistory);
  });
  loadBrand();
}

function renderSummary(site) {
  const cards = [
    { label: 'Avg performance', value: site.avgPerformance ?? '—', score: site.avgPerformance },
    { label: 'Mobile', value: site.mobileReport?.performanceScore ?? '—', score: site.mobileReport?.performanceScore, delta: site.mobileDelta },
    { label: 'Desktop', value: site.desktopReport?.performanceScore ?? '—', score: site.desktopReport?.performanceScore, delta: site.desktopDelta },
    { label: 'Last checked', value: site.lastChecked ? formatDate(site.lastChecked) : '—' },
    { label: 'Status', value: site.needsAttention ? 'Needs attention' : 'Healthy', tone: site.needsAttention ? 'poor' : 'good' },
  ];

  brandSummary.innerHTML = cards
    .map((card) => {
      const valueStyle = card.score != null ? `style="color:${scoreColor(card.score)}"` : '';
      const deltaHtml = card.delta != null ? renderDelta(card.delta) : '';
      return `<article class="summary-card summary-card--${card.tone || 'neutral'}"><span class="summary-card__value" ${valueStyle}>${card.value}${deltaHtml ? ` ${deltaHtml}` : ''}</span><span class="summary-card__label">${card.label}</span></article>`;
    })
    .join('');
}

function latestCruxValue(arr) {
  if (!arr?.length) return null;
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    if (arr[i] != null && !Number.isNaN(arr[i])) return arr[i];
  }
  return null;
}

function renderCrux(cwvHistory) {
  const block = cruxDevice === 'desktop' ? cwvHistory?.desktop : cwvHistory?.mobile;
  if (!block?.metrics) {
    brandCwvSection.hidden = true;
    return;
  }

  const cards = CWV_METRICS.map((metric) => {
    const data = block.metrics[metric.short];
    if (!data) return '';
    const latest = latestCruxValue(data.p75s);
    const bucket = cwvBucket(metric.short, latest);
    return `
      <article class="cwv-metric-card cwv-metric-card--${bucket}">
        <div class="cwv-metric-card__head">
          <h3>${metric.short}</h3>
          <span class="cwv-pill cwv-pill--${bucket}">${cwvBucketLabel(bucket)}</span>
        </div>
        <p class="cwv-metric-card__value">${cwvFormat(metric.short, latest)}</p>
      </article>`;
  }).join('');

  if (!cards.replace(/\s/g, '')) {
    brandCwvSection.hidden = true;
    return;
  }

  brandCwvGrid.innerHTML = cards;
  brandCwvSection.hidden = false;
  brandCwvLink.href = `cwv.html?websiteId=${brandId}&view=brand`;
}

function renderHistory(history) {
  if (!history.length) {
    brandHistoryEmpty.hidden = false;
    brandHistoryBody.innerHTML = '';
    return;
  }

  brandHistoryEmpty.hidden = true;

  brandHistoryBody.innerHTML = history
    .map((report, index, list) => {
      const sameStrategy = list.filter((r) => r.strategy === report.strategy);
      const pos = sameStrategy.findIndex((r) => r.id === report.id);
      const previous = pos > 0 ? sameStrategy[pos - 1] : null;
      const delta =
        previous && report.performanceScore != null && previous.performanceScore != null
          ? report.performanceScore - previous.performanceScore
          : null;

      return `
        <tr class="reports-row">
          <td>${report.strategy}</td>
          <td>${formatDate(report.createdAt)}</td>
          <td><span class="score-pill" style="color:${scoreColor(report.performanceScore)}">${report.performanceScore ?? '—'}</span></td>
          <td><span class="cwv-badge ${report.cwvPassed ? 'cwv-badge--passed' : 'cwv-badge--failed'}">${report.cwvPassed ? 'Passed' : 'Failed'}</span></td>
          <td>${renderDelta(delta)}</td>
          <td><a class="link-btn" href="index.html?reportId=${report.id}">View</a></td>
        </tr>
      `;
    })
    .join('');
}

function fillEditForm(site) {
  editForm.name.value = site.name || '';
  editForm.platform.value = site.platform || '';
  editForm.region.value = site.region || '';
  editForm.group.value = site.group || '';
}

function renderTrendsFromData(data) {
  mobileTrend.innerHTML = renderTrendChart(data.mobile.points, 'Mobile performance', {
    improvement: data.mobile.improvement,
  });
  desktopTrend.innerHTML = renderTrendChart(data.desktop.points, 'Desktop performance', {
    improvement: data.desktop.improvement,
  });
  mobileImprovement.innerHTML = `<p class="trend-summary-label">Mobile · ${periodLabel(currentPeriod)}</p>${renderTrendSummary(data.mobile.improvement, periodLabel(currentPeriod))}`;
  desktopImprovement.innerHTML = `<p class="trend-summary-label">Desktop · ${periodLabel(currentPeriod)}</p>${renderTrendSummary(data.desktop.improvement, periodLabel(currentPeriod))}`;
}

async function loadTrends() {
  try {
    const response = await apiFetch(`/api/websites/${brandId}/trends?period=${currentPeriod}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load trends');
    renderTrendsFromData(data);
  } catch (error) {
    brandError.hidden = false;
    brandError.textContent = error.message;
  }
}

async function loadBrand() {
  brandError.hidden = true;
  pageLoadStart(brandContent, brandLoading);

  try {
    const response = await apiFetch(`/api/websites/${brandId}`);
    const site = await response.json();
    if (!response.ok) throw new Error(site.error || 'Brand not found');

    cachedSite = site;
    document.title = `${site.name} — PageSpeed Insights`;
    breadcrumbName.textContent = site.name;
    brandName.textContent = site.name;
    brandUrl.textContent = site.url;
    brandUrl.href = site.url;
    brandTags.innerHTML = renderTags(site);
    historyFilterLink.href = `reports.html?websiteId=${site.id}`;
    document.getElementById('brand-actions-link').href = `actions.html?websiteId=${site.id}`;

    renderSummary(site);
    renderCrux(site.cwvHistory);
    mobileScores.innerHTML = renderScoreGrid(site.mobileReport, 'Mobile');
    desktopScores.innerHTML = renderScoreGrid(site.desktopReport, 'Desktop');
    renderHistory(site.history || []);
    fillEditForm(site);
    await loadTrends();

  } catch (error) {
    brandError.hidden = false;
    brandError.textContent = error.message;
  } finally {
    pageLoadEnd(brandContent, brandLoading);
  }
}

async function analyzeBrand() {
  analyzeBtn.disabled = true;
  brandError.hidden = true;
  try {
    const response = await fetch(`${getApiBase()}/api/websites/${brandId}/analyze`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Analysis failed');
    await loadBrand();
  } catch (error) {
    brandError.hidden = false;
    brandError.textContent = error.message;
  } finally {
    analyzeBtn.disabled = false;
  }
}

async function saveMetadata(event) {
  event.preventDefault();
  editSuccess.hidden = true;
  const formData = new FormData(editForm);
  const body = {
    name: formData.get('name').toString().trim(),
    platform: formData.get('platform').toString(),
    region: formData.get('region').toString(),
    group: formData.get('group').toString(),
  };

  try {
    const response = await fetch(`${getApiBase()}/api/websites/${brandId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save');
    editSuccess.hidden = false;
    await loadBrand();
  } catch (error) {
    brandError.hidden = false;
    brandError.textContent = error.message;
  }
}
