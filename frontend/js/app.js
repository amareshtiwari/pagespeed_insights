const form = document.getElementById('analyze-form');
const searchPanel = document.getElementById('search-panel');
const reportViewHeader = document.getElementById('report-view-header');
const reportStrategyToggle = document.getElementById('report-strategy-toggle');
const viewReportId = document.getElementById('view-report-id');
const viewReportUrl = document.getElementById('view-report-url');
const viewReportMeta = document.getElementById('view-report-meta');
const viewReportNotice = document.getElementById('view-report-notice');
const urlInput = document.getElementById('url-input');
const formError = document.getElementById('form-error');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const results = document.getElementById('results');
const cwvCard = document.getElementById('cwv-card');
const expandBtn = document.getElementById('expand-btn');

let viewMode = false;
let reportContext = null;

if (expandBtn && cwvCard) {
  expandBtn.addEventListener('click', () => {
    const collapsed = cwvCard.classList.toggle('is-collapsed');
    expandBtn.textContent = collapsed ? 'Expand view' : 'Collapse view';
  });
}

if (reportStrategyToggle) {
  reportStrategyToggle.addEventListener('change', (event) => {
    const strategy = event.target.value;
    if (!reportContext || !strategy) return;
    switchReportStrategy(strategy);
  });
}

if (form) {
  form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.hidden = true;
  formError.textContent = '';

  const url = urlInput.value.trim();
  const strategy = form.strategy.value;
  const apiBase = getApiBase();

  if (!url) {
    showError('Please enter a URL.');
    return;
  }

  setViewMode(false);
  setLoading(true, 'Running PageSpeed analysis…');

  try {
    const response = await fetch(
      `${apiBase}/api/analyze?url=${encodeURIComponent(url)}&strategy=${encodeURIComponent(strategy)}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    renderFullReport(data, document);
    if (cwvCard) cwvCard.classList.remove('is-collapsed');
    if (expandBtn) expandBtn.textContent = 'Collapse view';
    history.replaceState(null, '', `index.html?reportId=${data.reportId}`);
    await loadReportById(data.reportId);
  } catch (error) {
    showError(error.message || 'Unable to analyze this URL. Is the backend running?');
    results.hidden = true;
  } finally {
    setLoading(false);
  }
  });
}

function setViewMode(isViewing) {
  viewMode = isViewing;
  if (searchPanel) searchPanel.hidden = isViewing;
  if (reportViewHeader) reportViewHeader.hidden = !isViewing;
  document.title = isViewing ? 'PageSpeed Insights — Report' : 'PageSpeed Insights — Analyze';
}

function updateStrategyToggle(context, currentStrategy) {
  if (!reportStrategyToggle) return;
  const mobileInput = reportStrategyToggle.querySelector('[value="mobile"]');
  const desktopInput = reportStrategyToggle.querySelector('[value="desktop"]');

  mobileInput.disabled = !context.mobileReportId;
  desktopInput.disabled = !context.desktopReportId;

  mobileInput.closest('label').classList.toggle('strategy-toggle__option--disabled', !context.mobileReportId);
  desktopInput.closest('label').classList.toggle('strategy-toggle__option--disabled', !context.desktopReportId);

  const active = currentStrategy === 'desktop' ? desktopInput : mobileInput;
  active.checked = true;
}

function showReportHeader(data, context) {
  viewReportId.textContent = `#${data.reportId}`;
  viewReportUrl.textContent = data.url;
  updateStrategyToggle(context, data.strategy);

  let metaHtml = formatDate(data.savedAt || data.capturedAt);
  if (data.websiteId) {
    metaHtml += ` · <a href="brand.html?id=${data.websiteId}">View brand</a>`;
  }
  viewReportMeta.innerHTML = metaHtml;
  viewReportNotice.hidden = true;
}

function showMissingStrategyNotice(strategy) {
  viewReportNotice.hidden = false;
  viewReportNotice.textContent = `No saved ${strategy} report for this website yet. Run an analysis from the Dashboard or Brand page.`;
  results.hidden = true;
}

async function switchReportStrategy(strategy) {
  if (!reportContext) return;

  const reportId =
    strategy === 'mobile' ? reportContext.mobileReportId : reportContext.desktopReportId;

  if (!reportId) {
    showMissingStrategyNotice(strategy);
    return;
  }

  if (reportId === reportContext.currentReportId) return;

  await loadReportById(reportId, false);
}

async function loadReportById(reportId, showLoader = true) {
  if (showLoader) setLoading(true, 'Loading saved report…');
  formError.hidden = true;

  try {
    const [reportRes, contextRes] = await Promise.all([
      fetch(`${getApiBase()}/api/reports/${reportId}`),
      fetch(`${getApiBase()}/api/reports/${reportId}/context`),
    ]);
    const data = await reportRes.json();
    const context = await contextRes.json();

    if (!reportRes.ok) throw new Error(data.error || 'Report not found');
    if (!contextRes.ok) throw new Error(context.error || 'Report context not found');

    reportContext = context;
    setViewMode(true);
    renderFullReport(data, document);
    showReportHeader(data, context);
    if (cwvCard) cwvCard.classList.remove('is-collapsed');
    if (expandBtn) expandBtn.textContent = 'Collapse view';
    history.replaceState(null, '', `index.html?reportId=${reportId}`);
  } catch (error) {
    showError(error.message);
    results.hidden = true;
  } finally {
    if (showLoader) setLoading(false);
  }
}

async function loadReportFromQuery() {
  const reportId = new URLSearchParams(window.location.search).get('reportId');
  if (!reportId) {
    setViewMode(false);
    return;
  }

  await loadReportById(reportId);
}

function setLoading(isLoading, message = 'Running PageSpeed analysis…') {
  if (loading) loading.hidden = !isLoading;
  if (loadingText) loadingText.textContent = message;
  if (!viewMode && form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = isLoading;
  }
}

function showError(message) {
  if (!formError) return;
  formError.hidden = false;
  formError.textContent = message;
}

loadReportFromQuery();
