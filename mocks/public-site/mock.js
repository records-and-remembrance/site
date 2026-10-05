/* Interaction samples only. Local HTML, no API or production dependencies. */
(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector('[data-theme-toggle]');
  const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  try {
    const saved = localStorage.getItem('monden-mock-theme');
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  } catch { /* file:// or restricted storage: theme works for this page. */ }
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : systemDark();
  const describeTheme = () => {
    themeButton.setAttribute('aria-label', isDark() ? 'ライトテーマに切り替える' : 'ダークテーマに切り替える');
    themeButton.title = themeButton.getAttribute('aria-label');
  };
  describeTheme();
  themeButton.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('monden-mock-theme', root.dataset.theme); } catch {}
    describeTheme();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', describeTheme);

  const digTargets = ['song.html', 'person.html', 'work.html', 'live.html', 'venue.html', 'project.html'];
  document.querySelectorAll('[data-dig]').forEach(button => button.addEventListener('click', () => {
    const choices = digTargets.filter(path => !location.pathname.endsWith('/' + path));
    location.href = choices[Math.floor(Math.random() * choices.length)];
  }));
  document.querySelector('[data-shuffle]')?.addEventListener('click', () => {
    const cards = document.querySelector('[data-discoveries]');
    cards.append(cards.firstElementChild);
  });

  const form = document.querySelector('[data-filter-form]');
  if (form) {
    const fields = [...form.querySelectorAll('[name]')];
    const items = [...document.querySelectorAll('[data-item]')];
    const results = document.querySelector('[data-results]');
    const count = document.querySelector('[data-result-count]');
    const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ja').trim();
    const restore = () => {
      const params = new URLSearchParams(location.search);
      fields.forEach(field => { field.value = params.get(field.name) || ''; });
    };
    const update = (writeUrl = true) => {
      const query = normalize(form.elements.namedItem('q')?.value || '');
      const selected = fields.filter(field => field.name !== 'q' && field.name !== 'sort' && field.value);
      let visible = 0;
      for (const item of items) {
        const text = normalize(item.dataset.search || item.textContent);
        item.hidden = !(query.split(/\s+/).every(word => text.includes(word)) && selected.every(field => item.dataset[field.name] === field.value));
        if (!item.hidden) visible++;
      }
      count.textContent = `サンプル ${items.length}件中 ${visible}件を表示`;
      document.querySelector('[data-empty]').hidden = visible !== 0;
      document.querySelectorAll('.timeline-year').forEach(year => {
        year.hidden = ![...year.querySelectorAll('[data-item]')].some(item => !item.hidden);
      });
      const sort = form.elements.namedItem('sort')?.value;
      if (sort) {
        [...items].sort((a, b) => sort === 'plays' ? Number(b.dataset.plays) - Number(a.dataset.plays) : (a.dataset.title || '').localeCompare(b.dataset.title || '', 'ja')).forEach(item => results.append(item));
      } else if (form.elements.namedItem('sort')) {
        items.forEach(item => results.append(item));
      }
      if (writeUrl) {
        const url = new URL(location.href);
        fields.forEach(field => field.value ? url.searchParams.set(field.name, field.value) : url.searchParams.delete(field.name));
        try { history.replaceState(null, '', url); } catch { /* file:// may restrict URL rewriting. */ }
      }
    };
    form.addEventListener('submit', event => { event.preventDefault(); update(); });
    form.addEventListener('input', () => update());
    form.addEventListener('change', () => update());
    form.addEventListener('reset', () => { setTimeout(() => update(), 0); });
    document.querySelectorAll('[data-clear]').forEach(button => button.addEventListener('click', () => {
      form.reset();
      fields[0]?.focus();
    }));
    window.addEventListener('popstate', () => { restore(); update(false); });
    restore();
    update(false);
  }
  document.querySelector('[data-support]')?.addEventListener('change', event => {
    document.querySelectorAll('[data-support-edge]').forEach(edge => { edge.style.display = event.target.checked ? '' : 'none'; });
  });
})();
