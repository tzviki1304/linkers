// Dashboard: sidebar, workspace view, open tabs panel, drag & drop, shortcuts.
(function (g) {
  const LS = g.LS;
  const D = LS.data;
  const A = LS.actions;
  const store = LS.store;
  const icon = LS.icon;
  const { h, menu, toast, timeAgo, isTyping } = LS.dom;
  const tr = (...a) => LS.i18n.t(...a);

  const SELF = chrome.runtime.getURL('');
  const IS_APP = new URLSearchParams(location.search).has('app');
  const IS_MAC = /Mac/.test(navigator.platform);
  const NEWTAB_RE = /^chrome:\/\/(newtab|new-tab-page)/;
  const EXPECTED_VERSION = '2.1.0';

  const ui = {
    tabs: [],
    tabFilter: '',
    currentWindowId: null,
    myTabId: null,
    saveTarget: readLocal('ls.saveTarget'),
    backupMeta: null,
    drag: null,
    indicator: null,
    tabsEls: null,
  };

  function readLocal(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } }
  function writeLocal(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

  // ======================================================================
  // Render
  // ======================================================================
  function render() {
    document.body.classList.toggle('tabs-hidden', !store.settings.showTabsPanel);
    renderSidebar();
    renderMain();
    renderTabsList();
  }

  function avatar(ws, size = '') {
    const letter = ws.icon || ([...ws.name.trim()][0] || '?').toUpperCase();
    return h('span', { class: `avatar ${size} ${ws.icon ? 'emoji' : ''}`, style: { '--c': D.COLORS[ws.color] }, 'aria-hidden': 'true' }, letter);
  }

  // ---------- sidebar ----------
  function renderSidebar() {
    const d = store.data;
    const theme = store.settings.theme;
    const themeIcon = { system: 'monitor', light: 'sun', dark: 'moon' }[theme];
    const nextTheme = { system: 'light', light: 'dark', dark: 'system' }[theme];

    document.getElementById('sidebar').replaceChildren(
      h('div', { class: 'brand' },
        h('img', { src: 'icons/icon48.png', alt: '' }),
        h('span', null, 'Link Saver')),
      h('div', { class: 'side-head' },
        h('span', null, tr('sidebar.workspaces')),
        h('button', { class: 'icon-btn sm', title: tr('ws.new'), 'aria-label': tr('ws.new'), onclick: A.addWorkspace }, icon('plus', 16))),
      h('nav', { class: 'ws-list', 'aria-label': tr('sidebar.workspaces') }, d.workspaces.map(wsItem)),
      h('div', { class: 'side-foot' },
        backupPill(),
        h('div', { class: 'side-actions' },
          h('button', { class: 'icon-btn', title: tr('theme.toggleTitle', { current: tr('theme.' + theme), next: tr('theme.' + nextTheme) }), onclick: () => A.setSetting('theme', nextTheme) }, icon(themeIcon)),
          h('button', { class: 'icon-btn', title: tr('settings.title'), onclick: () => LS.settings.open() }, icon('settings')),
          h('a', { class: 'icon-btn', href: 'https://buymeacoffee.com/tzviki', target: '_blank', rel: 'noopener', title: tr('about.coffee') }, icon('coffee')))));
  }

  function wsItem(ws) {
    const active = ws.id === store.data.activeWorkspaceId;
    return h('div', {
      class: 'ws-item' + (active ? ' active' : ''), role: 'button', tabindex: '0', draggable: 'true',
      dataset: { id: ws.id }, 'aria-current': active ? 'page' : null, title: ws.name,
      onclick: () => A.setActiveWorkspace(ws.id),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); A.setActiveWorkspace(ws.id); } },
      oncontextmenu: (e) => { e.preventDefault(); menu(wsMenu(ws), { x: e.clientX, y: e.clientY }); },
      ondragstart: (e) => startDrag(e, { type: 'workspace', id: ws.id }),
    },
    avatar(ws),
    h('span', { class: 'ws-name', dir: 'auto' }, ws.name),
    h('span', { class: 'ws-count' }, String(D.countLinks(ws))),
    h('button', {
      class: 'icon-btn xs ws-more', title: tr('ws.options'), 'aria-label': tr('ws.options'),
      onclick: (e) => { e.stopPropagation(); menu(wsMenu(ws), e.currentTarget); },
    }, icon('more', 16)));
  }

  function wsMenu(ws) {
    return [
      { label: tr('ws.edit'), icon: 'pencil', run: () => A.editWorkspace(ws.id) },
      { label: tr('cat.add'), icon: 'folderPlus', run: () => { A.setActiveWorkspace(ws.id); A.addCategory(ws.id); } },
      'sep',
      { label: tr('ws.delete'), icon: 'trash', danger: true, run: () => A.deleteWorkspace(ws.id) },
    ];
  }

  function backupPill() {
    const b = store.settings.backup;
    const m = ui.backupMeta || {};
    let state = 'ok', title, sub;
    if (!b.destination) { state = 'warn'; title = tr('backup.pill.off'); sub = tr('backup.pill.setup'); }
    else if (!b.enabled) { state = 'warn'; title = tr('backup.pill.paused'); sub = tr('backup.pill.turnOn'); }
    else if (m.pending) { state = 'warn'; title = tr('backup.pill.attention'); sub = LS.i18n.err(m.lastError) || tr('common.openSettings'); }
    else {
      title = m.lastBackupAt ? tr('backup.pill.backedUp', { time: timeAgo(m.lastBackupAt) }) : tr('backup.pill.scheduled');
      sub = b.destination === 'folder' ? (b.folderName || tr('backup.folder')) : `Downloads/${b.subfolder}`;
    }
    return h('button', { class: `backup-pill ${state}`, title: tr('backup.settingsTitle'), onclick: () => LS.settings.open('backup') },
      icon(state === 'ok' ? 'shield' : 'alert', 16),
      h('span', { class: 'bp-text' }, h('span', { class: 'bp-title' }, title), h('span', { class: 'bp-sub' }, sub)));
  }

  // ---------- main ----------
  function renderMain() {
    const main = document.getElementById('main');
    const prev = document.getElementById('content');
    const keepScroll = prev ? prev.scrollTop : 0;
    const ws = store.activeWorkspace();
    const s = store.settings;
    const total = D.countLinks(ws);

    const topbar = h('header', { class: 'topbar' },
      h('div', { class: 'ws-title' },
        avatar(ws, 'lg'),
        h('div', { class: 'ws-title-text' },
          h('h1', { dir: 'auto' }, ws.name),
          h('div', { class: 'muted small' }, `${tr('count.categories', { count: ws.categories.length })} · ${tr('count.links', { count: total })}`))),
      h('button', { class: 'search-trigger', onclick: () => LS.palette.open() },
        icon('search', 16), h('span', null, tr('search.trigger')), h('kbd', null, IS_MAC ? '⌘ K' : 'Ctrl K')),
      h('div', { class: 'topbar-actions' },
        h('div', { class: 'seg', role: 'group', 'aria-label': tr('view.label') },
          h('button', { class: s.view === 'grid' ? 'on' : '', title: tr('view.grid'), 'aria-pressed': String(s.view === 'grid'), onclick: () => A.setSetting('view', 'grid') }, icon('grid', 16)),
          h('button', { class: s.view === 'list' ? 'on' : '', title: tr('view.list'), 'aria-pressed': String(s.view === 'list'), onclick: () => A.setSetting('view', 'list') }, icon('list', 16))),
        h('button', {
          class: 'icon-btn', title: tr('common.more'), 'aria-label': tr('common.more'),
          onclick: (e) => menu([
            { label: tr('cat.collapseAll'), icon: 'chevronRight', run: () => A.setAllCollapsed(true) },
            { label: tr('cat.expandAll'), icon: 'chevronDown', run: () => A.setAllCollapsed(false) },
            'sep',
            { label: tr('data.export'), icon: 'download', run: A.exportData },
            { label: tr('data.importRestore'), icon: 'upload', run: A.importFromFile },
          ], e.currentTarget),
        }, icon('more')),
        h('button', {
          class: 'icon-btn' + (s.showTabsPanel ? ' on' : ''), title: s.showTabsPanel ? tr('tabs.hide') : tr('tabs.show'),
          onclick: () => A.setSetting('showTabsPanel', !s.showTabsPanel),
        }, icon('panelRight')),
        h('button', { class: 'btn btn-primary', onclick: () => A.addCategory() }, icon('folderPlus', 16), h('span', { class: 'hide-sm' }, tr('cat.new')))));

    const content = h('div', { class: 'content', id: 'content' },
      updateBanner(),
      backupBanner(),
      ws.categories.length
        ? [ws.categories.map((c) => categorySection(c)),
          h('button', { class: 'add-cat-ghost', onclick: () => A.addCategory() }, icon('plus', 16), tr('cat.add'))]
        : emptyWorkspace());

    main.replaceChildren(topbar, content);
    content.scrollTop = keepScroll;
  }

  function backupBanner() {
    const s = store.settings;
    const b = s.backup;
    const m = ui.backupMeta || {};
    const banner = (ico, kind, title, text, actions) =>
      h('div', { class: `banner ${kind}` }, h('span', { class: 'banner-ico' }, icon(ico, 18)),
        h('div', { class: 'banner-text' }, h('strong', null, title), h('span', null, text)),
        h('div', { class: 'banner-actions' }, actions));

    if (!b.destination && !s.backupPromptDismissed) {
      return banner('shield', 'info', tr('banner.backup.title'),
        tr('banner.backup.text'), [
          h('button', { class: 'btn btn-ghost sm', onclick: () => A.setSetting('backupPromptDismissed', true) }, tr('common.notNow')),
          h('button', { class: 'btn btn-primary sm', onclick: () => LS.settings.open('backup') }, tr('banner.backup.setup')),
        ]);
    }
    if (b.destination && b.enabled && m.pending) {
      if (b.destination === 'folder') {
        return banner('alert', 'warn', tr('banner.waiting.title'),
          tr('banner.waiting.text'), [
            h('button', { class: 'btn btn-ghost sm', onclick: () => LS.settings.open('backup') }, tr('settings.title')),
            h('button', { class: 'btn btn-primary sm', onclick: () => LS.backupUI.allowAndRun() }, tr('banner.waiting.allow')),
          ]);
      }
      return banner('alert', 'warn', tr('backup.pill.attention'), LS.i18n.err(m.lastError) || tr('banner.attention.text'), [
        h('button', { class: 'btn btn-primary sm', onclick: () => LS.settings.open('backup') }, tr('common.openSettings')),
      ]);
    }
    return null;
  }

  // Page files update instantly, but manifest changes (permissions, toolbar button,
  // shortcuts) only apply after the extension is reloaded in chrome://extensions.
  function updateBanner() {
    const m = chrome.runtime.getManifest();
    const perms = m.permissions || [];
    if (m.version === EXPECTED_VERSION && perms.includes('favicon') && m.action) return null;
    return h('div', { class: 'banner warn' }, h('span', { class: 'banner-ico' }, icon('refresh', 18)),
      h('div', { class: 'banner-text' },
        h('strong', null, tr('banner.update.title')),
        h('span', null, tr('banner.update.text'))),
      h('div', { class: 'banner-actions' },
        h('button', { class: 'btn btn-primary sm', onclick: () => chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id }) }, tr('banner.update.button'))));
  }

  function emptyWorkspace() {
    return h('div', { class: 'empty-state' },
      h('div', { class: 'empty-ico' }, icon('folder', 28)),
      h('h3', null, tr('empty.ws.title')),
      h('p', null, tr('empty.ws.text')),
      h('button', { class: 'btn btn-primary', onclick: () => A.addCategory() }, icon('folderPlus', 16), tr('empty.ws.button')));
  }

  function sortedLinks(cat) {
    return [...cat.links.filter((l) => l.pinned), ...cat.links.filter((l) => !l.pinned)];
  }

  function categorySection(cat) {
    const s = store.settings;
    const nameEl = h('span', { class: 'cat-name', dir: 'auto', title: tr('cat.renameHint') }, cat.name);
    nameEl.addEventListener('dblclick', (e) => { e.stopPropagation(); inlineRename(nameEl, cat); });

    const head = h('div', {
      class: 'cat-head', draggable: 'true',
      ondragstart: (e) => startDrag(e, { type: 'category', id: cat.id }),
      onclick: (e) => { if (!e.target.closest('button, input')) A.toggleCollapse(cat.id); },
      oncontextmenu: (e) => { e.preventDefault(); menu(catMenu(cat), { x: e.clientX, y: e.clientY }); },
    },
    h('span', { class: 'grip', title: tr('common.dragToReorder') }, icon('grip', 14)),
    h('span', { class: 'chev' }, icon(cat.collapsed ? 'chevronRight' : 'chevronDown', 16, 'flip-rtl')),
    nameEl,
    h('span', { class: 'count' }, String(cat.links.length)),
    h('div', { class: 'cat-actions' },
      h('button', { class: 'icon-btn sm', title: tr('link.add'), 'aria-label': tr('link.add'), onclick: () => A.addLink(cat.id) }, icon('plus', 16)),
      cat.links.length ? h('button', { class: 'icon-btn sm', title: tr('cat.openAll'), 'aria-label': tr('cat.openAll'), onclick: () => A.openAll(cat.id) }, icon('external', 16)) : null,
      h('button', { class: 'icon-btn sm', title: tr('cat.options'), 'aria-label': tr('cat.options'), onclick: (e) => menu(catMenu(cat), e.currentTarget) }, icon('more', 16))));

    let body = null;
    if (!cat.collapsed) {
      body = h('div', { class: 'cat-body' },
        cat.links.length
          ? h('div', { class: `links links-${s.view}` }, sortedLinks(cat).map((l) => linkCard(cat, l)))
          : h('div', { class: 'cat-empty' }, icon('tab', 18),
            h('span', null, tr('cat.emptyDrop') + ' '),
            h('button', { class: 'text-btn', onclick: () => A.addLink(cat.id) }, tr('cat.emptyAdd'))));
    }
    return h('section', { class: 'cat' + (cat.collapsed ? ' collapsed' : ''), dataset: { id: cat.id } }, head, body);
  }

  function catMenu(cat) {
    const n = cat.links.length;
    return [
      { label: tr('link.add'), icon: 'plus', run: () => A.addLink(cat.id) },
      { label: tr('common.rename'), icon: 'pencil', run: () => { const el = document.querySelector(`.cat[data-id="${cat.id}"] .cat-name`); if (el) inlineRename(el, cat); } },
      { label: tr('cat.saveTabsHere'), icon: 'bookmarkPlus', run: () => A.saveAllTabsDialog(currentWindowTabs(), cat.id) },
      'sep',
      { label: tr('cat.openAll'), icon: 'external', disabled: !n, run: () => A.openAll(cat.id) },
      { label: tr('cat.openAllWindow'), icon: 'window', disabled: !n, run: () => A.openAll(cat.id, true) },
      { label: cat.collapsed ? tr('cat.expand') : tr('cat.collapse'), icon: cat.collapsed ? 'chevronDown' : 'chevronRight', run: () => A.toggleCollapse(cat.id) },
      { label: tr('cat.moveToWs'), icon: 'move', disabled: store.data.workspaces.length < 2, run: () => A.moveCategoryDialog(cat.id) },
      'sep',
      { label: tr('cat.delete'), icon: 'trash', danger: true, run: () => A.deleteCategory(cat.id) },
    ];
  }

  function inlineRename(nameEl, cat) {
    const head = nameEl.closest('.cat-head');
    const input = h('input', { class: 'inline-input', value: cat.name, dir: 'auto', 'aria-label': tr('cat.nameLabel') });
    if (head) head.draggable = false;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (head) head.draggable = true;
      if (save && v && v !== cat.name) A.renameCategory(cat.id, v);
      else input.replaceWith(nameEl);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }

  // ---------- link card ----------
  const favicon = (url, icon) => LS.dom.favicon(url, icon);

  const WEB_RE = /^(https?|mailto):/i;
  const BLOCKED_RE = /^(javascript|data|vbscript):/i;

  function openUrl(url, newTab) {
    if (BLOCKED_RE.test(url)) return;
    if (newTab) chrome.tabs.create({ url, active: false });
    else chrome.tabs.getCurrent((t) => (t ? chrome.tabs.update(t.id, { url }) : chrome.tabs.create({ url })));
  }

  function linkCard(cat, link) {
    const s = store.settings;
    const newTab = s.openLinksIn === 'new';
    const safeHref = WEB_RE.test(link.url) ? link.url : '#';
    const anchor = h('a', {
      class: 'link-main', href: safeHref, target: newTab ? '_blank' : null, rel: 'noopener noreferrer', draggable: 'false',
      title: [link.title, link.url, link.note].filter(Boolean).join('\n'),
    },
    favicon(link.url, link.icon),
    h('span', { class: 'link-text' },
      h('span', { class: 'link-title', dir: 'auto' }, link.title),
      h('span', { class: 'link-sub' },
        h('span', { class: 'link-domain' }, D.domainOf(link.url)),
        s.view === 'list' && link.note ? h('span', { class: 'link-note', dir: 'auto' }, link.note) : null)),
    link.tags.length ? h('span', { class: 'tags' }, link.tags.slice(0, 3).map((t) => h('span', { class: 'tag', dir: 'auto' }, t))) : null);

    // Non-web URLs (chrome://, file://, …) can't be opened by a plain link from this page.
    if (safeHref === '#') {
      anchor.addEventListener('click', (e) => { e.preventDefault(); openUrl(link.url, newTab || e.ctrlKey || e.metaKey); });
      anchor.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); openUrl(link.url, true); } });
    }

    return h('div', {
      class: 'link' + (link.pinned ? ' pinned' : ''), draggable: 'true', dataset: { id: link.id, cat: cat.id },
      ondragstart: (e) => startDrag(e, { type: 'link', id: link.id }, link.url),
      oncontextmenu: (e) => { e.preventDefault(); menu(linkMenu(link), { x: e.clientX, y: e.clientY }); },
    },
    anchor,
    link.pinned ? h('span', { class: 'pin-badge', title: tr('link.pinned') }, icon('pin', 11)) : null,
    h('div', { class: 'link-actions' },
      h('button', { class: 'icon-btn xs' + (link.pinned ? ' on' : ''), title: link.pinned ? tr('link.unpin') : tr('link.pin'), onclick: () => A.togglePin(link.id) }, icon('pin', 14)),
      h('button', { class: 'icon-btn xs', title: tr('common.edit'), onclick: () => A.editLink(link.id) }, icon('pencil', 14)),
      h('button', { class: 'icon-btn xs', title: tr('common.more'), onclick: (e) => menu(linkMenu(link), e.currentTarget) }, icon('more', 14))));
  }

  function linkMenu(link) {
    return [
      { label: tr('link.openNewTab'), icon: 'external', run: () => openUrl(link.url, true) },
      { label: tr('link.openNewWindow'), icon: 'window', run: () => !BLOCKED_RE.test(link.url) && chrome.windows.create({ url: link.url }) },
      'sep',
      { label: tr('common.edit'), icon: 'pencil', run: () => A.editLink(link.id) },
      { label: link.pinned ? tr('link.unpin') : tr('link.pin'), icon: 'pin', run: () => A.togglePin(link.id) },
      { label: tr('link.moveTo'), icon: 'move', run: () => A.moveLinkDialog(link.id) },
      { label: tr('link.copy'), icon: 'copy', run: () => A.copyUrl(link.id) },
      'sep',
      { label: tr('common.delete'), icon: 'trash', danger: true, run: () => A.deleteLink(link.id) },
    ];
  }

  // ======================================================================
  // Open tabs panel
  // ======================================================================
  function buildTabsPanel() {
    const filter = h('input', {
      class: 'input sm', type: 'search', placeholder: tr('tabs.filter'), 'aria-label': tr('tabs.filter'),
      oninput: (e) => { ui.tabFilter = e.target.value; renderTabsList(); },
    });
    const target = h('select', {
      class: 'input sm', 'aria-label': tr('tabs.saveToLabel'),
      onchange: (e) => { ui.saveTarget = e.target.value; writeLocal('ls.saveTarget', ui.saveTarget); renderTabsList(); },
    });
    const count = h('span', { class: 'count' });
    const list = h('div', { class: 'tabs-list' });
    ui.tabsEls = { filter, target, count, list };

    document.getElementById('tabsPanel').replaceChildren(
      h('div', { class: 'panel-head' },
        h('h2', null, tr('tabs.title')), count, h('div', { class: 'spacer' }),
        h('button', { class: 'icon-btn sm', title: tr('tabs.hidePanel'), 'aria-label': tr('tabs.hidePanel'), onclick: () => A.setSetting('showTabsPanel', false) }, icon('x', 16))),
      h('div', { class: 'panel-tools' },
        h('label', { class: 'save-to' }, h('span', null, tr('tabs.saveTo')), target),
        filter),
      list,
      h('div', { class: 'panel-foot' },
        h('button', { class: 'btn btn-secondary block', onclick: () => A.saveAllTabsDialog(currentWindowTabs(), targetCatId()) },
          icon('bookmarkPlus', 16), tr('tabs.saveAll'))));
  }

  function targetCatId() {
    const ws = store.activeWorkspace();
    if (ws.categories.some((c) => c.id === ui.saveTarget)) return ui.saveTarget;
    return ws.categories[0] ? ws.categories[0].id : null;
  }

  const currentWindowTabs = () => ui.tabs.filter((t) => t.windowId === ui.currentWindowId);

  function renderTabsList() {
    if (!ui.tabsEls) return;
    const { target, count, list } = ui.tabsEls;
    const ws = store.activeWorkspace();
    const tId = targetCatId();
    target.replaceChildren(...(ws.categories.length
      ? ws.categories.map((c) => h('option', { value: c.id, selected: c.id === tId }, c.name))
      : [h('option', { value: '' }, tr('tabs.noCategories'))]));
    target.disabled = !ws.categories.length;

    const q = ui.tabFilter.trim().toLowerCase();
    const tabs = q ? ui.tabs.filter((t) => `${t.title} ${t.url}`.toLowerCase().includes(q)) : ui.tabs;
    count.textContent = String(ui.tabs.length);

    const saved = new Set(D.allLinks(store.data).map((x) => D.urlKey(x.link.url)));
    const targetName = tId ? D.findCategory(store.data, tId).cat.name : '';
    const byWindow = new Map();
    for (const t of tabs) {
      if (!byWindow.has(t.windowId)) byWindow.set(t.windowId, []);
      byWindow.get(t.windowId).push(t);
    }
    const windowIds = [...byWindow.keys()].sort((a, b) => (a === ui.currentWindowId ? -1 : b === ui.currentWindowId ? 1 : 0));

    const children = [];
    windowIds.forEach((wid, i) => {
      if (windowIds.length > 1) {
        children.push(h('div', { class: 'tabs-group' }, wid === ui.currentWindowId ? tr('tabs.thisWindow') : tr('tabs.window', { n: i + 1 })));
      }
      for (const t of byWindow.get(wid)) children.push(tabItem(t, saved.has(D.urlKey(t.url)), tId, targetName));
    });
    if (!children.length) {
      children.push(h('div', { class: 'tabs-empty' }, q ? tr('tabs.noMatch') : tr('tabs.none')));
    }
    list.replaceChildren(...children);
  }

  function tabItem(tab, isSaved, catId, catName) {
    const fav = favicon(tab.url, tab.favIconUrl);
    return h('div', {
      class: 'tab-item' + (tab.active && tab.windowId === ui.currentWindowId ? ' current' : ''), draggable: 'true', title: `${tab.title}\n${tab.url}`,
      ondragstart: (e) => startDrag(e, { type: 'tab', tab }, tab.url),
      onclick: (e) => {
        if (e.target.closest('button')) return;
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
      },
    },
    fav,
    h('div', { class: 'tab-text' },
      h('div', { class: 'tab-title', dir: 'auto' }, tab.title || tab.url),
      h('div', { class: 'tab-domain' }, D.domainOf(tab.url))),
    h('div', { class: 'tab-actions' },
      h('button', {
        class: 'icon-btn xs save-btn' + (isSaved ? ' saved' : ''),
        title: catId ? (isSaved ? tr('tabs.alreadySaved', { name: catName }) : tr('tabs.saveToCat', { name: catName })) : tr('tabs.createCatFirst'),
        onclick: () => {
          if (!catId) { toast(tr('tabs.createCatFirst'), { type: 'error' }); return; }
          A.saveTab(tab, catId);
        },
      }, icon(isSaved ? 'bookmarkCheck' : 'bookmarkPlus', 15)),
      h('button', { class: 'icon-btn xs', title: tr('tabs.close'), onclick: () => chrome.tabs.remove(tab.id) }, icon('x', 15))));
  }

  async function loadTabs() {
    const [all, me] = await Promise.all([chrome.tabs.query({}), chrome.tabs.getCurrent()]);
    ui.myTabId = me ? me.id : null;
    ui.currentWindowId = me ? me.windowId : (await chrome.windows.getCurrent()).windowId;
    ui.tabs = all.filter((t) => {
      const u = t.url || t.pendingUrl || '';
      return u && u !== 'about:blank' && t.id !== ui.myTabId && !u.startsWith(SELF) && !NEWTAB_RE.test(u);
    }).map((t) => ({ ...t, url: t.url || t.pendingUrl }));
    renderTabsList();
  }

  let tabsTimer = null;
  const scheduleTabs = () => { clearTimeout(tabsTimer); tabsTimer = setTimeout(loadTabs, 120); };

  // ======================================================================
  // Drag & drop (links, tabs, categories, workspaces, external URLs)
  // ======================================================================
  function startDrag(e, payload, url) {
    e.stopPropagation();
    ui.drag = payload;
    e.dataTransfer.effectAllowed = payload.type === 'tab' ? 'copy' : 'copyMove';
    if (url) {
      e.dataTransfer.setData('text/uri-list', url);
      e.dataTransfer.setData('text/plain', url);
    } else {
      e.dataTransfer.setData('text/plain', payload.id || '');
    }
    const el = e.currentTarget;
    requestAnimationFrame(() => el.classList.add('dragging'));
    document.body.classList.add('is-dragging', `drag-${payload.type}`);
  }

  function endDrag() {
    ui.drag = null;
    setIndicator(null);
    document.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
    document.body.classList.remove('is-dragging', 'drag-link', 'drag-tab', 'drag-category', 'drag-workspace');
  }

  function setIndicator(t) {
    const prev = ui.indicator;
    if (prev && t && prev.el === t.el && prev.cls === t.cls) return;
    if (prev) prev.el.classList.remove(prev.cls);
    if (t) t.el.classList.add(t.cls);
    ui.indicator = t;
  }

  function resolveDrop(e) {
    const types = e.dataTransfer ? [...e.dataTransfer.types] : [];
    const drag = ui.drag || (types.includes('text/uri-list') ? { type: 'external' } : null);
    if (!drag) return null;
    const el = e.target instanceof Element ? e.target : e.target.parentElement;
    if (!el) return null;

    if (drag.type === 'link' || drag.type === 'tab' || drag.type === 'external') {
      const linkEl = el.closest('.link');
      if (linkEl) {
        if (drag.type === 'link' && linkEl.dataset.id === drag.id) return null;
        const r = linkEl.getBoundingClientRect();
        const leftHalf = e.clientX < r.left + r.width / 2;
        const before = store.settings.view === 'grid' ? (LS.i18n.isRtl() ? !leftHalf : leftHalf) : e.clientY < r.top + r.height / 2;
        return { drag, kind: 'link', el: linkEl, cls: before ? 'drop-before' : 'drop-after', catId: linkEl.dataset.cat, refId: linkEl.dataset.id, before };
      }
      const cat = el.closest('.cat');
      if (cat) return { drag, kind: 'cat', el: cat, cls: 'drop-into', catId: cat.dataset.id };
      const ws = el.closest('.ws-item');
      if (ws) return { drag, kind: 'ws', el: ws, cls: 'drop-into', wsId: ws.dataset.id };
      return null;
    }
    if (drag.type === 'category') {
      const cat = el.closest('.cat');
      if (cat) {
        if (cat.dataset.id === drag.id) return null;
        const r = cat.getBoundingClientRect();
        const before = e.clientY < r.top + Math.min(r.height / 2, 28);
        return { drag, kind: 'cat-order', el: cat, cls: before ? 'drop-above' : 'drop-below', refId: cat.dataset.id, before };
      }
      const ws = el.closest('.ws-item');
      if (ws && ws.dataset.id !== store.data.activeWorkspaceId) return { drag, kind: 'ws', el: ws, cls: 'drop-into', wsId: ws.dataset.id };
      return null;
    }
    if (drag.type === 'workspace') {
      const ws = el.closest('.ws-item');
      if (!ws || ws.dataset.id === drag.id) return null;
      const r = ws.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      return { drag, kind: 'ws-order', el: ws, cls: before ? 'drop-above' : 'drop-below', refId: ws.dataset.id, before };
    }
    return null;
  }

  function externalLink(e) {
    const raw = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    const url = (raw.split(/\r?\n/).find((l) => l && !l.startsWith('#')) || '').trim();
    if (!/^https?:\/\//i.test(url)) return null;
    return { url, title: D.domainOf(url) };
  }

  function categoryForWorkspace(wsId) {
    const ws = D.getWorkspace(store.data, wsId);
    if (ws.categories[0]) return ws.categories[0].id;
    let id;
    store.update((d) => { id = D.firstCategory(D.getWorkspace(d, wsId)).id; });
    return id;
  }

  function applyDrop(t, e) {
    const { drag } = t;
    const pos = t.before ? { beforeId: t.refId } : { afterId: t.refId };

    if (drag.type === 'link') {
      if (t.kind === 'ws') {
        const catId = categoryForWorkspace(t.wsId);
        store.update((d) => D.moveLink(d, drag.id, catId));
        const f = D.findCategory(store.data, catId);
        toast(tr('toast.movedTo', { place: A.pathOf(f.ws, f.cat) }));
      } else {
        store.update((d) => D.moveLink(d, drag.id, t.catId, t.kind === 'link' ? pos : {}));
      }
      return;
    }

    if (drag.type === 'tab' || drag.type === 'external') {
      const linkLike = drag.type === 'tab' ? { title: drag.tab.title || D.domainOf(drag.tab.url), url: drag.tab.url, icon: drag.tab.favIconUrl } : externalLink(e);
      if (!linkLike) return;
      const catId = t.kind === 'ws' ? categoryForWorkspace(t.wsId) : t.catId;
      let index;
      if (t.kind === 'link') {
        const links = D.findCategory(store.data, catId).cat.links;
        index = links.findIndex((l) => l.id === t.refId) + (t.before ? 0 : 1);
      }
      A.saveUrl(catId, linkLike, { index });
      return;
    }

    if (drag.type === 'category') {
      if (t.kind === 'cat-order') store.update((d) => D.moveCategory(d, drag.id, d.activeWorkspaceId, pos));
      else if (t.kind === 'ws') {
        store.update((d) => D.moveCategory(d, drag.id, t.wsId));
        toast(tr('toast.movedTo', { place: D.getWorkspace(store.data, t.wsId).name }));
      }
      return;
    }

    if (drag.type === 'workspace') store.update((d) => D.moveWorkspace(d, drag.id, pos));
  }

  function initDnd() {
    document.addEventListener('dragover', (e) => {
      const t = resolveDrop(e);
      setIndicator(t);
      if (t) {
        e.preventDefault();
        e.dataTransfer.dropEffect = t.drag.type === 'tab' || t.drag.type === 'external' ? 'copy' : 'move';
      }
    });
    document.addEventListener('dragleave', (e) => {
      if (!e.relatedTarget) setIndicator(null);
    });
    document.addEventListener('drop', (e) => {
      const t = resolveDrop(e);
      if (!t) return;
      e.preventDefault();
      setIndicator(null);
      applyDrop(t, e);
      endDrag();
    });
    document.addEventListener('dragend', endDrag);
  }

  // ======================================================================
  // Backup (page side)
  // ======================================================================
  async function refreshBackupMeta() {
    ui.backupMeta = await LS.backup.getMeta();
    renderSidebar();
    const content = document.getElementById('content');
    if (content) {
      const old = content.querySelector('.banner');
      const fresh = backupBanner();
      if (old && fresh) old.replaceWith(fresh);
      else if (old) old.remove();
      else if (fresh) content.prepend(fresh);
    }
  }

  async function autoBackup() {
    try { await LS.backup.run(store.data, {}); } catch (e) { console.warn('Backup failed', e); }
  }

  // ======================================================================
  // Init
  // ======================================================================
  function initShortcuts() {
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); LS.palette.open(); return; }
      if (isTyping(e) || LS.dom.topModal()) return;
      if (e.key === '/') { e.preventDefault(); LS.palette.open(); }
    });
  }

  async function init() {
    await store.init();
    const s = store.settings;

    // Fallback in case the fast localStorage check in boot.js didn't know the mode yet.
    if (!IS_APP && s.newTabMode === 'chrome' && document.documentElement.style.visibility !== 'hidden') {
      chrome.tabs.getCurrent((t) => t && chrome.tabs.update(t.id, { url: 'chrome://new-tab-page/' }));
      return;
    }

    LS.applyTheme(s.theme);
    LS.i18n.setLang(s.language);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => LS.applyTheme(store.settings.theme));
    await LS.backupUI.init();
    ui.backupMeta = await LS.backup.getMeta();

    buildTabsPanel();
    render();
    initDnd();
    initShortcuts();
    loadTabs();
    for (const ev of ['onCreated', 'onUpdated', 'onRemoved', 'onMoved', 'onAttached', 'onDetached', 'onActivated', 'onReplaced']) {
      chrome.tabs[ev].addListener(scheduleTabs);
    }

    let lang = LS.i18n.getLang();
    store.on((reason) => {
      if (reason === 'backup') { refreshBackupMeta(); return; }
      LS.applyTheme(store.settings.theme);
      if (store.settings.language !== lang) {
        lang = LS.i18n.setLang(store.settings.language);
        buildTabsPanel(); // its labels are only built once
      }
      render();
    });

    autoBackup();
    setInterval(autoBackup, 30 * 60 * 1000);
    setInterval(() => renderSidebar(), 60 * 1000); // keep "backed up x min ago" fresh
    document.addEventListener('visibilitychange', () => { if (!document.hidden) autoBackup(); });
    document.documentElement.classList.add('ready');
  }

  LS.app = { render };
  document.addEventListener('DOMContentLoaded', init);
})(self);
