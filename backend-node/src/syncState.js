const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SYNC_STATE_FILE = path.join(DATA_DIR, 'sync-state.json');
const CWV_HISTORY_FILE = path.join(DATA_DIR, 'cwv-history.json');

const DEFAULT_SYNC_STATE = {
  dataSeed: {
    completed: false,
    completedAt: null,
    brandCount: 0,
  },
  dailyCron: {
    enabled: true,
    lastRun: null,
    lastRunStatus: null,
    lastRunMessage: null,
  },
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSyncState() {
  ensureDataDir();
  if (!fs.existsSync(SYNC_STATE_FILE)) {
    writeSyncState(DEFAULT_SYNC_STATE);
    return { ...DEFAULT_SYNC_STATE };
  }
  const raw = JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf8'));
  return { ...DEFAULT_SYNC_STATE, ...raw };
}

function writeSyncState(state) {
  ensureDataDir();
  fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function isDataSeedCompleted() {
  return Boolean(loadSyncState().dataSeed?.completed);
}

function markDataSeedComplete(meta = {}) {
  const state = loadSyncState();
  state.dataSeed = {
    completed: true,
    completedAt: new Date().toISOString(),
    brandCount: meta.brandCount || 0,
  };
  writeSyncState(state);
  return state;
}

function markDailyCronRun(status, message = '') {
  const state = loadSyncState();
  state.dailyCron = {
    ...state.dailyCron,
    lastRun: new Date().toISOString(),
    lastRunStatus: status,
    lastRunMessage: message,
  };
  writeSyncState(state);
  return state;
}

function loadCwvHistory() {
  ensureDataDir();
  if (!fs.existsSync(CWV_HISTORY_FILE)) {
    return { importedAt: null, source: null, brands: {} };
  }
  return JSON.parse(fs.readFileSync(CWV_HISTORY_FILE, 'utf8'));
}

function writeCwvHistory(history) {
  ensureDataDir();
  fs.writeFileSync(CWV_HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
}

function saveBrandCwvHistory(websiteId, cwvHistory) {
  const store = loadCwvHistory();
  store.brands[String(websiteId)] = cwvHistory;
  writeCwvHistory(store);
}

function getBrandCwvHistory(websiteId) {
  return loadCwvHistory().brands[String(websiteId)] || null;
}

function resetCwvHistory(meta = {}) {
  writeCwvHistory({
    importedAt: meta.importedAt || new Date().toISOString(),
    source: meta.source || 'sample',
    brands: {},
  });
}

module.exports = {
  loadSyncState,
  writeSyncState,
  isDataSeedCompleted,
  markDataSeedComplete,
  markDailyCronRun,
  loadCwvHistory,
  writeCwvHistory,
  saveBrandCwvHistory,
  getBrandCwvHistory,
  resetCwvHistory,
};
