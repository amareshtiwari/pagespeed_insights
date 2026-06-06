const viewTabs = document.getElementById('view-tabs');
const deviceToggle = document.getElementById('device-toggle');
const groupToggle = document.getElementById('group-toggle');
const metricToggle = document.getElementById('metric-toggle');
const filterRegion = document.getElementById('filter-region');
const filterPlatform = document.getElementById('filter-platform');
const filterBrand = document.getElementById('filter-brand');
const brandFilterWrap = document.getElementById('brand-filter-wrap');
const cwvLoading = document.getElementById('cwv-loading');
const cwvError = document.getElementById('cwv-error');
const metaLine = document.getElementById('cwv-meta-line');
const panels = {
  hygiene: document.getElementById('hygiene-view'),
  brand: document.getElementById('brand-view'),
  interval: document.getElementById('interval-view'),
  compare: document.getElementById('compare-view'),
};

const state = {
  view: 'hygiene',
  device: 'mobile',
  group: '',
  region: '',
  platform: '',
  websiteId: '',
  metric: 'LCP',
  sortBy: null,
  sortDir: 'desc',
  compareSelection: new Set(),
};

let cachedData = null;
let activeCharts = [];

function destroyCharts() {
  activeCharts.forEach((chart) => safeChartDestroy(chart));
  activeCharts = [];
}

function buildQuery() {
  const params = new URLSearchParams();
  if (state.group) params.set('group', state.group);
  if (state.region) params.set('region', state.region);
  if (state.platform) params.set('platform', state.platform);
  if (state.websiteId) params.set('websiteId', state.websiteId);
  params.set('device', state.device);
  params.set('metric', state.metric);
  return params.toString() ? `?${params}` : '';
}

function updateControlsVisibility() {
  brandFilterWrap.hidden = state.view !== 'brand';
  metricToggle.hidden = state.view === 'hygiene';
  deviceToggle.hidden = state.view === 'hygiene';
}

function setActiveSegment(container, attr, value) {
  container.querySelectorAll(`[data-${attr}]`).forEach((btn) => {
    btn.classList.toggle('segmented__btn--active', btn.dataset[attr] === value);
  });
}

function fillSelect(select, values, current) {
  const first = select.querySelector('option');
  select.innerHTML = '';
  if (first) select.appendChild(first);
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = current;
}

function initMetricToggle() {
  metricToggle.querySelectorAll('button[data-metric]').forEach((btn) => btn.remove());
  CWV_METRICS.forEach((metric, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `segmented__btn${metric.short === state.metric ? ' segmented__btn--active' : ''}`;
    btn.dataset.metric = metric.short;
    btn.textContent = metric.short;
    btn.addEventListener('click', () => {
      state.metric = metric.short;
      setActiveSegment(metricToggle, 'metric', state.metric);
      loadData();
    });
    metricToggle.appendChild(btn);
  });
}

function bindEvents() {
  viewTabs.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-view]');
    if (!btn) return;
    state.view = btn.dataset.view;
    viewTabs.querySelectorAll('[data-view]').forEach((el) => {
      el.classList.toggle('view-tabs__btn--active', el === btn);
    });
    updateControlsVisibility();
    render();
  });

  deviceToggle.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-device]');
    if (!btn) return;
    state.device = btn.dataset.device;
    setActiveSegment(deviceToggle, 'device', state.device);
    loadData();
  });

  groupToggle.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-group]');
    if (!btn) return;
    state.group = btn.dataset.group;
    setActiveSegment(groupToggle, 'group', state.group);
    loadData();
  });

  filterRegion.addEventListener('change', () => {
    state.region = filterRegion.value;
    loadData();
  });

  filterPlatform.addEventListener('change', () => {
    state.platform = filterPlatform.value;
    loadData();
  });

  filterBrand.addEventListener('change', () => {
    state.websiteId = filterBrand.value;
    loadData();
  });
}

function sortHygieneRows(rows) {
  const sorted = [...rows];
  if (!state.sortBy) {
    sorted.sort((a, b) => b.severity - a.severity || (b.M_LCP ?? 0) - (a.M_LCP ?? 0));
    return sorted;
  }
  const dir = state.sortDir === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    if (state.sortBy === 'name') return a.name.localeCompare(b.name) * dir;
    if (state.sortBy === 'platform') return (a.platform || '').localeCompare(b.platform || '') * dir;
    if (state.sortBy === 'group') return (a.group || '').localeCompare(b.group || '') * dir;
    const av = a[state.sortBy];
    const bv = b[state.sortBy];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * dir;
  });
  return sorted;
}

function sortArrow(col) {
  if (state.sortBy !== col) return '';
  return state.sortDir === 'asc' ? ' ▲' : ' ▼';
}

function bindHygieneSort(table) {
  table.querySelectorAll('[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.sortBy === col) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = col;
        state.sortDir = col === 'name' ? 'asc' : 'desc';
      }
      renderHygiene();
    });
  });
}

function renderHygiene() {
  const rows = sortHygieneRows(cachedData?.hygiene || []);
  const summary = cachedData?.summary || {};
  const filterBits = [state.group, state.region, state.platform].filter(Boolean);
  const cohort = filterBits.length ? filterBits.join(' · ') : 'all brands';

  const metricHeaders = CWV_METRICS.map(
    (m) => `<th colspan="2" class="cwv-th-metric">${m.short}</th>`
  ).join('');

  const subHeaders = CWV_METRICS.map(() => '<th class="cwv-th-sub">M</th><th class="cwv-th-sub">D</th>').join('');

  const tbody = rows
    .map(
      (row) => `
    <tr class="${row.severity > 0 ? 'cwv-row--attention' : ''}">
      <td class="cwv-brand-cell">
        <strong><a href="brand.html?id=${row.id}">${row.name}</a></strong>
        <span class="text-muted cwv-brand-url">${row.url}</span>
        ${row.region ? cwvTag(row.region, 'region') : ''}
      </td>
      <td class="cwv-sticky-col">${row.platform ? cwvTag(row.platform, 'platform') : '—'}</td>
      <td class="cwv-sticky-col cwv-sticky-col--type">${row.group ? cwvTag(row.group, 'group') : '—'}</td>
      ${CWV_METRICS.map((m) => `<td>${cwvHygieneCell(m.short, row[`M_${m.short}`])}</td><td>${cwvHygieneCell(m.short, row[`D_${m.short}`])}</td>`).join('')}
    </tr>`
    )
    .join('');

  panels.hygiene.innerHTML = `
    <div class="cwv-panel__head">
      <div class="cwv-panel__head-main">
        <h2>Tech Hygiene — All Brands</h2>
        <p class="text-muted">Field data — what real users see (latest CrUX 28-day snapshot). Click column headers to sort.</p>
      </div>
      <p class="cwv-cohort-summary">
        <strong>${summary.totalBrands || 0}</strong> ${cohort} ·
        <strong>${summary.cleanBrands || 0}</strong> with no Poor metrics ·
        <strong>${summary.issueBrands || 0}</strong> need attention ·
        <strong>${summary.totalPoorMetrics || 0}</strong> Poor metrics flagged
      </p>
    </div>
    <div class="table-scroll table-scroll--cwv">
      <table class="data-table cwv-hygiene-table">
        <thead>
          <tr>
            <th rowspan="2" data-sort="name" class="cwv-sortable cwv-brand-cell">Brand${sortArrow('name')}</th>
            <th rowspan="2" data-sort="platform" class="cwv-sortable cwv-sticky-col">Platform${sortArrow('platform')}</th>
            <th rowspan="2" data-sort="group" class="cwv-sortable cwv-sticky-col cwv-sticky-col--type">Type${sortArrow('group')}</th>
            ${metricHeaders}
          </tr>
          <tr>${subHeaders}</tr>
        </thead>
        <tbody>${tbody || '<tr><td colspan="13">No CrUX data for current filters.</td></tr>'}</tbody>
      </table>
    </div>
    <p class="table-scroll-hint">← Scroll horizontally to see all metrics →</p>
  `;

  bindHygieneSort(panels.hygiene);
}

function renderBrand() {
  destroyCharts();
  const brand = cachedData?.brand;
  if (!brand?.detail) {
    panels.brand.innerHTML = `
      <div class="card">
        <p class="text-muted">Select a brand from the filter above to view 25-week CrUX trends.</p>
      </div>`;
    return;
  }

  const device = state.device === 'desktop' ? 'desktop' : 'mobile';
  const block = brand.detail.devices[device];
  if (!block) {
    panels.brand.innerHTML = `<div class="card"><p class="text-muted">No ${device} CrUX data for this brand.</p></div>`;
    return;
  }

  const cards = CWV_METRICS.map((metric) => {
    const data = block.metrics[metric.short];
    if (!data) return '';
    const interval = data.interval || {};
    return `
      <article class="cwv-metric-card cwv-metric-card--${data.bucket}">
        <div class="cwv-metric-card__head">
          <h3>${metric.short}</h3>
          <span class="cwv-pill cwv-pill--${data.bucket}">${cwvBucketLabel(data.bucket)}</span>
        </div>
        <p class="cwv-metric-card__value">${data.formatted}</p>
        <p class="cwv-metric-card__delta">${cwvDeltaHtml(interval.deltaP1, interval.deltaClassP1)} vs prev 28d</p>
        <canvas class="cwv-spark" data-metric="${metric.short}" height="60"></canvas>
      </article>`;
  }).join('');

  panels.brand.innerHTML = `
    <section class="card cwv-brand-card">
      <div class="cwv-brand-header">
        <div class="cwv-brand-header__main">
          <h2>${brand.name}</h2>
          <p class="text-muted">${brand.url} · ${device === 'mobile' ? 'Mobile' : 'Desktop'} · ${brand.detail.weeks} weekly snapshots</p>
          <div class="tag-row">${[brand.platform, brand.region, brand.group].filter(Boolean).map((t, i) => cwvTag(t, ['platform', 'region', 'group'][i])).join('')}</div>
        </div>
        <div class="cwv-brand-actions">
          <a class="btn-secondary" href="brand.html?id=${brand.id}">Brand detail</a>
          <a class="btn-secondary" href="actions.html?websiteId=${brand.id}">Action items</a>
        </div>
      </div>
      <div class="cwv-metric-grid cwv-brand-metrics">${cards}</div>
    </section>
    <section class="card cwv-brand-chart-card">
      <h3>25-week trend — ${state.metric}</h3>
      <div class="cwv-brand-chart-wrap">
        <canvas id="brand-detail-chart" aria-label="25-week trend chart"></canvas>
      </div>
    </section>
  `;

  panels.brand.querySelectorAll('.cwv-spark').forEach((canvas) => {
    if (typeof Chart === 'undefined') return;
    const metricId = canvas.dataset.metric;
    const metricData = block.metrics[metricId];
    if (!metricData) return;
    const bucket = cwvBucket(metricId, metricData.latest);
    const colors = CWV_BUCKET_COLORS[bucket];
    activeCharts.push(
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: block.labels,
          datasets: [{
            data: metricData.p75s,
            borderColor: colors.line,
            backgroundColor: colors.fill,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 1.5,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { display: false }, y: { display: false } },
        },
      })
    );
  });

  const detailCanvas = document.getElementById('brand-detail-chart');
  const detailMetric = block.metrics[state.metric];
  if (detailCanvas && detailMetric && typeof Chart !== 'undefined') {
    const bucket = cwvBucket(state.metric, detailMetric.latest);
    const colors = CWV_BUCKET_COLORS[bucket];
    activeCharts.push(
      new Chart(detailCanvas, {
        type: 'line',
        data: {
          labels: block.labels,
          datasets: [{
            label: state.metric,
            data: detailMetric.p75s,
            borderColor: colors.line,
            backgroundColor: colors.fill,
            fill: true,
            tension: 0.25,
            pointRadius: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { ticks: { callback: (v) => cwvFormat(state.metric, v) } },
          },
        },
      })
    );
  }
}

function renderInterval() {
  const rows = cachedData?.interval || [];
  const deviceLabel = state.device === 'desktop' ? 'Desktop' : 'Mobile';

  panels.interval.innerHTML = `
    <div class="cwv-panel__head">
      <div class="cwv-panel__head-main">
        <h2>Interval Comparison — ${state.metric} (${deviceLabel})</h2>
        <p class="text-muted">Current vs previous 28-day periods from CrUX field data.</p>
      </div>
    </div>
    <div class="table-scroll table-scroll--cwv">
      <table class="data-table cwv-data-table">
        <thead>
          <tr>
            <th>Brand</th>
            <th>Type</th>
            <th>Current</th>
            <th>vs −4w</th>
            <th>Δ</th>
            <th>vs −8w</th>
            <th>Δ</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
            <tr>
              <td><a href="brand.html?id=${row.id}">${row.name}</a></td>
              <td>${row.group || '—'}</td>
              <td><span class="cwv-pill cwv-pill--${row.bucket}">${row.formatted.cur}</span></td>
              <td>${row.formatted.p1}</td>
              <td>${cwvDeltaHtml(row.deltaP1, row.deltaClassP1)}</td>
              <td>${row.formatted.p2}</td>
              <td>${cwvDeltaHtml(row.deltaP2, row.deltaClassP2)}</td>
            </tr>`
            )
            .join('') || '<tr><td colspan="7" class="cwv-data-table__empty">No data for current filters.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function rankCompareBrands(brands) {
  return [...brands].sort((a, b) => (a.latest ?? Infinity) - (b.latest ?? Infinity));
}

function renderCompare() {
  destroyCharts();
  const brands = cachedData?.compare?.brands || [];
  if (!state.compareSelection.size && brands.length) {
    rankCompareBrands(brands)
      .slice(0, 10)
      .forEach((b) => state.compareSelection.add(b.id));
  }

  const validIds = new Set(brands.map((b) => b.id));
  state.compareSelection = new Set([...state.compareSelection].filter((id) => validIds.has(id)));

  panels.compare.innerHTML = `
    <div class="cwv-panel__head">
      <div class="cwv-panel__head-main">
        <h2>Compare brands — ${state.metric} (${state.device === 'desktop' ? 'Desktop' : 'Mobile'})</h2>
        <p class="text-muted">${brands.length} brands · select up to 10 for overlay chart</p>
      </div>
    </div>
    <div class="cwv-compare-toolbar">
      <button type="button" class="btn-secondary btn--sm" id="compare-select-all">Select all</button>
      <button type="button" class="btn-secondary btn--sm" id="compare-clear">Clear</button>
      <button type="button" class="btn-secondary btn--sm" id="compare-top10">Top 10 latest</button>
      <button type="button" class="btn-secondary btn--sm" id="compare-bottom10">Bottom 10 latest</button>
    </div>
    <div class="cwv-compare-checkboxes" id="compare-checkboxes">
      ${brands
        .map(
          (b) => `
        <label class="brand-checkbox">
          <input type="checkbox" data-id="${b.id}" ${state.compareSelection.has(b.id) ? 'checked' : ''}>
          ${b.name} ${b.group ? cwvTag(b.group, 'group') : ''}
        </label>`
        )
        .join('')}
    </div>
    <div class="cwv-compare-chart-wrap">
      <canvas id="compare-chart" aria-label="Brand comparison chart"></canvas>
    </div>
  `;

  panels.compare.querySelector('#compare-select-all').addEventListener('click', () => {
    brands.forEach((b) => state.compareSelection.add(b.id));
    renderCompare();
  });
  panels.compare.querySelector('#compare-clear').addEventListener('click', () => {
    state.compareSelection.clear();
    renderCompare();
  });
  panels.compare.querySelector('#compare-top10').addEventListener('click', () => {
    state.compareSelection = new Set(rankCompareBrands(brands).slice(0, 10).map((b) => b.id));
    renderCompare();
  });
  panels.compare.querySelector('#compare-bottom10').addEventListener('click', () => {
    state.compareSelection = new Set(rankCompareBrands(brands).slice(-10).map((b) => b.id));
    renderCompare();
  });

  panels.compare.querySelectorAll('#compare-checkboxes input').forEach((input) => {
    input.addEventListener('change', () => {
      const id = Number(input.dataset.id);
      if (input.checked) state.compareSelection.add(id);
      else state.compareSelection.delete(id);
      drawCompareChart(brands);
    });
  });

  drawCompareChart(brands);
}

function drawCompareChart(brands) {
  destroyCharts();
  const canvas = document.getElementById('compare-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const selected = brands.filter((b) => state.compareSelection.has(b.id));
  let labels = [];
  const datasets = selected.map((brand, index) => {
    if (!labels.length) labels = brand.labels;
    const color = CWV_PALETTE[index % CWV_PALETTE.length];
    return {
      label: brand.name,
      data: brand.series,
      borderColor: color,
      backgroundColor: `${color}18`,
      borderWidth: 2,
      fill: false,
      tension: 0.25,
      pointRadius: 1.5,
    };
  });

  activeCharts.push(
      new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { ticks: { callback: (v) => cwvFormat(state.metric, v) } },
        },
      },
    })
  );
}

function render() {
  Object.entries(panels).forEach(([key, panel]) => {
    panel.hidden = key !== state.view;
  });

  if (!cachedData) return;

  if (state.view === 'hygiene') renderHygiene();
  if (state.view === 'brand') renderBrand();
  if (state.view === 'interval') renderInterval();
  if (state.view === 'compare') renderCompare();
}

async function loadData() {
  cwvError.hidden = true;
  cwvLoading.hidden = false;
  if (!cachedData) {
    Object.values(panels).forEach((p) => { p.hidden = true; });
  }

  try {
    const response = await apiFetch(`/api/cwv${buildQuery()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load CWV data');

    cachedData = data;

    fillSelect(filterRegion, data.filters?.regions || [], state.region);
    fillSelect(filterPlatform, data.filters?.platforms || [], state.platform);

    const brandOptions = sortByBrandName(data.filters?.websites || [], 'name');
    filterBrand.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
    brandOptions.forEach((site) => {
      const option = document.createElement('option');
      option.value = site.id;
      option.textContent = site.name;
      filterBrand.appendChild(option);
    });
    if (state.websiteId) filterBrand.value = state.websiteId;
    else if (brandOptions.length && state.view === 'brand') {
      state.websiteId = String(brandOptions[0].id);
      filterBrand.value = state.websiteId;
    }

    if (data.meta?.importedAt) {
      const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(data.meta.importedAt));
      metaLine.textContent = `${data.meta.brandCount || 0} brands tracked · CrUX imported ${date} · plus live Lighthouse analysis, action items, and full reports.`;
    }

    cwvLoading.hidden = true;
    render();
  } catch (error) {
    cwvLoading.hidden = true;
    cwvError.hidden = false;
    cwvError.textContent = error.message;
  }
}

initMetricToggle();
bindEvents();
updateControlsVisibility();

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('websiteId')) state.websiteId = urlParams.get('websiteId');
if (urlParams.get('view') && panels[urlParams.get('view')]) {
  state.view = urlParams.get('view');
  viewTabs.querySelectorAll('[data-view]').forEach((el) => {
    el.classList.toggle('view-tabs__btn--active', el.dataset.view === state.view);
  });
  updateControlsVisibility();
}

loadData();
