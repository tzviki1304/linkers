// Runs in <head> before anything paints: applies the theme and, if the user chose
// to keep Chrome's own New Tab page, sends new tabs there.
(function () {
  let theme = 'system';
  let mode = 'dashboard';
  let lang = 'en';
  try {
    theme = localStorage.getItem('ls.theme') || 'system';
    mode = localStorage.getItem('ls.newTabMode') || 'dashboard';
    lang = localStorage.getItem('ls.lang') || 'en';
  } catch { /* ignore */ }

  const root = document.documentElement;
  // Set language & direction before first paint so Hebrew doesn't flash left-to-right.
  root.lang = lang === 'zh' ? 'zh-CN' : lang;
  root.dir = lang === 'he' ? 'rtl' : 'ltr';
  const isNewTab = /\/newtab\.html$/.test(location.pathname) && !new URLSearchParams(location.search).has('app');
  if (isNewTab && mode === 'chrome') {
    root.style.visibility = 'hidden';
    chrome.tabs.getCurrent((tab) => {
      if (tab) chrome.tabs.update(tab.id, { url: 'chrome://new-tab-page/' });
    });
  }

  function apply(t) {
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'dark' : 'light';
  }
  apply(theme);
  self.LS = self.LS || {};
  self.LS.applyTheme = apply;
})();
