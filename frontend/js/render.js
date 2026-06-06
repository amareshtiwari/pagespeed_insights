const METRIC_DOCS = {
  LCP: 'https://web.dev/articles/lcp',
  INP: 'https://web.dev/articles/inp',
  CLS: 'https://web.dev/articles/cls',
  FCP: 'https://web.dev/articles/fcp',
  TTFB: 'https://web.dev/articles/ttfb',
  TBT: 'https://web.dev/articles/tbt',
  SI: 'https://web.dev/articles/speed-index',
};

function renderCategoryGauge(category) {
  const score = category?.score ?? '—';
  const color = scoreColor(category?.score);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const pct = category?.score != null ? category.score / 100 : 0;
  const dash = circumference * pct;

  return `
    <div class="category-gauge" title="${category?.label || ''}">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="${radius}" fill="none" stroke="#e8eaed" stroke-width="6"></circle>
        <circle cx="32" cy="32" r="${radius}" fill="none" stroke="${color}" stroke-width="6"
          stroke-dasharray="${dash} ${circumference}" stroke-linecap="round"
          transform="rotate(-90 32 32)"></circle>
      </svg>
      <span class="category-gauge__score" style="color:${color}">${score}</span>
      <span class="category-gauge__label">${category?.label || ''}</span>
    </div>
  `;
}

function renderLabMetric(metric) {
  const icon = metric.category === 'good' ? '●' : metric.category === 'needs-improvement' ? '■' : '▲';
  return `
    <div class="lab-metric lab-metric--${metric.category}">
      <span class="lab-metric__icon" aria-hidden="true">${icon}</span>
      <span class="lab-metric__name">${metric.name}</span>
      <span class="lab-metric__value">${metric.displayValue}</span>
    </div>
  `;
}

function renderMetric(metric) {
  const docUrl = METRIC_DOCS[metric.id] || '#';
  const experimental = metric.isExperimental
    ? '<span class="metric__experimental" title="Experimental metric">🧪</span>'
    : '';

  return `
    <article class="metric">
      <div class="metric__head">
        <span class="metric__status metric__status--${metric.category}" aria-hidden="true"></span>
        <p class="metric__name">
          <a href="${docUrl}" target="_blank" rel="noopener noreferrer">${metric.name}</a>
          ${experimental}
        </p>
      </div>
      <p class="metric__value metric__value--${metric.category}">${metric.displayValue}</p>
      <div class="progress-bar" role="img" aria-label="${metric.name}: ${metric.displayValue}">
        <div class="progress-bar__segment progress-bar__segment--good"></div>
        <div class="progress-bar__segment progress-bar__segment--needs"></div>
        <div class="progress-bar__segment progress-bar__segment--poor"></div>
        <span class="progress-bar__marker" style="left: ${metric.progress}%"></span>
      </div>
    </article>
  `;
}

function renderFieldMetadata(meta) {
  const items = [
    { icon: calendarIcon(), text: meta.period, link: { label: 'history', href: 'https://developers.google.com/speed/docs/insights/v5/about' } },
    { icon: deviceIcon(), text: meta.devices },
    { icon: samplesIcon(), text: 'Many samples', link: { label: 'Chrome UX Report', href: 'https://developer.chrome.com/docs/crux' } },
    { icon: stopwatchIcon(), text: meta.visitDuration },
    { icon: networkIcon(), text: meta.network },
    { icon: chromeIcon(), text: meta.browser },
  ];

  return items
    .map(({ icon, text, link }) => {
      const linkHtml = link
        ? ` (<a href="${link.href}" target="_blank" rel="noopener noreferrer">${link.label}</a>)`
        : '';
      return `<div class="metadata__item">${icon}<span>${text || ''}${linkHtml}</span></div>`;
    })
    .join('');
}

function renderLabMetadata(meta) {
  if (!meta) return '';
  const items = [
    { icon: calendarIcon(), text: `Captured at ${formatDate(meta.capturedAt)}` },
    { icon: deviceIcon(), text: `Emulated ${meta.formFactor || 'mobile'} with Lighthouse` },
    { icon: networkIcon(), text: meta.throttling },
    { icon: chromeIcon(), text: meta.browser },
    { icon: stopwatchIcon(), text: `${meta.sessionType}, ${meta.loadType}` },
  ];

  return items
    .map(({ icon, text }) => `<div class="metadata__item">${icon}<span>${text}</span></div>`)
    .join('');
}

function normalizeScreenshot(value) {
  if (!value) return null;

  let result = String(value).trim();
  result = result.replace(
    /^data:(image\/[^;]+);base64,data:image\/[^;]+;base64,/,
    (_match, mime) => `data:${mime};base64,`
  );

  if (!result.startsWith('data:')) {
    result = `data:image/jpeg;base64,${result}`;
  }

  return result;
}

function $(root, selector) {
  return root.querySelector(selector);
}

function setText(root, selector, value) {
  const el = $(root, selector);
  if (el) el.textContent = value;
}

function setHtml(root, selector, value) {
  const el = $(root, selector);
  if (el) el.innerHTML = value;
}

function renderCwvMetricsGrid(data, root) {
  const core = data.coreWebVitals || [];
  const other = data.otherMetrics || [];
  const grid = $(root, '#metrics-grid');
  const coreEl = $(root, '#core-metrics');
  const otherEl = $(root, '#other-metrics');

  const coreHtml = core.map(renderMetric).join('');
  const otherHtml = other.map(renderMetric).join('');

  if (grid) {
    let html = coreHtml;
    if (core.length && other.length) {
      html += '<div class="metrics-divider metrics-divider--grid"><span>Other notable metrics</span></div>';
    }
    html += otherHtml;
    grid.innerHTML = html;
    return;
  }

  if (coreEl) coreEl.innerHTML = coreHtml;
  if (otherEl) otherEl.innerHTML = otherHtml;
}

function renderFullReport(data, root) {
  setText(root, '#result-url', data.url);
  setText(
    root,
    '#report-meta',
    [data.strategy, data.reportId ? `Report #${data.reportId}` : null, formatDate(data.savedAt || data.capturedAt)]
      .filter(Boolean)
      .join(' · ')
  );

  const categories = data.categories || {};
  setHtml(
    root,
    '#category-gauges',
    ['performance', 'accessibility', 'bestPractices', 'seo']
      .map((key) => renderCategoryGauge(categories[key]))
      .join('')
  );

  const perfScore = categories.performance?.score ?? data.performanceScore;
  const perfRing = $(root, '#performance-ring');
  const perfScoreEl = $(root, '#performance-score-large');
  if (perfScore != null && perfRing && perfScoreEl) {
    perfScoreEl.textContent = perfScore;
    perfRing.style.setProperty('--ring-color', scoreColor(perfScore));
    perfRing.hidden = false;
  } else if (perfRing) {
    perfRing.hidden = true;
  }

  const screenshotEl = $(root, '#screenshot');
  const screenshotSrc = normalizeScreenshot(data.screenshot);
  if (screenshotEl) {
    if (screenshotSrc) {
      screenshotEl.onerror = () => {
        screenshotEl.hidden = true;
      };
      screenshotEl.src = screenshotSrc;
      screenshotEl.alt = `Screenshot of ${hostnameFromUrl(data.url)}`;
      screenshotEl.hidden = false;
    } else {
      screenshotEl.hidden = true;
    }
  }

  setHtml(root, '#lab-metrics', (data.labMetrics || []).map(renderLabMetric).join(''));
  setHtml(root, '#lab-metadata', renderLabMetadata(data.labMetadata));

  const passed = data.assessment?.passed;
  const assessmentLabel = $(root, '#assessment-label');
  const assessmentIcon = $(root, '#assessment-icon');
  if (assessmentLabel) {
    assessmentLabel.textContent = data.assessment?.label || '—';
    assessmentLabel.className = passed ? 'passed' : 'failed';
  }
  if (assessmentIcon) {
    assessmentIcon.className = `assessment__icon assessment__icon--${passed ? 'passed' : 'failed'}`;
    assessmentIcon.innerHTML = passed ? checkIcon() : failIcon();
  }

  renderCwvMetricsGrid(data, root);
  setHtml(root, '#metadata', renderFieldMetadata(data.metadata || {}));

  const results = $(root, '#results');
  if (results) results.hidden = false;
}

function checkIcon() {
  return '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';
}

function failIcon() {
  return '<svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm4 0h14v-2H7v2zm-4 4h2v-2H3v2zm4 0h14v-2H7v2zM3 7v2h2V7H3zm4 0v2h14V7H7z"/></svg>';
}

function calendarIcon() {
  return '<svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10z"/></svg>';
}

function deviceIcon() {
  return '<svg viewBox="0 0 24 24"><path d="M17 1H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm0 18H7V5h10v14z"/></svg>';
}

function samplesIcon() {
  return '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>';
}

function stopwatchIcon() {
  return '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>';
}

function networkIcon() {
  return '<svg viewBox="0 0 24 24"><path d="M1 9h2v2H1zm4 0h2v2H5zm14 0h2v2h-2zM1 13h2v2H1zm4 0h2v2H5zm14 0h2v2h-2zM9 5v2h6V5H9zm0 12v2h6v-2H9z"/></svg>';
}

function chromeIcon() {
  return '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9L12 12V2c5.52 0 10 4.48 10 10s-4.48 10-10 10z"/></svg>';
}
