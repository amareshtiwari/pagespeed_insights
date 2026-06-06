const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const PSI_CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

class PageSpeedError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'PageSpeedError';
    this.statusCode = statusCode;
  }
}

function getApiKey() {
  return (process.env.GOOGLE_PAGESPEED_API_KEY || '').trim();
}

async function runPagespeed(url, strategy = 'mobile') {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new PageSpeedError(
      'GOOGLE_PAGESPEED_API_KEY is not configured. Copy .env.example to .env and add your key.',
      503
    );
  }

  const params = new URLSearchParams({ url, strategy, key: apiKey });
  PSI_CATEGORIES.forEach((category) => params.append('category', category));

  let response;
  try {
    response = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    throw new PageSpeedError(`Failed to reach PageSpeed Insights API: ${error.message}`);
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new PageSpeedError(
      `PageSpeed Insights API error (${response.status}): ${detail}`,
      response.status < 500 ? response.status : 502
    );
  }

  return response.json();
}

module.exports = {
  PageSpeedError,
  runPagespeed,
};
