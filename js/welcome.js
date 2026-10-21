// Welcome / onboarding page shown after install (and after updating from 1.x).
(function (g) {
  const LS = g.LS;
  const store = LS.store;
  const icon = LS.icon;
  const { h, timeAgo } = LS.dom;
  const t = (...a) => LS.i18n.t(...a);
  const isUpdate = new URLSearchParams(location.search).has('updated');

  function card({ selected, ico, title, desc, badge, onSelect }) {
    return h('div', {
      class: 'choice' + (selected ? ' selected' : ''), role: 'radio', tabindex: '0', 'aria-checked': String(selected),
      onclick: onSelect,
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } },
    },
    h('span', { class: 'choice-radio' }),
    h('div', { class: 'choice-body' },
      h('div', { class: 'choice-title' }, icon(ico, 16), h('span', { dir: 'auto' }, title), badge ? h('span', { class: 'badge' }, badge) : null),
      h('div', { class: 'choice-desc' }, desc)));
  }

  function renderStatic() {
    LS.i18n.applyStatic();
    document.title = t('welcome.pageTitle');
    document.getElementById('wlTitle').textContent = t(isUpdate ? 'welcome.titleUpdated' : 'welcome.title');
    const sel = document.getElementById('wlLang');
    sel.replaceChildren(...LS.i18n.LANGUAGES.map((l) => h('option', { value: l.code, selected: l.code === store.settings.language }, l.name)));
  }

  function renderModes() {
    const mode = store.settings.newTabMode;
    const set = (v) => store.update((d) => { d.settings.newTabMode = v; });
    document.getElementById('wlModes').replaceChildren(
      card({
        selected: mode === 'dashboard', ico: 'tab', badge: t('common.recommended'),
        title: t('newtab.dashboard.title'),
        desc: t('welcome.dashboardDesc'),
        onSelect: () => set('dashboard'),
      }),
      card({
        selected: mode === 'chrome', ico: 'external',
        title: t('newtab.chrome.title'),
        desc: t('welcome.chromeDesc'),
        onSelect: () => set('chrome'),
      }));
  }

  async function renderBackup() {
    const b = store.settings.backup;
    document.getElementById('wlBackup').replaceChildren(
      card({
        selected: b.destination === 'folder', ico: 'folder', badge: t('common.recommended'),
        title: b.destination === 'folder' && b.folderName ? t('welcome.folderChosen', { name: b.folderName }) : t('welcome.chooseFolder'),
        desc: t('welcome.folderDesc'),
        onSelect: async () => { await LS.backupUI.chooseFolder(); renderBackup(); },
      }),
      card({
        selected: b.destination === 'downloads', ico: 'download',
        title: t('welcome.useDownloads'),
        desc: t('welcome.downloadsDesc', { folder: b.subfolder }),
        onSelect: async () => { await LS.backupUI.chooseDownloads(); renderBackup(); },
      }));

    const meta = await LS.backup.getMeta();
    const status = document.getElementById('wlBackupStatus');
    if (!b.destination) {
      status.className = 'wl-backup-status';
      status.replaceChildren(h('span', { class: 'muted' }, t('welcome.setupLater')));
    } else if (meta.lastBackupAt && !meta.pending) {
      status.className = 'wl-backup-status ok';
      status.replaceChildren(icon('check', 16), h('span', null, t('welcome.firstBackup', { time: timeAgo(meta.lastBackupAt) })));
    } else {
      status.className = 'wl-backup-status warn';
      status.replaceChildren(icon('alert', 16), h('span', null, LS.i18n.err(meta.lastError) || t('welcome.backupSetUp')));
    }
  }

  function renderAll() {
    LS.applyTheme(store.settings.theme);
    LS.i18n.setLang(store.settings.language);
    renderStatic();
    renderModes();
    renderBackup();
  }

  async function init() {
    await store.init();
    await LS.backupUI.init();

    if (isUpdate) document.getElementById('wlWhatsNew').hidden = false;
    document.querySelectorAll('[data-icon]').forEach((el) => el.appendChild(icon(el.dataset.icon, 18)));
    document.getElementById('wlLang').addEventListener('change', (e) => {
      store.update((d) => { d.settings.language = e.target.value; });
    });

    renderAll();
    store.on(renderAll);

    document.getElementById('wlDone').addEventListener('click', async () => {
      store.update((d) => { d.settings.onboarded = true; });
      await store.persist();
      location.href = chrome.runtime.getURL('newtab.html?app=1');
    });
    document.documentElement.classList.add('ready');
  }

  document.addEventListener('DOMContentLoaded', init);
})(self);
