// Backup actions that need a user click (folder picker, permission prompts).
// Shared by the dashboard settings and the welcome page.
(function (g) {
  const LS = g.LS;
  const store = LS.store;
  const { toast, modal, h } = LS.dom;
  const t = (...a) => LS.i18n.t(...a);

  let folderHandle = null;

  async function init() {
    folderHandle = await LS.backup.getFolderHandle();
  }

  async function folderStatus() {
    if (!folderHandle) return 'missing';
    try { return await LS.backup.folderPermission(folderHandle, false); } catch { return 'error'; }
  }

  function report(r) {
    if (r.status === 'ok') {
      toast(r.fallback ? t('backup.toast.fallback') : t('backup.toast.saved', { name: r.name }));
    } else if (r.status === 'busy') {
      toast(t('backup.toast.busy'), { type: 'info' });
    } else {
      toast(LS.i18n.err(r.error) || t('backup.toast.failed'), { type: 'error' });
    }
    return r;
  }

  async function runNow() {
    return report(await LS.backup.run(store.data, { force: true, interactive: true }));
  }

  // Must be called from a click: opens the folder picker.
  async function chooseFolder() {
    if (typeof self.showDirectoryPicker !== 'function') {
      toast(t('backup.noPicker'), { type: 'error' });
      return false;
    }
    let handle;
    try {
      handle = await self.showDirectoryPicker({ id: 'linksaver-backups', mode: 'readwrite', startIn: 'documents' });
    } catch (e) {
      if (e && e.name !== 'AbortError') toast(e.message, { type: 'error' });
      return false;
    }
    await LS.backup.setFolderHandle(handle);
    folderHandle = handle;
    store.update((d) => {
      Object.assign(d.settings.backup, { destination: 'folder', folderName: handle.name, enabled: true });
    });
    await runNow();
    return true;
  }

  // Must be called from a click: asks Chrome for the optional "downloads" permission.
  async function chooseDownloads() {
    let granted = false;
    try { granted = await chrome.permissions.request({ permissions: ['downloads'] }); } catch { granted = false; }
    if (!granted) {
      toast(t('backup.downloadsDenied'), { type: 'error' });
      return false;
    }
    store.update((d) => { Object.assign(d.settings.backup, { destination: 'downloads', enabled: true }); });
    await runNow();
    return true;
  }

  // Banner button: re-allow folder access (Chrome asks again after a restart) and back up.
  async function allowAndRun() {
    if (!folderHandle) { LS.settings.open('backup'); return; }
    let p = 'denied';
    try { p = await folderHandle.requestPermission({ mode: 'readwrite' }); } catch { /* ignore */ }
    if (p !== 'granted') { toast(t('backup.folderDenied'), { type: 'error' }); return; }
    await runNow();
  }

  async function restoreFromFolder() {
    if (!folderHandle) { toast(t('backup.err.noFolder'), { type: 'error' }); return; }
    let p = 'denied';
    try { p = await LS.backup.folderPermission(folderHandle, true); } catch { /* ignore */ }
    if (p !== 'granted') { toast(t('backup.folderDenied'), { type: 'error' }); return; }
    let names = [];
    try { names = await LS.backup.listFolderBackups(folderHandle); } catch (e) { toast(e.message, { type: 'error' }); return; }
    if (!names.length) { toast(t('backup.noBackups'), { type: 'info' }); return; }

    const label = (n) => {
      const m = n.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/);
      if (!m) return n;
      const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
      return d.toLocaleString(LS.i18n.locale(), { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    const m = modal({
      title: t('backup.restoreTitle'),
      subtitle: t('backup.restoreSubtitle', { count: names.length, folder: folderHandle.name }),
      size: 'sm',
      body: h('div', { class: 'backup-list' }, names.map((n) =>
        h('div', { class: 'backup-row' },
          LS.icon('clock', 16),
          h('div', { class: 'backup-row-text' }, h('div', null, label(n)), h('div', { class: 'muted small' }, n)),
          h('button', {
            class: 'btn btn-secondary sm',
            onclick: async () => {
              const text = await LS.backup.readFolderBackup(folderHandle, n);
              m.close();
              LS.actions.importText(text, n);
            },
          }, t('backup.restore'))))),
    });
  }

  LS.backupUI = {
    init, folderStatus, runNow, chooseFolder, chooseDownloads, allowAndRun, restoreFromFolder,
    get folderHandle() { return folderHandle; },
  };
})(self);
