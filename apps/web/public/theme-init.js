// Runs before first paint so the page never flashes the wrong theme.
(function () {
  try {
    var pref = localStorage.getItem('nadgodziny:theme') || 'system';
    var dark =
      pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch {
    document.documentElement.dataset.theme = 'light';
  }
})();
