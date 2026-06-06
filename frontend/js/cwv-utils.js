const CWV_METRICS = [
  { short: 'LCP', good: 2500, poor: 4000 },
  { short: 'CLS', good: 0.1, poor: 0.25 },
  { short: 'INP', good: 200, poor: 500 },
  { short: 'FCP', good: 1800, poor: 3000 },
  { short: 'TTFB', good: 800, poor: 1800 },
];

const CWV_BUCKET_COLORS = {
  good: { line: '#15803d', fill: 'rgba(21,128,61,0.15)', bg: 'var(--good-bg)', text: 'var(--good)' },
  ok: { line: '#b45309', fill: 'rgba(180,83,9,0.15)', bg: 'var(--needs-bg)', text: 'var(--needs)' },
  poor: { line: '#b91c1c', fill: 'rgba(185,28,28,0.15)', bg: 'var(--poor-bg)', text: 'var(--poor)' },
  na: { line: '#9ca3af', fill: 'rgba(156,163,175,0.10)', bg: '#f3f4f6', text: 'var(--text-secondary)' },
};

const CWV_PALETTE = [
  '#093C76', '#c0392b', '#27ae60', '#d35400', '#8e44ad', '#16a085', '#7f8c8d',
  '#2980b9', '#e67e22', '#2c3e50', '#e74c3c', '#f39c12', '#1abc9c', '#34495e', '#95a5a6',
];

function cwvBucket(short, value) {
  if (value == null || Number.isNaN(value)) return 'na';
  const metric = CWV_METRICS.find((m) => m.short === short);
  if (!metric) return 'na';
  if (value <= metric.good) return 'good';
  if (value >= metric.poor) return 'poor';
  return 'ok';
}

function cwvFormat(short, value) {
  if (value == null || Number.isNaN(value)) return '—';
  if (short === 'CLS') return value.toFixed(2);
  if (short === 'INP') return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function cwvBucketLabel(bucket) {
  if (bucket === 'good') return 'Good';
  if (bucket === 'ok') return 'Needs Imp.';
  if (bucket === 'poor') return 'Poor';
  return '—';
}

function cwvDeltaHtml(d, className) {
  if (d == null) return '<span class="cwv-delta cwv-delta--na">—</span>';
  const pct = Math.abs(d * 100).toFixed(0);
  const icon = className === 'improved' ? '▼' : className === 'regressed' ? '▲' : '—';
  return `<span class="cwv-delta cwv-delta--${className}">${icon} ${pct}%</span>`;
}

function cwvHygieneCell(metric, value) {
  const b = cwvBucket(metric, value);
  const colors = CWV_BUCKET_COLORS[b];
  return `<span class="cwv-pill cwv-pill--${b}" title="${cwvBucketLabel(b)}">${cwvFormat(metric, value)}</span>`;
}

function cwvTag(text, type = '') {
  return `<span class="tag tag--${type || 'group'}">${text}</span>`;
}
