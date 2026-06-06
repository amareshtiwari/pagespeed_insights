const reportsBody = document.getElementById('reports-body');
const reportsError = document.getElementById('reports-error');
const reportsLoading = document.getElementById('reports-loading');
const reportsTableWrap = document.getElementById('reports-table-wrap');
const reportsEmpty = document.getElementById('reports-empty');
const reportsCount = document.getElementById('reports-count');
const refreshBtn = document.getElementById('refresh-btn');
const exportBtn = document.getElementById('export-btn');
const filterWebsite = document.getElementById('filter-website');
const filterStrategy = document.getElementById('filter-strategy');
const filterPlatform = document.getElementById('filter-platform');

const urlParams = new URLSearchParams(window.location.search);
let cachedReports = [];
let websiteMap = new Map();

refreshBtn.addEventListener('click', loadReports);
exportBtn.addEventListener('click', exportReports);
[filterWebsite, filterStrategy, filterPlatform].forEach((el) => {
  el.addEventListener('change', loadReports);
});

if (urlParams.get('websiteId')) {
  filterWebsite.dataset.pending = urlParams.get('websiteId');
}

function buildQuery() {
  const params = new URLSearchParams();
  if (filterWebsite.value) params.set('websiteId', filterWebsite.value);
  if (filterStrategy.value) params.set('strategy', filterStrategy.value);
  if (filterPlatform.value) params.set('platform', filterPlatform.value);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function scoreCell(score) {
  if (score == null) return '—';
  const color = scoreColor(score);
  return `<span class="score-pill" style="color:${color}">${score}</span>`;
}

function cwvCell(passed) {
  return passed
    ? '<span class="cwv-badge cwv-badge--passed">Passed</span>'
    : '<span class="cwv-badge cwv-badge--failed">Failed</span>';
}

function brandLabel(report) {
  const site = report.websiteId ? websiteMap.get(report.websiteId) : null;
  const name = site?.name || hostnameFromUrl(report.url);
  const brandLink = site ? `<a href="brand.html?id=${site.id}">${name}</a>` : name;
  return `<strong>${brandLink}</strong><span>${report.url}</span>`;
}

function renderReports(reports) {
  cachedReports = reports;

  if (!reports.length) {
    reportsEmpty.hidden = false;
    reportsBody.innerHTML = '';
    reportsCount.hidden = true;
    return;
  }

  reportsEmpty.hidden = true;
  reportsCount.hidden = false;
  reportsCount.textContent = `${reports.length} report${reports.length === 1 ? '' : 's'}`;

  reportsBody.innerHTML = reports
    .map(
      (report) => `
      <tr class="reports-row" data-id="${report.id}">
        <td class="reports-url">${brandLabel(report)}</td>
        <td>${report.strategy}</td>
        <td>${formatDate(report.createdAt)}</td>
        <td>${scoreCell(report.performanceScore)}</td>
        <td>${scoreCell(report.accessibilityScore)}</td>
        <td>${scoreCell(report.bestPracticesScore)}</td>
        <td>${scoreCell(report.seoScore)}</td>
        <td>${cwvCell(report.cwvPassed)}</td>
        <td><a class="link-btn" href="index.html?reportId=${report.id}">View</a></td>
      </tr>
    `
    )
    .join('');

  reportsBody.querySelectorAll('.reports-row').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      window.location.href = `index.html?reportId=${row.dataset.id}`;
    });
  });
}

function fillWebsiteFilter(websites) {
  const pending = filterWebsite.dataset.pending;
  filterWebsite.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
  sortByBrandName(websites).forEach((site) => {
    websiteMap.set(site.id, site);
    const option = document.createElement('option');
    option.value = site.id;
    option.textContent = site.name;
    filterWebsite.appendChild(option);
  });
  if (pending) {
    filterWebsite.value = pending;
    delete filterWebsite.dataset.pending;
  }
}

function fillPlatformFilter(platforms) {
  const current = filterPlatform.value;
  filterPlatform.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
  platforms.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    filterPlatform.appendChild(option);
  });
  filterPlatform.value = current;
}

function exportReports() {
  if (!cachedReports.length) return;

  const rows = [
    ['Brand', 'URL', 'Strategy', 'Date', 'Performance', 'Accessibility', 'Best Practices', 'SEO', 'CWV Passed'],
    ...cachedReports.map((report) => {
      const site = report.websiteId ? websiteMap.get(report.websiteId) : null;
      return [
        site?.name || hostnameFromUrl(report.url),
        report.url,
        report.strategy,
        report.createdAt,
        report.performanceScore,
        report.accessibilityScore,
        report.bestPracticesScore,
        report.seoScore,
        report.cwvPassed ? 'Yes' : 'No',
      ];
    }),
  ];

  downloadCsv(`pagespeed-reports-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

async function loadReports() {
  reportsError.hidden = true;
  pageLoadStart(reportsTableWrap, reportsLoading);

  try {
    const [reportsRes, dashboardRes] = await Promise.all([
      apiFetch(`/api/reports${buildQuery()}`),
      apiFetch('/api/dashboard'),
    ]);
    const reportsData = await reportsRes.json();
    const dashboardData = await dashboardRes.json();

    if (!reportsRes.ok) throw new Error(reportsData.error || 'Failed to load reports');

    fillWebsiteFilter(dashboardData.websites || []);
    fillPlatformFilter(dashboardData.filters?.platforms || []);
    renderReports(reportsData.reports || []);
  } catch (error) {
    reportsError.hidden = false;
    reportsError.textContent = error.message || 'Unable to load reports. Is the backend running?';
  } finally {
    pageLoadEnd(reportsTableWrap, reportsLoading);
  }
}

loadReports();
