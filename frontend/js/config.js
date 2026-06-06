window.PAGESPEED_CONFIG = {
  apiBase: 'http://localhost:3000',
  fetchTimeoutMs: 15000,
};

function getApiBase() {
  return window.PAGESPEED_CONFIG.apiBase;
}

async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), window.PAGESPEED_CONFIG.fetchTimeoutMs);

  try {
    const response = await fetch(`${getApiBase()}${path}`, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Is the backend running on port 3000?');
    }
    throw new Error('Cannot reach the backend. Start it with: cd backend-node && npm start');
  } finally {
    clearTimeout(timeout);
  }
}

function scoreColor(score) {
  if (score == null) return 'var(--text-secondary)';
  if (score >= 90) return 'var(--good)';
  if (score >= 50) return 'var(--needs)';
  return 'var(--poor)';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
