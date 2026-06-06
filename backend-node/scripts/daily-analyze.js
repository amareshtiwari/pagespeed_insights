#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { PageSpeedError, runPagespeed } = require('../src/pagespeedClient');
const { parsePagespeedResponse } = require('../src/metrics');
const { loadWebsites, saveReport, STRATEGIES } = require('../src/store');
const { markDailyCronRun } = require('../src/syncState');

async function analyzeAndSave(url, strategy, websiteId) {
  const raw = await runPagespeed(url, strategy);
  const payload = parsePagespeedResponse(raw, url, strategy);
  payload.websiteId = websiteId;
  return saveReport(payload);
}

async function main() {
  const websites = loadWebsites();
  if (!websites.length) {
    markDailyCronRun('skipped', 'No websites to analyze');
    console.log('No websites found. Add brands via the dashboard first.');
    process.exit(0);
  }

  console.log(`Daily analyze started for ${websites.length} brands…`);
  const errors = [];

  for (let i = 0; i < websites.length; i += 1) {
    const site = websites[i];
    console.log(`[${i + 1}/${websites.length}] ${site.name} (${site.url})`);

    for (const strategy of STRATEGIES) {
      try {
        const saved = await analyzeAndSave(site.url, strategy, site.id);
        console.log(`  ✓ ${strategy} — performance ${saved.performanceScore}`);
      } catch (error) {
        const message = error instanceof PageSpeedError ? error.message : error.message;
        errors.push(`${site.name} (${strategy}): ${message}`);
        console.error(`  ✗ ${strategy} — ${message}`);
      }
    }
  }

  if (errors.length) {
    markDailyCronRun('partial', `${errors.length} errors`);
    console.log(`Done with ${errors.length} error(s).`);
    process.exit(1);
  }

  markDailyCronRun('success', `Analyzed ${websites.length} brands`);
  console.log('Daily analyze completed successfully.');
}

main().catch((error) => {
  markDailyCronRun('failed', error.message);
  console.error('Daily analyze failed:', error.message);
  process.exit(1);
});
