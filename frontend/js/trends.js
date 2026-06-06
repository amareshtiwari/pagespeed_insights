const periodToggle = document.getElementById('period-toggle');
const filterBrand = document.getElementById('filter-brand');
const filterPlatform = document.getElementById('filter-platform');
const filterRegion = document.getElementById('filter-region');
const filterGroup = document.getElementById('filter-group');
const trendsSummary = document.getElementById('trends-summary');
const trendsError = document.getElementById('trends-error');
const trendsLoading = document.getElementById('trends-loading');
const trendsContent = document.getElementById('trends-content');
const trendsBody = document.getElementById('trends-body');
const trendsEmpty = document.getElementById('trends-empty');
const trendsCharts = document.getElementById('trends-charts');
const trendsTableTitle = document.getElementById('trends-table-title');
const exportTrendsBtn = document.getElementById('export-trends-btn');

let currentPeriod = 'week';
let cachedData = null;

periodToggle.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-period]');
  if (!btn) return;
  currentPeriod = btn.dataset.period;
  periodToggle.querySelectorAll('.period-toggle__btn').forEach((el) => {
    el.classList.toggle('period-toggle__btn--active', el === btn);
  });
  loadTrends();
});

[filterBrand, filterPlatform, filterRegion, filterGroup].forEach((el) => {
  el.addEventListener('change', loadTrends);
});

exportTrendsBtn.addEventListener('click', exportTrends);

function buildQuery() {
  const params = new URLSearchParams({ period: currentPeriod });
  if (filterBrand.value) params.set('websiteId', filterBrand.value);
  if (filterPlatform.value) params.set('platform', filterPlatform.value);
  if (filterRegion.value) params.set('region', filterRegion.value);
  if (filterGroup.value) params.set('group', filterGroup.value);
  return `?${params.toString()}`;
}

function fillFilters(data) {
  const fillSelect = (select, values) => {
    const current = select.value;
    select.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
    values.forEach(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = current;
  };

  fillSelect(
    filterBrand,
    sortByBrandName(data.filters?.websites || [], 'name').map((s) => ({ value: s.id, label: s.name }))
  );
  fillSelect(
    filterPlatform,
    (data.filters?.platforms || []).map((p) => ({ value: p, label: p }))
  );
  fillSelect(
    filterRegion,
    (data.filters?.regions || []).map((r) => ({ value: r, label: r }))
  );
}

function renderSummary(summary) {
  const cards = [
    { label: 'Brands tracked', value: summary.totalBrands, tone: 'neutral' },
    { label: 'Improved', value: summary.improved, tone: 'good' },
    { label: 'Regressed', value: summary.regressed, tone: 'poor' },
    { label: 'Unchanged', value: summary.unchanged, tone: 'pending' },
  ];
  trendsSummary.innerHTML = cards
    .map(
      (card) =>
        `<article class="summary-card summary-card--${card.tone}"><span class="summary-card__value">${card.value}</span><span class="summary-card__label">${card.label}</span></article>`
    )
    .join('');
}

function improvementCell(improvement) {
  if (!improvement || improvement.start == null) return '—';
  return `
    <span class="trend-change">
      ${improvement.start} → <strong style="color:${scoreColor(improvement.end)}">${improvement.end}</strong>
      ${renderDelta(improvement.change)}
    </span>
  `;
}

function renderBrands(brands) {
  if (!brands.length) {
    trendsEmpty.hidden = false;
    trendsBody.innerHTML = '';
    trendsCharts.innerHTML = '';
    return;
  }

  trendsEmpty.hidden = true;
  trendsBody.innerHTML = brands
    .map((brand) => {
      const rowClass =
        (brand.avgImprovement.change ?? 0) > 0
          ? 'reports-row reports-row--improved'
          : (brand.avgImprovement.change ?? 0) < 0
            ? 'reports-row reports-row--regressed'
            : 'reports-row';
      return `
        <tr class="${rowClass}">
          <td class="reports-url">
            <strong><a href="brand.html?id=${brand.id}">${brand.name}</a></strong>
            ${brand.platform ? `<span class="tag tag--platform">${brand.platform}</span>` : ''}
          </td>
          <td class="sparkline-cell">${renderSparkline(brand.mobile.points, 120, 32, brand.mobile.improvement)}</td>
          <td>${improvementCell(brand.mobile.improvement)}</td>
          <td class="sparkline-cell">${renderSparkline(brand.desktop.points, 120, 32, brand.desktop.improvement)}</td>
          <td>${improvementCell(brand.desktop.improvement)}</td>
          <td>${improvementCell(brand.avgImprovement)}</td>
          <td><a class="link-btn" href="brand.html?id=${brand.id}">Details</a></td>
        </tr>
      `;
    })
    .join('');

  trendsCharts.innerHTML = brands
    .slice(0, 6)
    .map(
      (brand) => `
      <article class="trends-brand-card card">
        <h3><a href="brand.html?id=${brand.id}">${brand.name}</a></h3>
        <div class="brand-trends__grid">
          ${renderTrendChart(brand.mobile.points, 'Mobile', { width: 480, height: 160, improvement: brand.mobile.improvement })}
          ${renderTrendChart(brand.desktop.points, 'Desktop', { width: 480, height: 160, improvement: brand.desktop.improvement })}
        </div>
        <div class="trends-brand-card__summary">
          ${renderTrendSummary(brand.avgImprovement, periodLabel(currentPeriod))}
        </div>
      </article>
    `
    )
    .join('');
}

function exportTrends() {
  if (!cachedData?.brands?.length) return;
  const rows = [
    [
      'Brand',
      'Platform',
      'Period',
      'Mobile Start',
      'Mobile End',
      'Mobile Change',
      'Desktop Start',
      'Desktop End',
      'Desktop Change',
      'Avg Change',
    ],
    ...cachedData.brands.map((b) => [
      b.name,
      b.platform || '',
      periodLabel(currentPeriod),
      b.mobile.improvement.start,
      b.mobile.improvement.end,
      b.mobile.improvement.change,
      b.desktop.improvement.start,
      b.desktop.improvement.end,
      b.desktop.improvement.change,
      b.avgImprovement.change,
    ]),
  ];
  downloadCsv(`pagespeed-trends-${currentPeriod}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

async function loadTrends() {
  trendsError.hidden = true;
  trendsTableTitle.textContent = `${periodLabel(currentPeriod)} improvement by brand`;
  pageLoadStart(trendsContent, trendsLoading);

  try {
    const response = await apiFetch(`/api/trends${buildQuery()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load trends');

    cachedData = data;
    fillFilters(data);
    renderSummary(data.summary || {});
    renderBrands(data.brands || []);
  } catch (error) {
    trendsError.hidden = false;
    trendsError.textContent = error.message;
  } finally {
    pageLoadEnd(trendsContent, trendsLoading);
  }
}

loadTrends();
