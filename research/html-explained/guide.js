(function () {
  const root = document.documentElement;
  const key = 'gx-explainer-theme';
  let saved = null;
  try {
    saved = localStorage.getItem(key);
  } catch {
    // Direct file:// opens may not expose storage; the guide still works without persistence.
  }
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;

  const button = document.querySelector('[data-theme-toggle]');
  const updateButton = () => {
    if (!button) return;
    const light = root.dataset.theme === 'light';
    button.textContent = light ? 'Dark' : 'Light';
    button.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
  };
  button?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem(key, root.dataset.theme);
    } catch {
      // Theme switching remains useful even when persistence is unavailable.
    }
    updateButton();
  });
  updateButton();

  document.querySelectorAll('[data-copy]').forEach((copyButton) => {
    copyButton.addEventListener('click', async () => {
      const target = document.querySelector(copyButton.dataset.copy);
      if (!target) return;
      await navigator.clipboard?.writeText(target.textContent || '');
      const original = copyButton.textContent;
      copyButton.textContent = 'Copied';
      setTimeout(() => { copyButton.textContent = original; }, 1200);
    });
  });
})();
