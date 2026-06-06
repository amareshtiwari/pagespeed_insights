require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const express = require('express');
const cors = require('cors');
const { parsePagespeedResponse, validateUrl } = require('./metrics');
const { PageSpeedError, runPagespeed } = require('./pagespeedClient');
const {
  STRATEGIES,
  saveReport,
  listReports,
  getReport,
  getReportContext,
  addWebsite,
  updateWebsite,
  deleteWebsite,
  getWebsite,
  getWebsiteDetail,
  getDashboard,
  getWebsiteTrends,
  getPortfolioTrends,
  getActionItems,
  getWebsiteActionItems,
  getReportActionItems,
} = require('./store');
const { loadSyncState, isDataSeedCompleted } = require('./syncState');
const { getCwvIntelligence } = require('./cwv');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function parseFilters(query) {
  return {
    platform: query.platform || '',
    region: query.region || '',
    group: query.group || '',
    search: query.search || '',
    attention: query.attention || '',
  };
}

app.get('/api/sync-state', (_req, res) => {
  res.json({
    ...loadSyncState(),
    dataSeedCompleted: isDataSeedCompleted(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pagespeed-node' });
});

app.get('/api/cwv', (req, res) => {
  res.json(
    getCwvIntelligence({
      platform: req.query.platform || '',
      region: req.query.region || '',
      group: req.query.group || '',
      search: req.query.search || '',
      websiteId: req.query.websiteId || '',
      device: req.query.device || 'mobile',
      metric: req.query.metric || 'LCP',
    })
  );
});

app.get('/api/dashboard', (req, res) => {
  res.json(getDashboard(parseFilters(req.query)));
});

app.get('/api/websites', (req, res) => {
  res.json(getDashboard(parseFilters(req.query)));
});

app.get('/api/websites/:id', (req, res) => {
  const detail = getWebsiteDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Website not found' });
  return res.json(detail);
});

app.post('/api/websites', (req, res) => {
  let url;
  try {
    url = validateUrl(req.body?.url || '');
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const website = addWebsite(url, req.body?.name || '', {
      platform: req.body?.platform,
      region: req.body?.region,
      group: req.body?.group,
    });
    return res.status(201).json(website);
  } catch (error) {
    return res.status(409).json({ error: error.message });
  }
});

app.patch('/api/websites/:id', (req, res) => {
  const website = updateWebsite(req.params.id, req.body || {});
  if (!website) return res.status(404).json({ error: 'Website not found' });
  return res.json(website);
});

app.delete('/api/websites/:id', (req, res) => {
  const removed = deleteWebsite(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Website not found' });
  return res.json({ success: true });
});

app.get('/api/action-items', (req, res) => {
  res.json(
    getActionItems({
      platform: req.query.platform,
      region: req.query.region,
      group: req.query.group,
      websiteId: req.query.websiteId,
    })
  );
});

app.get('/api/websites/:id/action-items', (req, res) => {
  const data = getWebsiteActionItems(req.params.id);
  if (!data) return res.status(404).json({ error: 'Website not found' });
  return res.json(data);
});

app.get('/api/reports/:id/action-items', (req, res) => {
  const data = getReportActionItems(req.params.id);
  if (!data) return res.status(404).json({ error: 'Report not found' });
  return res.json(data);
});

app.get('/api/trends', (req, res) => {
  res.json(
    getPortfolioTrends({
      period: req.query.period,
      platform: req.query.platform,
      region: req.query.region,
      group: req.query.group,
      websiteId: req.query.websiteId,
    })
  );
});

app.get('/api/websites/:id/trends', (req, res) => {
  const trends = getWebsiteTrends(req.params.id, { period: req.query.period });
  if (!trends) return res.status(404).json({ error: 'Website not found' });
  return res.json(trends);
});

app.get('/api/reports', (req, res) => {
  res.json({
    reports: listReports({
      websiteId: req.query.websiteId,
      strategy: req.query.strategy,
      platform: req.query.platform,
    }),
  });
});

app.get('/api/reports/:id/context', (req, res) => {
  const context = getReportContext(req.params.id);
  if (!context) return res.status(404).json({ error: 'Report not found' });
  return res.json(context);
});

app.get('/api/reports/:id', (req, res) => {
  const report = getReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  return res.json(report);
});

async function analyzeAndSave(url, strategy, websiteId = null) {
  const raw = await runPagespeed(url, strategy);
  const payload = parsePagespeedResponse(raw, url, strategy);
  if (websiteId) payload.websiteId = websiteId;
  const saved = saveReport(payload);
  return { ...payload, reportId: saved.id, savedAt: saved.createdAt, websiteId };
}

async function analyzeWebsiteAllStrategies(website) {
  const results = {};
  for (const strategy of STRATEGIES) {
    results[strategy] = await analyzeAndSave(website.url, strategy, website.id);
  }
  return results;
}

app.get('/api/analyze', async (req, res) => {
  let url;
  try {
    url = validateUrl(req.query.url || '');
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const strategy = (req.query.strategy || 'mobile').toLowerCase();
  if (!['mobile', 'desktop'].includes(strategy)) {
    return res.status(400).json({ error: "strategy must be 'mobile' or 'desktop'" });
  }

  const websiteId = req.query.websiteId ? Number(req.query.websiteId) : null;

  try {
    const result = await analyzeAndSave(url, strategy, websiteId);
    return res.json(result);
  } catch (error) {
    if (error instanceof PageSpeedError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

app.post('/api/websites/:id/analyze', async (req, res) => {
  const website = getWebsite(req.params.id);
  if (!website) return res.status(404).json({ error: 'Website not found' });

  try {
    const results = await analyzeWebsiteAllStrategies(website);
    return res.json(results);
  } catch (error) {
    if (error instanceof PageSpeedError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

app.listen(PORT, () => {
  console.log(`PageSpeed Node API listening on http://localhost:${PORT}`);
});
