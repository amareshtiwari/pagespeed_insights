const METRIC_DEFINITIONS = {
  LCP: {
    id: 'LCP',
    name: 'Largest Contentful Paint (LCP)',
    cruxKey: 'LARGEST_CONTENTFUL_PAINT_MS',
    auditKey: 'largest-contentful-paint',
    unit: 's',
    good: 2500,
    needsImprovement: 4000,
  },
  INP: {
    id: 'INP',
    name: 'Interaction to Next Paint (INP)',
    cruxKey: 'INTERACTION_TO_NEXT_PAINT',
    auditKey: 'interaction-to-next-paint',
    unit: 'ms',
    good: 200,
    needsImprovement: 500,
  },
  CLS: {
    id: 'CLS',
    name: 'Cumulative Layout Shift (CLS)',
    cruxKey: 'CUMULATIVE_LAYOUT_SHIFT_SCORE',
    auditKey: 'cumulative-layout-shift',
    unit: '',
    good: 0.1,
    needsImprovement: 0.25,
  },
  FCP: {
    id: 'FCP',
    name: 'First Contentful Paint (FCP)',
    cruxKey: 'FIRST_CONTENTFUL_PAINT_MS',
    auditKey: 'first-contentful-paint',
    unit: 's',
    good: 1800,
    needsImprovement: 3000,
  },
  TTFB: {
    id: 'TTFB',
    name: 'Time to First Byte (TTFB)',
    cruxKey: 'EXPERIMENTAL_TIME_TO_FIRST_BYTE',
    auditKey: 'server-response-time',
    unit: 's',
    good: 800,
    needsImprovement: 1800,
    isLabOnly: true,
  },
};

const CORE_WEB_VITAL_IDS = ['LCP', 'INP', 'CLS'];
const OTHER_METRIC_IDS = ['FCP', 'TTFB'];

const LAB_METRIC_DEFINITIONS = [
  { id: 'FCP', name: 'First Contentful Paint', auditKey: 'first-contentful-paint' },
  { id: 'TBT', name: 'Total Blocking Time', auditKey: 'total-blocking-time' },
  { id: 'SI', name: 'Speed Index', auditKey: 'speed-index' },
  { id: 'LCP', name: 'Largest Contentful Paint', auditKey: 'largest-contentful-paint' },
  { id: 'CLS', name: 'Cumulative Layout Shift', auditKey: 'cumulative-layout-shift' },
];

const CATEGORY_KEYS = [
  { id: 'performance', label: 'Performance', apiKey: 'performance' },
  { id: 'accessibility', label: 'Accessibility', apiKey: 'accessibility' },
  { id: 'bestPractices', label: 'Best Practices', apiKey: 'best-practices' },
  { id: 'seo', label: 'SEO', apiKey: 'seo' },
];

const CRUX_CATEGORY_MAP = {
  FAST: 'good',
  AVERAGE: 'needs-improvement',
  SLOW: 'poor',
};

function categorize(value, good, needsImprovement) {
  if (value <= good) return 'good';
  if (value <= needsImprovement) return 'needs-improvement';
  return 'poor';
}

function progressPosition(value, good, needsImprovement) {
  if (value <= 0) return 2;

  const segment = needsImprovement - good;
  const poorMax = needsImprovement + Math.max(segment, good * 0.5);

  if (value <= good) {
    const ratio = good ? Math.min(value / good, 1) : 0;
    return Math.max(2, ratio * 33.33);
  }

  if (value <= needsImprovement) {
    const ratio = segment ? (value - good) / segment : 0;
    return 33.33 + ratio * 33.33;
  }

  const ratio = Math.min((value - needsImprovement) / (poorMax - needsImprovement), 1);
  return 66.66 + ratio * 33.34;
}

function formatDisplayValue(metricId, rawValue) {
  if (metricId === 'CLS') return rawValue.toFixed(2);
  if (['LCP', 'FCP', 'TTFB'].includes(metricId)) {
    const seconds = rawValue > 10 ? rawValue / 1000 : rawValue;
    return `${seconds.toFixed(1)} s`;
  }
  return `${Math.round(rawValue)} ms`;
}

function buildMetricPayload(definition, cruxMetrics, audits) {
  let rawValue = null;
  let category = null;
  let percentile = null;
  let source = 'lab';

  const crux = cruxMetrics[definition.cruxKey];
  if (crux && crux.percentile != null) {
    rawValue = Number(crux.percentile);
    category = CRUX_CATEGORY_MAP[crux.category] || null;
    percentile = Number(crux.percentile);
    source = 'field';
  }

  if (rawValue == null) {
    const audit = audits[definition.auditKey];
    if (!audit || audit.numericValue == null) return null;
    rawValue = Number(audit.numericValue);
    source = 'lab';
  }

  if (definition.id === 'CLS' && (source === 'field' || rawValue > 1)) {
    rawValue /= 100;
  }

  if (category == null) {
    category = categorize(rawValue, definition.good, definition.needsImprovement);
  }

  return {
    id: definition.id,
    name: definition.name,
    value: rawValue,
    unit: definition.unit,
    displayValue: formatDisplayValue(definition.id, rawValue),
    category,
    percentile,
    source,
    progress: Math.round(progressPosition(rawValue, definition.good, definition.needsImprovement) * 100) / 100,
    thresholds: {
      good: definition.good,
      needsImprovement: definition.needsImprovement,
    },
    isExperimental: definition.id === 'TTFB',
  };
}

function buildAssessment(coreMetrics) {
  if (!coreMetrics.length) {
    return { passed: false, label: 'Failed', reason: 'Insufficient Core Web Vitals data' };
  }

  const passed = coreMetrics.every((metric) => metric.category === 'good');
  return {
    passed,
    label: passed ? 'Passed' : 'Failed',
    reason: passed ? null : 'One or more Core Web Vitals need improvement',
  };
}

function scoreCategoryFromPercent(score) {
  if (score == null) return 'unknown';
  const pct = score <= 1 ? score * 100 : score;
  if (pct >= 90) return 'good';
  if (pct >= 50) return 'needs-improvement';
  return 'poor';
}

function scoreToPercent(score) {
  if (score == null) return null;
  return Math.round((score <= 1 ? score * 100 : score));
}

function parseCategories(lighthouse) {
  const categories = lighthouse.categories || {};
  const result = {};

  CATEGORY_KEYS.forEach(({ id, label, apiKey }) => {
    const entry = categories[apiKey] || {};
    const score = scoreToPercent(entry.score);
    result[id] = {
      id,
      label,
      score,
      category: scoreCategoryFromPercent(score),
    };
  });

  return result;
}

function parseLabMetric(audit, definition) {
  if (!audit || audit.numericValue == null) return null;

  let value = Number(audit.numericValue);
  if (definition.id === 'CLS' && value > 1) value /= 100;

  const auditScore = audit.score != null ? scoreToPercent(audit.score) : null;
  const category = auditScore != null
    ? scoreCategoryFromPercent(auditScore)
    : categorize(value, definition.id === 'CLS' ? 0.1 : 1800, definition.id === 'CLS' ? 0.25 : 3000);

  return {
    id: definition.id,
    name: definition.name,
    value,
    displayValue: audit.displayValue || formatDisplayValue(definition.id, value),
    category,
    score: auditScore,
  };
}

function parseLabMetrics(audits) {
  return LAB_METRIC_DEFINITIONS.map((definition) =>
    parseLabMetric(audits[definition.auditKey], definition)
  ).filter(Boolean);
}

function normalizeScreenshotUrl(value) {
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

function parseScreenshot(audits) {
  const audit = audits['final-screenshot'] || audits['full-page-screenshot'];
  if (!audit?.details?.data) return null;

  const raw = String(audit.details.data).trim();
  const mime = audit.details.mimeType || 'image/jpeg';

  if (raw.startsWith('data:')) {
    return normalizeScreenshotUrl(raw);
  }

  return `data:${mime};base64,${raw}`;
}

function parseLabMetadata(lighthouse, strategy) {
  const config = lighthouse.configSettings || {};
  const environment = lighthouse.environment || {};
  const throttling = config.throttling || {};
  const throttlingLabel = throttling.rttMs
    ? `Slow 4G throttling (${throttling.rttMs}ms RTT, ${throttling.throughputKbps || '?'} Kbps)`
    : config.throttlingMethod === 'simulate'
      ? 'Simulated throttling'
      : 'No throttling';

  const deviceMatch = (lighthouse.userAgent || '').match(/Android[^;)]+|iPhone[^;)]+|Moto[^;)]+/i);
  const device = deviceMatch
    ? deviceMatch[0]
    : strategy === 'mobile'
      ? 'Emulated Moto G Power'
      : 'Emulated Desktop';

  return {
    capturedAt: lighthouse.fetchTime || new Date().toISOString(),
    device: `${device} with Lighthouse ${lighthouse.lighthouseVersion || 'unknown'}`,
    throttling: throttlingLabel,
    browser: environment.networkUserAgent || lighthouse.userAgent || 'HeadlessChromium',
    sessionType: 'Single page session',
    loadType: 'Initial page load',
    formFactor: config.formFactor || strategy,
  };
}

const METRIC_SUGGESTIONS = {
  LCP: 'Optimize the largest content element: compress hero images, use WebP/AVIF, preload the LCP image, and reduce server response time.',
  INP: 'Reduce JavaScript execution time, break up long tasks, and defer non-critical third-party scripts.',
  CLS: 'Reserve space for ads, embeds, and web fonts. Set explicit width and height on images and avoid inserting content above existing content.',
  FCP: 'Eliminate render-blocking resources, reduce server response time, and enable text compression.',
  TBT: 'Reduce JavaScript payload, defer unused JS, and split long main-thread tasks.',
  SI: 'Optimize images, enable compression, and minimize main-thread work during load.',
  TTFB: 'Improve server response time with caching, CDN, and faster backend processing.',
};

const CATEGORY_SUGGESTIONS = {
  performance: 'Focus on Core Web Vitals, reduce JavaScript and CSS payload, and optimize images.',
  accessibility: 'Add alt text, improve color contrast, ensure form labels, and fix ARIA attributes.',
  bestPractices: 'Use HTTPS, avoid deprecated APIs, fix browser console errors, and follow security best practices.',
  seo: 'Add meta descriptions, ensure crawlable links, use valid structured data, and fix mobile usability issues.',
};

const SKIP_AUDIT_MODES = new Set(['notApplicable', 'manual', 'informative']);

function stripMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeActionPriority(audit, score, isOpportunity) {
  let priority = 0;
  if (isOpportunity && audit.details?.overallSavingsMs) {
    priority += Number(audit.details.overallSavingsMs);
  }
  if (score != null && score < 50) priority += 2000;
  else if (score != null && score < 90) priority += 1000;
  if (audit.score === 0) priority += 500;
  return priority;
}

function parseActionItems(lighthouse) {
  const categories = lighthouse.categories || {};
  const audits = lighthouse.audits || {};
  const categoryLabels = {
    performance: 'Performance',
    accessibility: 'Accessibility',
    'best-practices': 'Best Practices',
    seo: 'SEO',
  };
  const items = [];
  const seen = new Set();

  Object.entries(categories).forEach(([catId, category]) => {
    (category.auditRefs || []).forEach((ref) => {
      if (seen.has(ref.id)) return;
      const audit = audits[ref.id];
      if (!audit) return;
      if (SKIP_AUDIT_MODES.has(audit.scoreDisplayMode)) return;
      if (audit.score === 1) return;

      const score = audit.score != null ? scoreToPercent(audit.score) : null;
      const isOpportunity =
        audit.details?.type === 'opportunity' || Number(audit.details?.overallSavingsMs) > 0;

      if (score != null && score >= 90 && !isOpportunity) return;
      if (audit.score == null && !isOpportunity) return;

      seen.add(ref.id);
      items.push({
        id: ref.id,
        title: audit.title || ref.id,
        description: stripMarkdown(audit.description),
        category: categoryLabels[catId] || catId,
        score,
        priority: computeActionPriority(audit, score, isOpportunity),
        savingsMs: audit.details?.overallSavingsMs ?? null,
        savingsBytes: audit.details?.overallSavingsBytes ?? null,
        displayValue: audit.displayValue || null,
        type: isOpportunity ? 'opportunity' : 'audit',
      });
    });
  });

  return items.sort((a, b) => b.priority - a.priority).slice(0, 20);
}

function extractActionItemsFromPayload(payload) {
  if (payload.actionItems?.length) return payload.actionItems;

  const items = [];
  const metrics = [...(payload.coreWebVitals || []), ...(payload.labMetrics || []), ...(payload.otherMetrics || [])];

  metrics.forEach((metric) => {
    if (!metric || metric.category === 'good') return;
    items.push({
      id: `metric-${metric.id}`,
      title: `Improve ${metric.name}`,
      description: METRIC_SUGGESTIONS[metric.id] || `Optimize ${metric.name} to reach the good threshold.`,
      category: 'Performance',
      score: metric.score ?? null,
      priority: metric.category === 'poor' ? 1500 : 900,
      savingsMs: null,
      savingsBytes: null,
      displayValue: metric.displayValue || null,
      type: 'metric',
    });
  });

  Object.entries(payload.categories || {}).forEach(([catId, cat]) => {
    if (!cat || cat.score == null || cat.score >= 90) return;
    items.push({
      id: `category-${catId}`,
      title: `Improve ${cat.label} score (currently ${cat.score})`,
      description: CATEGORY_SUGGESTIONS[catId] || `Review Lighthouse ${cat.label} audits and fix failing checks.`,
      category: cat.label,
      score: cat.score,
      priority: cat.score < 50 ? 1200 : 700,
      savingsMs: null,
      savingsBytes: null,
      displayValue: null,
      type: 'category',
    });
  });

  if (payload.assessment && !payload.assessment.passed) {
    items.unshift({
      id: 'cwv-failed',
      title: 'Core Web Vitals assessment failed',
      description: 'One or more Core Web Vitals (LCP, INP, CLS) need improvement. Address the metric-specific items below first.',
      category: 'Performance',
      score: null,
      priority: 2500,
      savingsMs: null,
      savingsBytes: null,
      displayValue: null,
      type: 'assessment',
    });
  }

  return items.sort((a, b) => b.priority - a.priority);
}

function parsePagespeedResponse(data, url, strategy) {
  const loading = data.loadingExperience || {};
  const cruxMetrics = loading.metrics || {};
  const lighthouse = data.lighthouseResult || {};
  const audits = lighthouse.audits || {};
  const performance = (lighthouse.categories || {}).performance || {};
  const score = performance.score;
  const performanceScore = score != null ? Math.round(score * 100) : null;

  const coreWebVitals = CORE_WEB_VITAL_IDS.map((id) =>
    buildMetricPayload(METRIC_DEFINITIONS[id], cruxMetrics, audits)
  ).filter(Boolean);

  const otherMetrics = OTHER_METRIC_IDS.map((id) =>
    buildMetricPayload(METRIC_DEFINITIONS[id], cruxMetrics, audits)
  ).filter(Boolean);

  const assessment = buildAssessment(coreWebVitals);
  const categories = parseCategories(lighthouse);
  const labMetrics = parseLabMetrics(audits);
  const labMetadata = parseLabMetadata(lighthouse, strategy);
  const screenshot = parseScreenshot(audits);
  const actionItems = parseActionItems(lighthouse);

  return {
    url,
    strategy,
    capturedAt: labMetadata.capturedAt,
    assessment,
    coreWebVitals,
    otherMetrics,
    categories,
    labMetrics,
    labMetadata,
    screenshot,
    actionItems,
    performanceScore: categories.performance?.score ?? performanceScore,
    metadata: {
      period: 'Latest 28-day period',
      devices: strategy === 'mobile' ? 'Various mobile devices' : 'Various desktop devices',
      dataSource: 'Chrome UX Report',
      samples: 'Many samples',
      visitDuration: 'Full visit durations',
      network: 'Various network connections',
      browser: 'All Chrome versions',
      originFallback: loading.origin_fallback || false,
    },
  };
}

module.exports = {
  parsePagespeedResponse,
  extractActionItemsFromPayload,
  validateUrl,
  scoreCategoryFromPercent,
  normalizeScreenshotUrl,
};

function validateUrl(rawUrl) {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    throw new Error("Query parameter 'url' is required");
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!parsed.hostname) {
    throw new Error('Invalid URL');
  }

  return candidate;
}
