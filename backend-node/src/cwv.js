const { loadWebsites } = require('./store');
const { getBrandCwvHistory, loadCwvHistory } = require('./syncState');

const METRICS = [
  { short: 'LCP', good: 2500, poor: 4000 },
  { short: 'CLS', good: 0.1, poor: 0.25 },
  { short: 'INP', good: 200, poor: 500 },
  { short: 'FCP', good: 1800, poor: 3000 },
  { short: 'TTFB', good: 800, poor: 1800 },
];

const METRIC_IDS = METRICS.map((m) => m.short);

function sortByName(a, b) {
  return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
}

function latestNonNull(arr) {
  if (!arr?.length) return null;
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    if (arr[i] != null && !Number.isNaN(arr[i])) return arr[i];
  }
  return null;
}

function bucket(short, value) {
  if (value == null || Number.isNaN(value)) return 'na';
  const metric = METRICS.find((m) => m.short === short);
  if (!metric) return 'na';
  if (value <= metric.good) return 'good';
  if (value >= metric.poor) return 'poor';
  return 'ok';
}

function formatMetric(short, value) {
  if (value == null || Number.isNaN(value)) return '—';
  if (short === 'CLS') return value.toFixed(2);
  if (short === 'INP') return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function intervalValues(series) {
  if (!series?.length) return { cur: null, p1: null, p2: null };
  const n = series.length;
  return {
    cur: series[n - 1] ?? null,
    p1: series[n - 5] ?? null,
    p2: series[n - 9] ?? null,
  };
}

function delta(cur, prev) {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / prev;
}

function deltaClass(d) {
  if (d == null) return 'flat';
  if (Math.abs(d) < 0.02) return 'flat';
  return d < 0 ? 'improved' : 'regressed';
}

function getFormFactorBlock(cwvHistory, device) {
  return device === 'desktop' ? cwvHistory?.desktop : cwvHistory?.mobile;
}

function buildBrandCwvRow(site, cwvHistory) {
  const row = {
    id: site.id,
    name: site.name,
    url: site.url,
    platform: site.platform || '',
    region: site.region || '',
    group: site.group || '',
    hasCrux: false,
    severity: 0,
  };

  METRIC_IDS.forEach((metric) => {
    const mobile = getFormFactorBlock(cwvHistory, 'mobile');
    const desktop = getFormFactorBlock(cwvHistory, 'desktop');
    row[`M_${metric}`] = latestNonNull(mobile?.metrics?.[metric]?.p75s);
    row[`D_${metric}`] = latestNonNull(desktop?.metrics?.[metric]?.p75s);
  });

  row.hasCrux = METRIC_IDS.some(
    (metric) => row[`M_${metric}`] != null || row[`D_${metric}`] != null
  );

  METRIC_IDS.forEach((metric) => {
    if (bucket(metric, row[`M_${metric}`]) === 'poor') row.severity += 1;
    if (bucket(metric, row[`D_${metric}`]) === 'poor') row.severity += 1;
  });

  return row;
}

function buildBrandDetail(site, cwvHistory) {
  if (!cwvHistory) return null;

  const devices = {};
  ['mobile', 'desktop'].forEach((device) => {
    const block = getFormFactorBlock(cwvHistory, device);
    if (!block?.labels?.length) return;

    devices[device] = {
      labels: block.labels,
      scope: block.scope || 'url',
      metrics: {},
    };

    METRIC_IDS.forEach((metricId) => {
      const metric = block.metrics?.[metricId];
      if (!metric) return;
      const p75s = metric.p75s || [];
      const iv = intervalValues(p75s);
      devices[device].metrics[metricId] = {
        p75s,
        goodShare: metric.goodShare || [],
        latest: iv.cur,
        bucket: bucket(metricId, iv.cur),
        formatted: formatMetric(metricId, iv.cur),
        interval: {
          cur: iv.cur,
          p1: iv.p1,
          p2: iv.p2,
          deltaP1: delta(iv.cur, iv.p1),
          deltaP2: delta(iv.cur, iv.p2),
          deltaClassP1: deltaClass(delta(iv.cur, iv.p1)),
          deltaClassP2: deltaClass(delta(iv.cur, iv.p2)),
        },
      };
    });
  });

  if (!Object.keys(devices).length) return null;
  return { devices, weeks: cwvHistory.mobile?.labels?.length || cwvHistory.desktop?.labels?.length || 0 };
}

function buildIntervalRows(sites, filters) {
  const device = filters.device === 'desktop' ? 'desktop' : 'mobile';
  const metric = METRIC_IDS.includes(filters.metric) ? filters.metric : 'LCP';

  return sites
    .map((site) => {
      const cwvHistory = getBrandCwvHistory(site.id);
      const block = getFormFactorBlock(cwvHistory, device);
      const series = block?.metrics?.[metric]?.p75s || [];
      const iv = intervalValues(series);
      const d1 = delta(iv.cur, iv.p1);
      const d2 = delta(iv.cur, iv.p2);

      return {
        id: site.id,
        name: site.name,
        platform: site.platform,
        region: site.region,
        group: site.group,
        metric,
        device,
        cur: iv.cur,
        p1: iv.p1,
        p2: iv.p2,
        formatted: {
          cur: formatMetric(metric, iv.cur),
          p1: formatMetric(metric, iv.p1),
          p2: formatMetric(metric, iv.p2),
        },
        bucket: bucket(metric, iv.cur),
        deltaP1: d1,
        deltaP2: d2,
        deltaClassP1: deltaClass(d1),
        deltaClassP2: deltaClass(d2),
        hasData: iv.cur != null,
      };
    })
    .filter((row) => row.hasData);
}

function applyFilters(sites, filters = {}) {
  let result = sites;
  if (filters.platform) result = result.filter((s) => s.platform === filters.platform);
  if (filters.region) result = result.filter((s) => s.region === filters.region);
  if (filters.group) result = result.filter((s) => s.group === filters.group);
  if (filters.websiteId) result = result.filter((s) => s.id === Number(filters.websiteId));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (s) => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q)
    );
  }
  return result;
}

function getFilterOptions(sites) {
  const pick = (field) => [...new Set(sites.map((s) => s[field]).filter(Boolean))].sort();
  return {
    platforms: pick('platform'),
    regions: pick('region'),
    groups: pick('group'),
    websites: [...sites].sort(sortByName).map((s) => ({ id: s.id, name: s.name })),
  };
}

function getCwvIntelligence(filters = {}) {
  const allSites = loadWebsites();
  const sites = applyFilters(allSites, filters);
  const historyMeta = loadCwvHistory();

  const hygiene = sites
    .map((site) => buildBrandCwvRow(site, getBrandCwvHistory(site.id)))
    .filter((row) => row.hasCrux);

  const cleanCount = hygiene.filter((r) => r.severity === 0).length;
  const totalPoor = hygiene.reduce((sum, r) => sum + r.severity, 0);

  let brandDetail = null;
  if (filters.websiteId) {
    const site = allSites.find((s) => s.id === Number(filters.websiteId));
    if (site) {
      brandDetail = {
        ...buildBrandCwvRow(site, getBrandCwvHistory(site.id)),
        detail: buildBrandDetail(site, getBrandCwvHistory(site.id)),
      };
    }
  }

  const compareDevice = filters.device === 'desktop' ? 'desktop' : 'mobile';
  const compareMetric = METRIC_IDS.includes(filters.metric) ? filters.metric : 'LCP';
  const compareBrands = sites
    .map((site) => {
      const cwvHistory = getBrandCwvHistory(site.id);
      const block = getFormFactorBlock(cwvHistory, compareDevice);
      const series = block?.metrics?.[compareMetric]?.p75s || [];
      if (!series.length) return null;
      return {
        id: site.id,
        name: site.name,
        group: site.group,
        region: site.region,
        platform: site.platform,
        labels: block.labels || [],
        series,
        latest: latestNonNull(series),
      };
    })
    .filter(Boolean);

  return {
    meta: {
      importedAt: historyMeta.importedAt,
      source: historyMeta.source,
      brandCount: allSites.length,
      metrics: METRICS,
    },
    summary: {
      totalBrands: hygiene.length,
      cleanBrands: cleanCount,
      issueBrands: hygiene.length - cleanCount,
      totalPoorMetrics: totalPoor,
    },
    filters: getFilterOptions(allSites),
    hygiene,
    interval: buildIntervalRows(sites, filters),
    compare: {
      device: compareDevice,
      metric: compareMetric,
      brands: compareBrands,
    },
    brand: brandDetail,
  };
}

module.exports = {
  METRICS,
  METRIC_IDS,
  bucket,
  formatMetric,
  intervalValues,
  delta,
  deltaClass,
  getCwvIntelligence,
  buildBrandDetail,
};
