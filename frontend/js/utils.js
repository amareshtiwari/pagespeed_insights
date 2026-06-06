function renderDelta(delta) {
  if (delta == null || delta === 0) {
    return '<span class="delta delta--flat">—</span>';
  }
  if (delta > 0) {
    return `<span class="delta delta--up">▲ ${delta}</span>`;
  }
  return `<span class="delta delta--down">▼ ${Math.abs(delta)}</span>`;
}

function computeTrendDirection(trend) {
  if (!trend || !trend.length) {
    return { direction: 'flat', change: null, label: 'No data', start: null, end: null };
  }
  const valid = trend.filter((p) => p.score != null);
  if (valid.length < 2) {
    const score = valid[0]?.score ?? null;
    return { direction: 'flat', change: 0, label: 'Not enough data', start: score, end: score };
  }
  const start = valid[0].score;
  const end = valid[valid.length - 1].score;
  const change = end - start;
  if (change > 0) return { direction: 'up', change, label: 'Improving', start, end };
  if (change < 0) return { direction: 'down', change, label: 'Declining', start, end };
  return { direction: 'flat', change: 0, label: 'Stable', start, end };
}

function trendInfoFromImprovement(improvement) {
  if (!improvement || improvement.change == null) return null;
  if (improvement.change > 0) return { direction: 'up', change: improvement.change, label: 'Improving', start: improvement.start, end: improvement.end };
  if (improvement.change < 0) return { direction: 'down', change: improvement.change, label: 'Declining', start: improvement.start, end: improvement.end };
  return { direction: 'flat', change: 0, label: 'Stable', start: improvement.start, end: improvement.end };
}

function renderTrendBadge(trend, improvement = null) {
  const info = trendInfoFromImprovement(improvement) || computeTrendDirection(trend);
  const icon = info.direction === 'up' ? '▲' : info.direction === 'down' ? '▼' : '—';
  const changeText =
    info.change != null && info.change !== 0
      ? ` ${info.change > 0 ? '+' : ''}${info.change}`
      : '';
  return `<span class="trend-badge trend-badge--${info.direction}">${icon} ${info.label}${changeText}</span>`;
}

function trendLineColor(direction) {
  if (direction === 'up') return 'var(--good)';
  if (direction === 'down') return 'var(--poor)';
  return 'var(--google-blue)';
}

function renderSparkline(trend, width = 88, height = 28, improvement = null, showBadge = true) {
  if (!trend || trend.length < 2) {
    return '<span class="sparkline sparkline--empty">—</span>';
  }

  const info = trendInfoFromImprovement(improvement) || computeTrendDirection(trend);
  const scores = trend.map((point) => point.score ?? 0);
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const range = max - min || 1;
  const step = width / (scores.length - 1);
  const color = trendLineColor(info.direction);

  const points = scores
    .map((score, index) => {
      const x = index * step;
      const y = height - ((score - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  const lastX = (scores.length - 1) * step;
  const lastY = height - ((scores[scores.length - 1] - min) / range) * (height - 4) - 2;
  const arrow =
    info.direction === 'up'
      ? `<polygon points="${lastX},${lastY - 6} ${lastX - 4},${lastY} ${lastX + 4},${lastY}" fill="${color}"></polygon>`
      : info.direction === 'down'
        ? `<polygon points="${lastX},${lastY + 6} ${lastX - 4},${lastY} ${lastX + 4},${lastY}" fill="${color}"></polygon>`
        : '';

  return `
    <span class="sparkline-wrap">
      <svg class="sparkline sparkline--${info.direction}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${arrow}
      </svg>
      ${showBadge ? renderTrendBadge(trend, improvement) : ''}
    </span>
  `;
}

function renderTags(site) {
  const tags = [];
  if (site.platform) tags.push(`<span class="tag tag--platform">${site.platform}</span>`);
  if (site.region) tags.push(`<span class="tag tag--region">${site.region}</span>`);
  if (site.group) tags.push(`<span class="tag tag--group">${site.group}</span>`);
  return tags.length ? `<div class="tag-row">${tags.join('')}</div>` : '';
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderScoreGrid(report, label) {
  if (!report) {
    return `<div class="score-grid score-grid--empty"><h3>${label}</h3><p>Not analyzed yet</p></div>`;
  }

  const scores = [
    { label: 'Performance', value: report.performanceScore },
    { label: 'Accessibility', value: report.accessibilityScore },
    { label: 'Best Practices', value: report.bestPracticesScore },
    { label: 'SEO', value: report.seoScore },
  ];

  return `
    <div class="score-grid">
      <div class="score-grid__head">
        <h3>${label}</h3>
        <span class="cwv-badge ${report.cwvPassed ? 'cwv-badge--passed' : 'cwv-badge--failed'}">
          CWV ${report.cwvPassed ? 'Passed' : 'Failed'}
        </span>
      </div>
      <div class="score-grid__items">
        ${scores
          .map(
            (item) => `
          <div class="score-grid__item">
            <span class="score-grid__label">${item.label}</span>
            <span class="score-grid__value" style="color:${scoreColor(item.value)}">${item.value ?? '—'}</span>
          </div>
        `
          )
          .join('')}
      </div>
      <a class="link-btn" href="index.html?reportId=${report.id}">Open full report</a>
    </div>
  `;
}

function renderTrendSummary(improvement, periodLabel) {
  if (!improvement || improvement.start == null || improvement.end == null) {
    return '<p class="text-muted">Not enough data to show improvement yet.</p>';
  }
  if (improvement.periods < 2 && improvement.change === 0) {
    return `<p class="text-muted">One ${periodLabel.toLowerCase()} recorded — run more analyses to track improvement.</p>`;
  }
  const dir = improvement.change > 0 ? 'up' : improvement.change < 0 ? 'down' : 'flat';
  const pct =
    improvement.percent != null
      ? `<span class="trend-summary__pct">(${improvement.percent > 0 ? '+' : ''}${improvement.percent}%)</span>`
      : '';
  return `
    <div class="trend-summary trend-summary--${dir}">
      <span class="trend-summary__range">
        <strong>${improvement.start}</strong> → <strong style="color:${scoreColor(improvement.end)}">${improvement.end}</strong>
      </span>
      ${renderDelta(improvement.change)}
      ${pct}
    </div>
  `;
}

function renderTrendChart(trend, title, options = {}) {
  if (!trend || !trend.length) {
    return `<div class="trend-card"><h3>${title}</h3><p class="text-muted">Run more analyses to see trends.</p></div>`;
  }

  const info = trendInfoFromImprovement(options.improvement) || computeTrendDirection(trend);
  const lineColor = trendLineColor(info.direction);
  const width = options.width || 600;
  const height = options.height || 180;
  const padding = 32;
  const scores = trend.map((p) => p.score ?? 0);
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const range = max - min || 1;
  const step = (width - padding * 2) / Math.max(scores.length - 1, 1);

  const coords = scores.map((score, index) => {
    const x = padding + index * step;
    const y = height - padding - ((score - min) / range) * (height - padding * 2);
    return { x, y, score };
  });

  const points = coords.map((c) => `${c.x},${c.y}`).join(' ');

  const areaPath =
    coords.length > 1
      ? `M ${coords[0].x},${height - padding} ${coords.map((c) => `L ${c.x},${c.y}`).join(' ')} L ${coords[coords.length - 1].x},${height - padding} Z`
      : '';

  const dotRadius = trend.length === 1 ? 5 : 3;
  const dots = coords
    .map(
      (c) =>
        `<circle cx="${c.x}" cy="${c.y}" r="${dotRadius}" fill="${scoreColor(c.score)}" stroke="#fff" stroke-width="1.5"></circle>`
    )
    .join('');

  const labelStep = Math.max(1, Math.ceil(trend.length / 5));
  const labels = trend
    .map((point, index) => {
      if (index % labelStep !== 0 && index !== trend.length - 1) return '';
      const x = padding + index * step;
      const text = point.label || formatDate(point.date).split(',')[0];
      return `<text x="${x}" y="${height - 6}" class="trend-chart__label">${text}</text>`;
    })
    .join('');

  const gridLines = [50, 90]
    .filter((v) => v >= min && v <= max)
    .map((v) => {
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" class="trend-chart__grid"></line>`;
    })
    .join('');

  const gradId = `trend-grad-${Math.random().toString(36).slice(2, 9)}`;

  return `
    <div class="trend-card trend-card--${info.direction}">
      <div class="trend-card__head">
        <h3>${title}</h3>
        ${renderTrendBadge(trend, options.improvement)}
      </div>
      <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}: ${info.label}">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.25"></stop>
            <stop offset="100%" stop-color="${lineColor}" stop-opacity="0.02"></stop>
          </linearGradient>
        </defs>
        ${gridLines}
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="trend-chart__axis"></line>
        ${areaPath ? `<path d="${areaPath}" fill="url(#${gradId})"></path>` : ''}
        <polyline points="${points}" class="trend-chart__line trend-chart__line--${info.direction}" style="stroke:${lineColor}"></polyline>
        ${dots}
        ${labels}
      </svg>
      ${info.start != null && info.end != null ? `<p class="trend-card__range">${info.start} → ${info.end}</p>` : ''}
    </div>
  `;
}

function sortByBrandName(items, labelKey = 'name') {
  return [...items].sort((a, b) =>
    String(a[labelKey] || '').localeCompare(String(b[labelKey] || ''), undefined, { sensitivity: 'base' })
  );
}

function periodLabel(period) {
  if (period === 'week') return 'Weekly';
  if (period === 'month') return 'Monthly';
  return 'Each run';
}
