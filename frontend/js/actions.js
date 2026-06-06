const filterBrand = document.getElementById('filter-brand');
const filterPlatform = document.getElementById('filter-platform');
const filterRegion = document.getElementById('filter-region');
const filterGroup = document.getElementById('filter-group');
const actionsSummary = document.getElementById('actions-summary');
const actionsError = document.getElementById('actions-error');
const actionsLoading = document.getElementById('actions-loading');
const actionsContent = document.getElementById('actions-content');
const actionsList = document.getElementById('actions-list');
const actionsEmpty = document.getElementById('actions-empty');

[filterBrand, filterPlatform, filterRegion, filterGroup].forEach((el) => {
  el.addEventListener('change', loadActions);
});

function buildQuery() {
  const params = new URLSearchParams();
  if (filterBrand.value) params.set('websiteId', filterBrand.value);
  if (filterPlatform.value) params.set('platform', filterPlatform.value);
  if (filterRegion.value) params.set('region', filterRegion.value);
  if (filterGroup.value) params.set('group', filterGroup.value);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
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
  actionsSummary.innerHTML = [
    { label: 'Brands with actions', value: summary.brandsWithActions, tone: 'neutral' },
    { label: 'Total suggestions', value: summary.totalActionItems, tone: 'pending' },
    { label: 'Brands tracked', value: summary.totalBrands, tone: 'neutral' },
  ]
    .map(
      (card) =>
        `<article class="summary-card summary-card--${card.tone}"><span class="summary-card__value">${card.value}</span><span class="summary-card__label">${card.label}</span></article>`
    )
    .join('');
}

function actionImpact(item) {
  if (item.savingsMs) return `Est. savings ${Math.round(item.savingsMs)} ms`;
  if (item.displayValue) return item.displayValue;
  if (item.score != null) return `Score ${item.score}`;
  return '';
}

function renderActionItem(item, strategy, reportId) {
  const impact = actionImpact(item);
  const typeClass = item.type === 'opportunity' ? 'action-item--opportunity' : 'action-item--audit';
  return `
    <li class="action-item ${typeClass}">
      <div class="action-item__head">
        <span class="action-item__category">${item.category}</span>
        <span class="action-item__strategy">${strategy}</span>
        ${impact ? `<span class="action-item__impact">${impact}</span>` : ''}
      </div>
      <h4 class="action-item__title">${item.title}</h4>
      <p class="action-item__desc">${item.description}</p>
      <a class="link-btn" href="index.html?reportId=${reportId}">View report</a>
    </li>
  `;
}

function renderStrategySection(label, data) {
  if (!data?.items?.length) {
    return `<div class="actions-strategy actions-strategy--empty"><h4>${label}</h4><p class="text-muted">No ${label.toLowerCase()} report yet.</p></div>`;
  }

  return `
    <div class="actions-strategy">
      <h4>${label} <span class="actions-strategy__score" style="color:${scoreColor(data.performanceScore)}">${data.performanceScore ?? '—'}</span></h4>
      <ul class="action-items">
        ${data.items.slice(0, 8).map((item) => renderActionItem(item, label, data.reportId)).join('')}
      </ul>
    </div>
  `;
}

function renderWebsiteCard(site) {
  return `
    <article class="actions-brand-card card" id="brand-actions-${site.websiteId}">
      <header class="actions-brand-card__header">
        <div>
          <h3><a href="brand.html?id=${site.websiteId}">${site.name}</a></h3>
          <p class="actions-brand-card__url">${site.url}</p>
          ${renderTags(site)}
        </div>
        <div class="actions-brand-card__meta">
          <span class="tag tag--group">${site.totalItems} priority items</span>
          <a class="link-btn" href="brand.html?id=${site.websiteId}">Brand details</a>
        </div>
      </header>
      <div class="actions-brand-card__grid">
        ${renderStrategySection('Mobile', site.mobile)}
        ${renderStrategySection('Desktop', site.desktop)}
      </div>
    </article>
  `;
}

function renderWebsites(websites) {
  if (!websites.length) {
    actionsEmpty.hidden = false;
    actionsList.innerHTML = '';
    return;
  }

  actionsEmpty.hidden = true;
  actionsList.innerHTML = websites.map(renderWebsiteCard).join('');
}

async function loadActions() {
  actionsError.hidden = true;
  pageLoadStart(actionsContent, actionsLoading);

  try {
    const response = await apiFetch(`/api/action-items${buildQuery()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load action items');

    fillFilters(data);
    renderSummary(data.summary || {});
    renderWebsites(data.websites || []);
  } catch (error) {
    actionsError.hidden = false;
    actionsError.textContent = error.message;
  } finally {
    pageLoadEnd(actionsContent, actionsLoading);
  }
}

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('websiteId')) {
  filterBrand.dataset.pending = urlParams.get('websiteId');
}

loadActions().then(() => {
  if (filterBrand.dataset.pending) {
    filterBrand.value = filterBrand.dataset.pending;
    delete filterBrand.dataset.pending;
    loadActions();
  }
});
