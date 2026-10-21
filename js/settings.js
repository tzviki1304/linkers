// Settings dialog: language, new tab behaviour, appearance, automatic backup, data, shortcuts.
(function (g) {
  const LS = g.LS;
  const A = LS.actions;
  const store = LS.store;
  const icon = LS.icon;
  const { h, modal, timeAgo } = LS.dom;
  const t = (...a) => LS.i18n.t(...a);

  const SECTIONS = [
    { id: 'general', key: 'settings.general', icon: 'settings' },
    { id: 'backup', key: 'settings.backup', icon: 'shield' },
    { id: 'data', key: 'settings.data', icon: 'drive' },
    { id: 'shortcuts', key: 'settings.shortcuts', icon: 'keyboard' },
    { id: 'about', key: 'settings.about', icon: 'coffee' },
  ];

  let open_ = null;

  // ---------- small controls ----------
  function seg(options, value, onChange) {
    return h('div', { class: 'seg seg-text', role: 'group' }, options.map((o) =>
      h('button', { class: o.value === value ? 'on' : '', 'aria-pressed': String(o.value === value), onclick: () => onChange(o.value) },
        o.icon ? icon(o.icon, 15) : null, o.label)));
  }

  function toggle(checked, onChange, label) {
    return h('label', { class: 'switch' },
      h('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked), 'aria-label': label }),
      h('span', { class: 'switch-track' }, h('span', { class: 'switch-thumb' })));
  }

  function row(title, desc, control) {
    return h('div', { class: 'set-row' },
      h('div', { class: 'set-row-text' }, h('div', { class: 'set-row-title' }, title), desc ? h('div', { class: 'set-row-desc' }, desc) : null),
      h('div', { class: 'set-row-control' }, control));
  }

  function choiceCard({ selected, title, desc, ico, onSelect, extra, badge }) {
    return h('div', {
      class: 'choice' + (selected ? ' selected' : ''), role: 'radio', tabindex: '0', 'aria-checked': String(selected),
      onclick: (e) => { if (!e.target.closest('button, input, select')) onSelect(); },
      onkeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onSelect(); } },
    },
    h('span', { class: 'choice-radio' }),
    h('div', { class: 'choice-body' },
      h('div', { class: 'choice-title' }, ico ? icon(ico, 16) : null, title, badge ? h('span', { class: 'badge' }, badge) : null),
      h('div', { class: 'choice-desc' }, desc),
      extra || null));
  }

  function languageSelect() {
    return h('select', {
      class: 'input sm lang-select', 'aria-label': t('settings.language'),
      onchange: (e) => A.setSetting('language', e.target.value),
    }, LS.i18n.LANGUAGES.map((l) => h('option', { value: l.code, selected: l.code === store.settings.language }, l.name)));
  }

  // ---------- sections ----------
  function general() {
    const s = store.settings;
    return [
      row(t('settings.language'), t('settings.languageDesc'), languageSelect()),
      h('h3', { class: 'set-h' }, t('settings.newTab.title')),
      h('p', { class: 'set-p' }, t('settings.newTab.text')),
      h('div', { class: 'choices', role: 'radiogroup' },
        choiceCard({
          selected: s.newTabMode === 'dashboard', ico: 'tab', badge: t('common.recommended'),
          title: t('newtab.dashboard.title'),
          desc: t('settings.newTab.dashboardDesc'),
          onSelect: () => A.setSetting('newTabMode', 'dashboard'),
        }),
        choiceCard({
          selected: s.newTabMode === 'chrome', ico: 'external',
          title: t('newtab.chrome.title'),
          desc: t('settings.newTab.chromeDesc'),
          onSelect: () => A.setSetting('newTabMode', 'chrome'),
        })),
      h('h3', { class: 'set-h' }, t('settings.appearance')),
      row(t('settings.theme'), null, seg([
        { value: 'system', label: t('theme.system'), icon: 'monitor' },
        { value: 'light', label: t('theme.light'), icon: 'sun' },
        { value: 'dark', label: t('theme.dark'), icon: 'moon' },
      ], s.theme, (v) => A.setSetting('theme', v))),
      row(t('settings.layout'), null, seg([
        { value: 'grid', label: t('view.gridShort'), icon: 'grid' },
        { value: 'list', label: t('view.listShort'), icon: 'list' },
      ], s.view, (v) => A.setSetting('view', v))),
      row(t('settings.openLinksIn'), t('settings.openLinksInDesc'), seg([
        { value: 'same', label: t('settings.sameTab') },
        { value: 'new', label: t('settings.newTabOpt') },
      ], s.openLinksIn, (v) => A.setSetting('openLinksIn', v))),
      row(t('settings.googleIcons'), t('settings.googleIconsDesc'),
        toggle(s.googleIcons, (v) => A.setSetting('googleIcons', v), t('settings.googleIcons'))),
      row(t('settings.tabsPanel'), t('settings.tabsPanelDesc'),
        toggle(s.showTabsPanel, (v) => A.setSetting('showTabsPanel', v), t('settings.tabsPanel'))),
    ];
  }

  function backup(state) {
    const b = store.settings.backup;
    const m = state.meta || {};
    const perm = state.folderPerm;

    const permChip = b.destination === 'folder' && LS.backupUI.folderHandle
      ? (perm === 'granted'
        ? h('span', { class: 'chip ok' }, icon('check', 12), t('backup.accessAllowed'))
        : h('button', { class: 'chip warn', onclick: async () => { await LS.backupUI.allowAndRun(); refresh(); } }, icon('alert', 12), t('backup.needsOk')))
      : null;

    const folderExtra = h('div', { class: 'choice-extra' },
      h('div', { class: 'path' }, icon('folder', 15), h('span', { dir: 'auto' }, b.folderName || t('backup.noFolderYet')), permChip),
      h('button', { class: 'btn btn-secondary sm', onclick: async () => { await LS.backupUI.chooseFolder(); refresh(); } },
        b.folderName ? t('backup.changeFolder') : t('backup.chooseFolder')));

    const subInput = h('input', {
      class: 'input sm', value: b.subfolder, placeholder: 'LinkSaver Backups', dir: 'auto', 'aria-label': t('backup.subfolderLabel'),
      onchange: (e) => A.setBackupSetting('subfolder', LS.backup.sanitizeFolder(e.target.value) || 'LinkSaver Backups'),
    });
    const downloadsExtra = h('div', { class: 'choice-extra' },
      h('div', { class: 'path' }, icon('download', 15), h('span', null, t('backup.downloadsPrefix')), subInput));

    let status;
    if (!b.destination) {
      status = h('div', { class: 'status-box warn' }, icon('alert', 16),
        h('div', null, h('strong', null, t('backup.notSetUp')), ' ', t('backup.notSetUpHint')));
    } else {
      const where = m.lastDestination === 'folder' ? t('backup.whereFolder', { name: b.folderName })
        : m.lastDestination ? `Downloads/${b.subfolder}` : '';
      status = h('div', { class: `status-box ${m.pending ? 'warn' : 'ok'}` },
        icon(m.pending ? 'alert' : 'shield', 16),
        h('div', null,
          h('div', null, h('strong', null, t('backup.last')), ' ',
            m.lastBackupAt ? `${timeAgo(m.lastBackupAt)}${where ? ` · ${where}` : ''}` : t('backup.notYet')),
          m.lastFile ? h('div', { class: 'muted small', dir: 'ltr' }, m.lastFile) : null,
          m.lastError ? h('div', { class: 'small status-err' }, LS.i18n.err(m.lastError)) : null));
    }

    return [
      h('h3', { class: 'set-h' }, t('backup.title')),
      h('p', { class: 'set-p' }, t('backup.intro')),
      row(t('backup.daily'), b.destination ? null : t('backup.chooseLocation'),
        toggle(b.enabled, (v) => A.setBackupSetting('enabled', v), t('backup.daily'))),
      h('div', { class: 'choices', role: 'radiogroup' },
        choiceCard({
          selected: b.destination === 'folder', ico: 'folder', badge: t('common.recommended'),
          title: t('backup.folderOption'),
          desc: t('backup.folderOptionDesc'),
          onSelect: async () => {
            if (LS.backupUI.folderHandle) { A.setBackupSetting('destination', 'folder'); refresh(); } else { await LS.backupUI.chooseFolder(); refresh(); }
          },
          extra: folderExtra,
        }),
        choiceCard({
          selected: b.destination === 'downloads', ico: 'download',
          title: t('backup.downloadsOption'),
          desc: t('backup.downloadsOptionDesc'),
          onSelect: async () => { await LS.backupUI.chooseDownloads(); refresh(); },
          extra: downloadsExtra,
        })),
      row(t('backup.keep'), t('backup.keepDesc'),
        h('div', { class: 'num-field' },
          h('input', {
            class: 'input sm num', type: 'number', min: '0', max: '365', value: String(b.keep), 'aria-label': t('backup.keep'),
            onchange: (e) => A.setBackupSetting('keep', Math.max(0, Math.min(365, parseInt(e.target.value, 10) || 0))),
          }), h('span', { class: 'muted' }, t('backup.keepUnit')))),
      b.destination === 'folder' ? row(t('backup.fallback'), t('backup.fallbackDesc'),
        toggle(b.fallbackToDownloads, async (v) => {
          if (v) {
            // Request straight away so Chrome still sees the click (no prompt if already granted).
            const ok = await chrome.permissions.request({ permissions: ['downloads'] }).catch(() => false);
            if (!ok) { refresh(); return; }
          }
          A.setBackupSetting('fallbackToDownloads', v);
        }, t('backup.fallback'))) : null,
      status,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-primary', disabled: !b.destination, onclick: async () => { await LS.backupUI.runNow(); refresh(); } }, icon('shield', 16), t('backup.now')),
        h('button', {
          class: 'btn btn-secondary',
          onclick: () => (b.destination === 'folder' && LS.backupUI.folderHandle ? LS.backupUI.restoreFromFolder() : A.importFromFile()),
        }, icon('clock', 16), t('backup.restoreFrom'))),
    ];
  }

  function data() {
    const st = LS.data.stats(store.data);
    const stat = (n, l) => h('div', { class: 'stat' }, h('div', { class: 'stat-num' }, String(n)), h('div', { class: 'stat-label' }, l));
    return [
      h('h3', { class: 'set-h' }, t('data.title')),
      h('div', { class: 'stat-row' }, stat(st.workspaces, t('stat.workspaces')), stat(st.categories, t('stat.categories')), stat(st.links, t('stat.links'))),
      h('p', { class: 'set-p' }, t('data.intro')),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-secondary', onclick: A.exportData }, icon('download', 16), t('data.exportJson')),
        h('button', { class: 'btn btn-secondary', onclick: A.importFromFile }, icon('upload', 16), t('data.importJson'))),
    ];
  }

  function shortcuts(state) {
    const cmds = state.commands || [];
    const key = (name, fallback) => {
      const c = cmds.find((x) => x.name === name);
      return c ? (c.shortcut || t('shortcuts.notSet')) : fallback;
    };
    const k = (text) => h('kbd', null, text);
    const item = (keys, text) => h('div', { class: 'sc-row' }, h('span', { class: 'sc-keys' }, keys), h('span', null, text));
    return [
      h('h3', { class: 'set-h' }, t('shortcuts.title')),
      h('div', { class: 'sc-list' },
        item(k(key('_execute_action', 'Alt+Shift+L')), t('shortcuts.open')),
        item(k(key('quick-save', 'Alt+Shift+S')), t('shortcuts.quickSave')),
        item([k('Ctrl'), k('K')], t('shortcuts.search')),
        item(k(t('shortcuts.rightClickKey')), t('shortcuts.rightClick')),
        item(k(t('shortcuts.dragKey')), t('shortcuts.drag')),
        item(k(t('shortcuts.dblKey')), t('shortcuts.rename'))),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-secondary', onclick: () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }) }, icon('keyboard', 16), t('shortcuts.change'))),
    ];
  }

  function about() {
    return [
      h('h3', { class: 'set-h' }, 'Link Saver'),
      h('p', { class: 'set-p' }, t('about.version', { version: chrome.runtime.getManifest().version })),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-secondary', onclick: () => chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') }) }, t('about.welcome')),
        h('a', { class: 'btn btn-secondary', href: 'https://buymeacoffee.com/tzviki', target: '_blank', rel: 'noopener' }, icon('coffee', 16), t('about.coffee'))),
    ];
  }

  const RENDER = { general, backup, data, shortcuts, about };

  // ---------- dialog ----------
  let refresh = () => {};

  async function open(section = 'general') {
    if (open_) { open_.show(section); return; }
    const state = { section, meta: null, folderPerm: null, commands: [] };
    const nav = h('nav', { class: 'set-nav' });
    const panel = h('div', { class: 'set-panel' });
    const body = h('div', { class: 'settings' }, nav, panel);

    const draw = () => {
      const title = m && m.el.querySelector('.modal-title');
      if (title) title.textContent = t('settings.title'); // follows a language change
      nav.replaceChildren(...SECTIONS.map((s) => h('button', {
        class: 'set-nav-item' + (s.id === state.section ? ' on' : ''),
        onclick: () => { state.section = s.id; draw(); panel.scrollTop = 0; },
      }, icon(s.icon, 16), t(s.key))));
      const scroll = panel.scrollTop;
      panel.replaceChildren(...RENDER[state.section](state).flat().filter(Boolean));
      panel.scrollTop = scroll;
    };

    refresh = async () => {
      state.meta = await LS.backup.getMeta();
      state.folderPerm = await LS.backupUI.folderStatus();
      if (open_) draw();
    };

    const unsub = store.on(() => { if (open_) refresh(); });
    const m = modal({ title: t('settings.title'), size: 'lg', body, className: 'settings-modal', onClose: () => { open_ = null; unsub(); } });
    open_ = { modal: m, show: (s) => { state.section = s; draw(); } };
    chrome.commands.getAll().then((c) => { state.commands = c; if (open_) draw(); }).catch(() => {});
    draw();
    refresh();
  }

  LS.settings = { open };
})(self);
