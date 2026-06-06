const fs = require('fs');
const path = require('path');
const { validateUrl, normalizeScreenshotUrl, extractActionItemsFromPayload } = require('./metrics');
const { getBrandCwvHistory } = require('./syncState');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const WEBSITES_FILE = path.join(DATA_DIR, 'websites.json');
const STRATEGIES = ['mobile', 'desktop'];
const TREND_LIMIT = 12;

function sortByName(a, b) {
  return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
}

function sortSitesByName(sites) {
  return [...sites].sort(sortByName);
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_FILE)) fs.writeFileSync(REPORTS_FILE, '[]', 'utf8');
  if (!fs.existsSync(WEBSITES_FILE)) fs.writeFileSync(WEBSITES_FILE, '[]', 'utf8');
}

function emptyStrategyReports() {
  return {
    mobile: { lastReportId: null, lastAnalyzedAt: null },
    desktop: { lastReportId: null, lastAnalyzedAt: null },
  };
}

function migrateWebsite(site) {
  const base = site.reports
    ? {
        id: site.id,
        url: site.url,
        name: site.name,
        platform: site.platform || '',
        region: site.region || '',
        group: site.group || '',
        addedAt: site.addedAt,
        reports: {
          mobile: { ...emptyStrategyReports().mobile, ...site.reports.mobile },
          desktop: { ...emptyStrategyReports().desktop, ...site.reports.desktop },
        },
      }
    : {
        id: site.id,
        url: site.url,
        name: site.name,
        platform: site.platform || '',
        region: site.region || '',
        group: site.group || '',
        addedAt: site.addedAt,
        reports: emptyStrategyReports(),
      };

  if (!site.reports && site.strategy && site.lastReportId) {
    base.reports[site.strategy] = {
      lastReportId: site.lastReportId,
      lastAnalyzedAt: site.lastAnalyzedAt,
    };
  }

  return base;
}

function loadReports() {
  ensureStore();
  return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
}

function writeReports(reports) {
  ensureStore();
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
}

function loadWebsitesRaw() {
  ensureStore();
  return JSON.parse(fs.readFileSync(WEBSITES_FILE, 'utf8'));
}

function consolidateWebsites(rawSites) {
  const merged = new Map();
  rawSites.map(migrateWebsite).forEach((site) => {
    const key = normalizeUrlKey(site.url);
    if (!merged.has(key)) {
      merged.set(key, site);
      return;
    }
    const existing = merged.get(key);
    STRATEGIES.forEach((strategy) => {
      const incoming = site.reports[strategy];
      const current = existing.reports[strategy];
      if (incoming.lastReportId && !current.lastReportId) {
        existing.reports[strategy] = incoming;
      } else if (incoming.lastAnalyzedAt && current.lastAnalyzedAt) {
        if (new Date(incoming.lastAnalyzedAt) > new Date(current.lastAnalyzedAt)) {
          existing.reports[strategy] = incoming;
        }
      }
    });
    ['name', 'platform', 'region', 'group'].forEach((field) => {
      if (!existing[field] && site[field]) existing[field] = site[field];
    });
  });
  return sortSitesByName(Array.from(merged.values()));
}

function loadWebsites() {
  const consolidated = consolidateWebsites(loadWebsitesRaw());
  writeWebsites(consolidated);
  return consolidated;
}

function writeWebsites(websites) {
  ensureStore();
  fs.writeFileSync(WEBSITES_FILE, JSON.stringify(websites, null, 2), 'utf8');
}

function normalizeUrlKey(url) {
  return validateUrl(url).replace(/\/+$/, '').toLowerCase();
}

function summarizeReport(entry) {
  const { payload, ...summary } = entry;
  return summary;
}

function saveReport(payload) {
  const reports = loadReports();
  const id = reports.length ? Math.max(...reports.map((r) => r.id)) + 1 : 1;
  const record = {
    id,
    url: payload.url,
    strategy: payload.strategy,
    websiteId: payload.websiteId ?? null,
    createdAt: payload.capturedAt || new Date().toISOString(),
    performanceScore: payload.categories?.performance?.score ?? payload.performanceScore,
    accessibilityScore: payload.categories?.accessibility?.score ?? null,
    bestPracticesScore: payload.categories?.bestPractices?.score ?? null,
    seoScore: payload.categories?.seo?.score ?? null,
    cwvPassed: payload.assessment?.passed ?? false,
    payload,
  };
  reports.unshift(record);
  writeReports(reports);
  if (payload.websiteId && payload.strategy) {
    updateWebsiteAfterReport(payload.websiteId, payload.strategy, id, record.createdAt);
  }
  return record;
}

function updateWebsiteAfterReport(websiteId, strategy, reportId, analyzedAt) {
  const websites = loadWebsites();
  const index = websites.findIndex((site) => site.id === websiteId);
  if (index === -1 || !websites[index].reports[strategy]) return;
  websites[index].reports[strategy] = { lastReportId: reportId, lastAnalyzedAt: analyzedAt };
  writeWebsites(websites);
}

function listReports(filters = {}) {
  let reports = loadReports().map(summarizeReport);
  if (filters.websiteId) reports = reports.filter((r) => r.websiteId === Number(filters.websiteId));
  if (filters.strategy) reports = reports.filter((r) => r.strategy === filters.strategy);
  if (filters.platform) {
    const sites = loadWebsites().filter((s) => s.platform === filters.platform);
    const ids = new Set(sites.map((s) => s.id));
    reports = reports.filter((r) => r.websiteId && ids.has(r.websiteId));
  }
  return reports;
}

function getReport(id) {
  const report = loadReports().find((entry) => entry.id === Number(id));
  if (!report) return null;
  const payload = { ...report.payload, reportId: report.id, savedAt: report.createdAt, websiteId: report.websiteId };
  if (payload.screenshot) payload.screenshot = normalizeScreenshotUrl(payload.screenshot);
  return payload;
}

function getLatestReportIdForUrlStrategy(url, strategy) {
  const key = normalizeUrlKey(url);
  const report = loadReports()
    .filter((entry) => normalizeUrlKey(entry.url) === key && entry.strategy === strategy)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  return report?.id ?? null;
}

function getReportContext(id) {
  const report = loadReports().find((entry) => entry.id === Number(id));
  if (!report) return null;
  return {
    url: report.url,
    websiteId: report.websiteId,
    currentReportId: report.id,
    currentStrategy: report.strategy,
    mobileReportId: getLatestReportIdForUrlStrategy(report.url, 'mobile'),
    desktopReportId: getLatestReportIdForUrlStrategy(report.url, 'desktop'),
  };
}

function getReportsForUrlStrategy(url, strategy, limit = TREND_LIMIT) {
  const key = normalizeUrlKey(url);
  const matches = loadReports()
    .filter((entry) => normalizeUrlKey(entry.url) === key && entry.strategy === strategy)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const slice = limit ? matches.slice(0, limit) : matches;
  return slice.map(summarizeReport).reverse();
}

function getAllReportsForWebsite(website) {
  return loadReports()
    .filter((r) => r.websiteId === website.id || normalizeUrlKey(r.url) === normalizeUrlKey(website.url))
    .map(summarizeReport)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekKey(date) {
  return startOfWeek(date).toISOString().slice(0, 10);
}

function formatWeekLabel(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function aggregateTrendByPeriod(reports, period = 'run') {
  const sorted = [...reports].filter((r) => r.performanceScore != null).sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
  if (!sorted.length) return [];

  if (period === 'run') {
    return sorted.map((entry) => ({
      date: entry.createdAt,
      label: new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: entry.performanceScore,
      cwvPassed: entry.cwvPassed,
      count: 1,
    }));
  }

  const buckets = new Map();
  sorted.forEach((entry) => {
    const d = new Date(entry.createdAt);
    let key;
    let label;
    if (period === 'week') {
      key = getWeekKey(d);
      label = formatWeekLabel(d);
    } else if (period === 'month') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else {
      return;
    }

    if (!buckets.has(key)) {
      buckets.set(key, { key, label, scores: [], cwv: [], latestDate: entry.createdAt });
    }
    const bucket = buckets.get(key);
    bucket.scores.push(entry.performanceScore);
    bucket.cwv.push(entry.cwvPassed);
    if (new Date(entry.createdAt) > new Date(bucket.latestDate)) {
      bucket.latestDate = entry.createdAt;
    }
  });

  return [...buckets.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((bucket) => ({
      date: bucket.latestDate,
      label: bucket.label,
      score: Math.round(bucket.scores.reduce((sum, v) => sum + v, 0) / bucket.scores.length),
      cwvPassed: bucket.cwv.filter(Boolean).length >= Math.ceil(bucket.cwv.length / 2),
      count: bucket.scores.length,
    }));
}

function computeTrendImprovement(points) {
  const valid = points.filter((p) => p.score != null);
  if (!valid.length) {
    return { start: null, end: null, change: null, percent: null, periods: 0 };
  }
  if (valid.length === 1) {
    return { start: valid[0].score, end: valid[0].score, change: 0, percent: 0, periods: 1 };
  }
  const start = valid[0].score;
  const end = valid[valid.length - 1].score;
  const change = end - start;
  const percent = start ? Math.round((change / start) * 100) : null;
  return { start, end, change, percent, periods: valid.length };
}

function getWebsiteTrends(id, options = {}) {
  const website = getWebsite(id);
  if (!website) return null;

  const period = ['run', 'week', 'month'].includes(options.period) ? options.period : 'week';
  const allReports = getAllReportsForWebsite(website);
  const mobileReports = allReports.filter((r) => r.strategy === 'mobile');
  const desktopReports = allReports.filter((r) => r.strategy === 'desktop');
  let mobilePoints = aggregateTrendByPeriod(mobileReports, period);
  let desktopPoints = aggregateTrendByPeriod(desktopReports, period);

  const cruxMobile = getCruxTrendFromHistory(website.id, 'mobile');
  const cruxDesktop = getCruxTrendFromHistory(website.id, 'desktop');
  if (period === 'week') {
    mobilePoints = mergeTrendPoints(cruxMobile, mobilePoints);
    desktopPoints = mergeTrendPoints(cruxDesktop, desktopPoints);
  }

  return {
    websiteId: website.id,
    name: website.name,
    url: website.url,
    platform: website.platform,
    region: website.region,
    group: website.group,
    period,
    mobile: { points: mobilePoints, improvement: computeTrendImprovement(mobilePoints) },
    desktop: { points: desktopPoints, improvement: computeTrendImprovement(desktopPoints) },
  };
}

function getPortfolioTrends(filters = {}) {
  const period = ['run', 'week', 'month'].includes(filters.period) ? filters.period : 'week';
  let sites = loadWebsites();
  if (filters.platform) sites = sites.filter((s) => s.platform === filters.platform);
  if (filters.region) sites = sites.filter((s) => s.region === filters.region);
  if (filters.group) sites = sites.filter((s) => s.group === filters.group);
  if (filters.websiteId) sites = sites.filter((s) => s.id === Number(filters.websiteId));

  const brands = sites
    .map((site) => {
      const trends = getWebsiteTrends(site.id, { period });
      if (!trends) return null;
      const hasData = trends.mobile.points.length || trends.desktop.points.length;
      if (!hasData) return null;

      const mobileEnd = trends.mobile.improvement.end;
      const desktopEnd = trends.desktop.improvement.end;
      const scores = [mobileEnd, desktopEnd].filter((s) => s != null);
      const avgEnd = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

      const mobileStart = trends.mobile.improvement.start;
      const desktopStart = trends.desktop.improvement.start;
      const startScores = [mobileStart, desktopStart].filter((s) => s != null);
      const avgStart = startScores.length
        ? Math.round(startScores.reduce((a, b) => a + b, 0) / startScores.length)
        : null;
      const avgChange = avgStart != null && avgEnd != null ? avgEnd - avgStart : null;

      return {
        id: site.id,
        name: site.name,
        url: site.url,
        platform: site.platform,
        region: site.region,
        group: site.group,
        avgPerformance: avgEnd,
        mobile: trends.mobile,
        desktop: trends.desktop,
        avgImprovement: {
          start: avgStart,
          end: avgEnd,
          change: avgChange,
          percent: avgStart ? Math.round(((avgChange || 0) / avgStart) * 100) : null,
        },
      };
    })
    .filter(Boolean);

  const improved = brands.filter((b) => (b.avgImprovement.change ?? 0) > 0).length;
  const regressed = brands.filter((b) => (b.avgImprovement.change ?? 0) < 0).length;

  return {
    period,
    summary: {
      totalBrands: brands.length,
      improved,
      regressed,
      unchanged: brands.length - improved - regressed,
    },
    filters: getFilterOptions(loadWebsites()),
    brands: sortSitesByName(brands),
  };
}

function computeDelta(current, previous) {
  if (!current || !previous || current.performanceScore == null || previous.performanceScore == null) {
    return null;
  }
  return current.performanceScore - previous.performanceScore;
}

function buildStrategyInsight(website, strategy) {
  const history = getReportsForUrlStrategy(website.url, strategy);
  const latest = history[history.length - 1] || null;
  const previous = history.length > 1 ? history[history.length - 2] : null;
  const delta = computeDelta(latest, previous);
  const trend = history.map((entry) => ({
    date: entry.createdAt,
    score: entry.performanceScore,
    cwvPassed: entry.cwvPassed,
  }));

  return { latest, previous, delta, trend, history };
}

function avgPerformance(site) {
  const scores = [site.mobileReport?.performanceScore, site.desktopReport?.performanceScore].filter(
    (s) => s != null
  );
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function needsAttention(site) {
  const scores = [site.mobileReport?.performanceScore, site.desktopReport?.performanceScore];
  const cwv = [site.mobileReport?.cwvPassed, site.desktopReport?.cwvPassed];
  return scores.some((s) => s != null && s < 50) || cwv.some((p) => p === false);
}

function enrichWebsite(website) {
  const mobile = buildStrategyInsight(website, 'mobile');
  const desktop = buildStrategyInsight(website, 'desktop');
  const lastChecked = [mobile.latest?.createdAt, desktop.latest?.createdAt]
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] ?? null;

  return {
    ...website,
    mobileReport: mobile.latest,
    desktopReport: desktop.latest,
    mobileDelta: mobile.delta,
    desktopDelta: desktop.delta,
    mobileTrend: mobile.trend,
    desktopTrend: desktop.trend,
    lastChecked,
    avgPerformance: avgPerformance({
      mobileReport: mobile.latest,
      desktopReport: desktop.latest,
    }),
    needsAttention: needsAttention({
      mobileReport: mobile.latest,
      desktopReport: desktop.latest,
    }),
    isFullyAnalyzed: Boolean(mobile.latest && desktop.latest),
    isPartiallyAnalyzed: Boolean(mobile.latest || desktop.latest),
  };
}

function addWebsite(rawUrl, name = '', meta = {}) {
  const url = validateUrl(rawUrl);
  const key = normalizeUrlKey(url);
  const websites = loadWebsites();
  if (websites.some((site) => normalizeUrlKey(site.url) === key)) {
    throw new Error('This website is already on your dashboard.');
  }
  const id = websites.length ? Math.max(...websites.map((site) => site.id)) + 1 : 1;
  const website = {
    id,
    url,
    name: name.trim() || hostnameFromUrl(url),
    platform: (meta.platform || '').trim(),
    region: (meta.region || '').trim(),
    group: (meta.group || '').trim(),
    addedAt: new Date().toISOString(),
    reports: emptyStrategyReports(),
  };
  websites.unshift(website);
  writeWebsites(websites);
  return website;
}

function updateWebsite(id, updates = {}) {
  const websites = loadWebsites();
  const index = websites.findIndex((site) => site.id === Number(id));
  if (index === -1) return null;
  const allowed = ['name', 'platform', 'region', 'group'];
  allowed.forEach((field) => {
    if (updates[field] !== undefined) websites[index][field] = String(updates[field]).trim();
  });
  writeWebsites(websites);
  return websites[index];
}

function deleteWebsite(id) {
  const websites = loadWebsites();
  const next = websites.filter((site) => site.id !== Number(id));
  if (next.length === websites.length) return false;
  writeWebsites(next);
  return true;
}

function cruxGoodShareScore(cwvHistory, strategy, weekIndex) {
  const block = strategy === 'desktop' ? cwvHistory?.desktop : cwvHistory?.mobile;
  if (!block?.metrics) return null;

  const shares = ['LCP', 'CLS', 'INP']
    .map((id) => block.metrics[id]?.goodShare?.[weekIndex])
    .filter((value) => value != null);

  if (!shares.length) return null;
  return Math.round((shares.reduce((sum, value) => sum + value, 0) / shares.length) * 100);
}

function getCruxTrendFromHistory(websiteId, strategy) {
  const cwvHistory = getBrandCwvHistory(websiteId);
  const block = strategy === 'desktop' ? cwvHistory?.desktop : cwvHistory?.mobile;
  if (!block?.labels?.length) return [];

  return block.labels.map((label, index) => ({
    date: label,
    label,
    score: cruxGoodShareScore(cwvHistory, strategy, index),
    source: 'crux-import',
  })).filter((point) => point.score != null);
}

function mergeTrendPoints(imported, live) {
  if (!imported.length) return live;
  if (!live.length) return imported;

  const liveLabels = new Set(live.map((p) => p.label || p.date));
  const prefix = imported.filter((p) => !liveLabels.has(p.label || p.date));
  return [...prefix, ...live];
}

function getWebsite(id) {
  return loadWebsites().find((site) => site.id === Number(id)) || null;
}

function listWebsitesWithReports() {
  return loadWebsites().map(enrichWebsite);
}

function applyFilters(sites, filters = {}) {
  let result = sites;
  if (filters.platform) result = result.filter((s) => s.platform === filters.platform);
  if (filters.region) result = result.filter((s) => s.region === filters.region);
  if (filters.group) result = result.filter((s) => s.group === filters.group);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (s) => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q)
    );
  }
  if (filters.attention === 'true') result = result.filter((s) => s.needsAttention);
  return result;
}

function getFilterOptions(sites) {
  const pick = (field) => [...new Set(sites.map((s) => s[field]).filter(Boolean))].sort();
  return {
    platforms: pick('platform'),
    regions: pick('region'),
    groups: pick('group'),
    websites: sortSitesByName(sites).map((s) => ({ id: s.id, name: s.name })),
  };
}

function getDashboard(filters = {}) {
  const allSites = listWebsitesWithReports();
  const sites = sortSitesByName(applyFilters(allSites, filters));
  const allReports = sites.flatMap((site) => [site.mobileReport, site.desktopReport].filter(Boolean));
  const passed = allReports.filter((report) => report.cwvPassed);
  const improved = sites.filter((s) => (s.mobileDelta ?? 0) > 0 || (s.desktopDelta ?? 0) > 0).length;
  const regressed = sites.filter((s) => (s.mobileDelta ?? 0) < 0 || (s.desktopDelta ?? 0) < 0).length;

  const ranked = [...sites]
    .filter((s) => s.avgPerformance != null)
    .sort((a, b) => b.avgPerformance - a.avgPerformance);

  return {
    summary: {
      totalWebsites: sites.length,
      analyzedWebsites: sites.filter((s) => s.isPartiallyAnalyzed).length,
      pendingWebsites: sites.filter((s) => !s.isPartiallyAnalyzed).length,
      fullyAnalyzedWebsites: sites.filter((s) => s.isFullyAnalyzed).length,
      cwvPassed: passed.length,
      cwvFailed: allReports.length - passed.length,
      averagePerformance: allReports.length
        ? Math.round(allReports.reduce((sum, r) => sum + (r.performanceScore || 0), 0) / allReports.length)
        : null,
      improvedBrands: improved,
      regressedBrands: regressed,
      needsAttention: sites.filter((s) => s.needsAttention).length,
    },
    filters: getFilterOptions(allSites),
    insights: {
      topPerformers: ranked.slice(0, 5),
      needsAttention: sites.filter((s) => s.needsAttention).slice(0, 5),
    },
    websites: sites,
  };
}

function getWebsiteDetail(id) {
  const website = getWebsite(id);
  if (!website) return null;
  const enriched = enrichWebsite(website);
  const history = loadReports()
    .filter((r) => r.websiteId === website.id || normalizeUrlKey(r.url) === normalizeUrlKey(website.url))
    .map(summarizeReport);
  return {
    ...enriched,
    history,
    cwvHistory: getBrandCwvHistory(website.id),
    mobileInsight: buildStrategyInsight(website, 'mobile'),
    desktopInsight: buildStrategyInsight(website, 'desktop'),
  };
}

function getReportActionItems(reportId) {
  const report = loadReports().find((entry) => entry.id === Number(reportId));
  if (!report) return null;
  const items = extractActionItemsFromPayload(report.payload);
  return {
    reportId: report.id,
    url: report.url,
    strategy: report.strategy,
    websiteId: report.websiteId,
    performanceScore: report.performanceScore,
    createdAt: report.createdAt,
    items,
    totalItems: items.length,
  };
}

function buildStrategyActions(website, strategy) {
  const insight = buildStrategyInsight(website, strategy);
  if (!insight.latest) return null;

  const fullReport = loadReports().find((r) => r.id === insight.latest.id);
  const items = fullReport
    ? extractActionItemsFromPayload(fullReport.payload)
    : [];

  return {
    reportId: insight.latest.id,
    strategy,
    performanceScore: insight.latest.performanceScore,
    analyzedAt: insight.latest.createdAt,
    items,
    totalItems: items.length,
  };
}

function getWebsiteActionItems(id) {
  const website = getWebsite(id);
  if (!website) return null;

  const mobile = buildStrategyActions(website, 'mobile');
  const desktop = buildStrategyActions(website, 'desktop');
  const merged = new Map();

  [...(mobile?.items || []), ...(desktop?.items || [])].forEach((item) => {
    const key = item.id;
    if (!merged.has(key) || item.priority > merged.get(key).priority) {
      merged.set(key, item);
    }
  });

  const topItems = [...merged.values()].sort((a, b) => b.priority - a.priority).slice(0, 10);

  return {
    websiteId: website.id,
    name: website.name,
    url: website.url,
    platform: website.platform,
    region: website.region,
    group: website.group,
    mobile,
    desktop,
    topItems,
    totalItems: topItems.length,
  };
}

function getActionItems(filters = {}) {
  let sites = loadWebsites();
  if (filters.platform) sites = sites.filter((s) => s.platform === filters.platform);
  if (filters.region) sites = sites.filter((s) => s.region === filters.region);
  if (filters.group) sites = sites.filter((s) => s.group === filters.group);
  if (filters.websiteId) sites = sites.filter((s) => s.id === Number(filters.websiteId));

  const websites = sortSitesByName(
    sites
      .map((site) => getWebsiteActionItems(site.id))
      .filter((entry) => entry && (entry.mobile || entry.desktop))
  );

  const withItems = websites.filter((w) => w.totalItems > 0);
  const withoutItems = websites.filter((w) => w.totalItems === 0);

  return {
    summary: {
      totalBrands: websites.length,
      brandsWithActions: withItems.length,
      totalActionItems: withItems.reduce((sum, w) => sum + w.totalItems, 0),
      pendingAnalysis: sites.length - websites.length,
    },
    filters: getFilterOptions(loadWebsites()),
    websites: withItems,
    pending: withoutItems,
  };
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

module.exports = {
  STRATEGIES,
  loadWebsites,
  saveReport,
  listReports,
  getReport,
  getReportContext,
  addWebsite,
  updateWebsite,
  deleteWebsite,
  getWebsite,
  getWebsiteDetail,
  listWebsitesWithReports,
  getDashboard,
  getWebsiteTrends,
  getPortfolioTrends,
  aggregateTrendByPeriod,
  getActionItems,
  getWebsiteActionItems,
  getReportActionItems,
  updateWebsiteAfterReport,
};
