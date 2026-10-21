// Ctrl+K search across every workspace: titles, URLs, notes, tags.
(function (g) {
  const LS = g.LS;
  const D = LS.data;
  const { h } = LS.dom;
  const icon = LS.icon;
  const t = (...a) => LS.i18n.t(...a);

  let current = null;

  function search(q) {
    const data = LS.store.data;
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) {
      const all = D.allLinks(data);
      const pinned = all.filter((x) => x.link.pinned);
      const recent = all.filter((x) => !x.link.pinned).sort((a, b) => b.link.createdAt - a.link.createdAt);
      return [...pinned, ...recent].slice(0, 12).map((x) => ({ kind: 'link', ...x }));
    }
    const out = [];
    for (const ws of data.workspaces) {
      const wsName = ws.name.toLowerCase();
      if (terms.every((t) => wsName.includes(t))) out.push({ kind: 'workspace', ws, score: 40 });
      for (const cat of ws.categories) {
        const catName = cat.name.toLowerCase();
        for (const link of cat.links) {
          const title = link.title.toLowerCase();
          const domain = D.domainOf(link.url).toLowerCase();
          const hay = [title, link.url.toLowerCase(), link.note.toLowerCase(), link.tags.join(' ').toLowerCase(), catName, wsName].join(' \u0001 ');
          if (!terms.every((t) => hay.includes(t))) continue;
          let score = link.pinned ? 3 : 0;
          for (const t of terms) {
            if (title.startsWith(t)) score += 30;
            else if (title.includes(t)) score += 20;
            else if (domain.includes(t)) score += 14;
            else if (link.tags.some((x) => x.toLowerCase() === t)) score += 12;
            else score += 4;
          }
          out.push({ kind: 'link', ws, cat, link, score });
        }
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 60);
  }

  // Highlights the first matching term without using innerHTML.
  function highlight(text, q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const lower = text.toLowerCase();
    for (const term of terms) {
      const i = lower.indexOf(term);
      if (i !== -1) return [text.slice(0, i), h('mark', null, text.slice(i, i + term.length)), text.slice(i + term.length)];
    }
    return [text];
  }

  function open() {
    if (current) return;
    const input = h('input', {
      class: 'palette-input', placeholder: t('search.placeholder'), dir: 'auto',
      spellcheck: 'false', autocomplete: 'off', autofocus: true, 'aria-label': t('search.label'),
    });
    const list = h('div', { class: 'palette-list', role: 'listbox' });
    const k = (text) => h('kbd', null, text);
    const body = h('div', { class: 'palette' },
      h('div', { class: 'palette-search' }, icon('search', 18), input),
      list,
      h('div', { class: 'palette-foot' },
        h('span', null, k('↑'), k('↓'), ' ', t('search.move')), h('span', null, k('Enter'), ' ', t('search.open')),
        h('span', null, k('Ctrl'), k('Enter'), ' ', t('search.newTab')), h('span', null, k('Esc'), ' ', t('search.close'))));

    const m = LS.dom.modal({ body, size: 'palette', className: 'palette-modal', onClose: () => { current = null; } });
    current = m;
    let results = [];
    let sel = 0;

    function choose(item, newTab) {
      if (!item) return;
      m.close();
      if (item.kind === 'workspace') { LS.actions.setActiveWorkspace(item.ws.id); return; }
      LS.actions.openLink(item.link, newTab || LS.store.settings.openLinksIn === 'new');
    }

    function draw() {
      const q = input.value;
      const rows = [];
      if (!q.trim() && results.length) rows.push(h('div', { class: 'palette-group' }, t('search.recent')));
      results.forEach((r, i) => {
        const row = r.kind === 'workspace'
          ? h('div', { class: 'palette-item', role: 'option' },
            h('span', { class: 'avatar sm', style: { '--c': D.COLORS[r.ws.color] } }, r.ws.icon || ([...r.ws.name][0] || '?').toUpperCase()),
            h('div', { class: 'pi-text' }, h('div', { class: 'pi-title', dir: 'auto' }, highlight(r.ws.name, q)), h('div', { class: 'pi-sub' }, t('search.workspace'))),
            h('span', { class: 'pi-kind' }, t('search.goTo')))
          : h('div', { class: 'palette-item', role: 'option' },
            LS.dom.favicon(r.link.url, r.link.icon),
            h('div', { class: 'pi-text' },
              h('div', { class: 'pi-title', dir: 'auto' }, highlight(r.link.title, q), r.link.pinned ? icon('pin', 12, 'pi-pin') : null),
              h('div', { class: 'pi-sub' }, h('span', null, D.domainOf(r.link.url)), h('span', { class: 'pi-path', dir: 'auto' }, `${r.ws.name} › ${r.cat.name}`))),
            r.link.tags.length ? h('span', { class: 'tags' }, r.link.tags.slice(0, 2).map((tag) => h('span', { class: 'tag' }, tag))) : null);
        row.classList.toggle('sel', i === sel);
        row.setAttribute('aria-selected', String(i === sel));
        row.addEventListener('mousemove', () => { if (sel !== i) { sel = i; mark(); } });
        row.addEventListener('click', (e) => choose(r, e.ctrlKey || e.metaKey));
        row.addEventListener('auxclick', (e) => { if (e.button === 1) choose(r, true); });
        rows.push(row);
      });
      if (!results.length) {
        rows.push(h('div', { class: 'palette-empty' }, q.trim() ? t('search.noResults', { query: q.trim() }) : t('search.empty')));
      }
      list.replaceChildren(...rows);
    }

    function mark() {
      list.querySelectorAll('.palette-item').forEach((el, i) => {
        el.classList.toggle('sel', i === sel);
        el.setAttribute('aria-selected', String(i === sel));
        if (i === sel) el.scrollIntoView({ block: 'nearest' });
      });
    }

    input.addEventListener('input', () => { results = search(input.value); sel = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(results[sel], e.ctrlKey || e.metaKey || e.shiftKey); }
    });
    results = search('');
    draw();
  }

  LS.palette = { open };
})(self);
