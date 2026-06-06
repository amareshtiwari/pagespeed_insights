(function initAppNav() {
  const nav = document.querySelector('.app-nav');
  if (!nav) return;

  const page = window.location.pathname.split('/').pop() || 'index.html';
  const links = [
    { href: 'cwv.html', label: 'CWV Intelligence' },
    { href: 'dashboard.html', label: 'Dashboard' },
    { href: 'trends.html', label: 'Trends' },
    { href: 'actions.html', label: 'Action Items' },
    { href: 'index.html', label: 'Analyze' },
    { href: 'reports.html', label: 'History' },
  ];

  const existing = nav.querySelectorAll('a');
  if (existing.length < links.length) {
    nav.innerHTML = links
      .map(({ href, label }) => {
        const active = page === href;
        return `<a href="${href}" class="app-nav__link${active ? ' app-nav__link--active' : ''}">${label}</a>`;
      })
      .join('');
    return;
  }

  existing.forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    anchor.classList.toggle('app-nav__link--active', href === page);
  });
})();

function pageLoadStart(contentEl, loadingEl) {
  const isFirstLoad = contentEl && !contentEl.dataset.loaded;
  const overlayInside = Boolean(loadingEl && contentEl && contentEl.contains(loadingEl));

  if (overlayInside && isFirstLoad) {
    contentEl.hidden = false;
    loadingEl.hidden = false;
  } else {
    if (loadingEl && isFirstLoad) loadingEl.hidden = false;
    if (contentEl && isFirstLoad) contentEl.hidden = true;
  }

  if (contentEl && !isFirstLoad) contentEl.setAttribute('aria-busy', 'true');
}

function pageLoadEnd(contentEl, loadingEl) {
  if (loadingEl) loadingEl.hidden = true;
  if (contentEl) {
    contentEl.hidden = false;
    contentEl.dataset.loaded = 'true';
    contentEl.removeAttribute('aria-busy');
  }
}

function preserveScroll(fn) {
  const scrollY = window.scrollY;
  return Promise.resolve(fn()).finally(() => {
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  });
}

function safeChartDestroy(chart) {
  if (chart && typeof chart.destroy === 'function') {
    chart.destroy();
  }
}

function whenChartReady(callback) {
  if (typeof Chart !== 'undefined') {
    callback();
    return;
  }
  const start = Date.now();
  const timer = setInterval(() => {
    if (typeof Chart !== 'undefined') {
      clearInterval(timer);
      callback();
      return;
    }
    if (Date.now() - start > 10000) clearInterval(timer);
  }, 50);
}
