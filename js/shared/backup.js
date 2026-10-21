// Automatic daily backup. Runs from the service worker (hourly alarm) and from
// the dashboard page. Two destinations:
//   folder    - any folder the user picks (File System Access API). Chrome may need
//               the user to re-allow access; the dashboard then shows a one-click banner.
//   downloads - a subfolder inside the Downloads folder (chrome.downloads, optional permission).
(function (g) {
  const META_KEY = 'linkSaverBackupMeta';
  const HANDLE_KEY = 'backupDir';
  const DAY = 24 * 60 * 60 * 1000;
  const PREFIX = 'linksaver-backup-';

  const defaultMeta = () => ({
    lastBackupAt: 0, lastFile: '', lastDestination: '', lastError: '',
    pending: false, lockUntil: 0, downloadIds: [],
  });

  async function getMeta() {
    const r = await chrome.storage.local.get(META_KEY);
    return Object.assign(defaultMeta(), r[META_KEY] || {});
  }

  async function setMeta(patch) {
    const next = Object.assign(await getMeta(), patch);
    await chrome.storage.local.set({ [META_KEY]: next });
    return next;
  }

  function isDue(settings, meta, now = Date.now()) {
    const b = settings.backup;
    return !!(b.enabled && b.destination && now - (meta.lastBackupAt || 0) >= DAY);
  }

  const pad = (n) => String(n).padStart(2, '0');
  function fileName(d = new Date()) {
    return `${PREFIX}${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  }

  function serialize(data) {
    const { rev, ...clean } = data;
    return JSON.stringify({ app: 'LinkSaver', schema: 2, exportedAt: new Date().toISOString(), data: clean }, null, 2);
  }

  function sanitizeFolder(path) {
    return String(path || '')
      .replace(/\\/g, '/')
      .split('/')
      .map((p) => p.replace(/[<>:"|?*\x00-\x1f]/g, '').trim())
      .filter((p) => p && p !== '.' && p !== '..')
      .join('/');
  }

  // ---------- folder destination ----------
  async function getFolderHandle() {
    try { return (await LS.idb.get(HANDLE_KEY)) || null; } catch { return null; }
  }

  async function setFolderHandle(handle) {
    await LS.idb.set(HANDLE_KEY, handle);
  }

  async function folderPermission(handle, request = false) {
    if (!handle || typeof handle.queryPermission !== 'function') return 'unsupported';
    const opts = { mode: 'readwrite' };
    let p = await handle.queryPermission(opts);
    if (p !== 'granted' && request && typeof handle.requestPermission === 'function') {
      p = await handle.requestPermission(opts);
    }
    return p;
  }

  async function listFolderBackups(handle) {
    const names = [];
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'file' && name.startsWith(PREFIX) && name.endsWith('.json')) names.push(name);
    }
    return names.sort().reverse();
  }

  async function readFolderBackup(handle, name) {
    const fh = await handle.getFileHandle(name);
    return (await fh.getFile()).text();
  }

  async function writeToFolder(handle, name, text, keep) {
    const fh = await handle.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
    if (keep > 0) {
      const names = await listFolderBackups(handle);
      for (const old of names.slice(keep)) {
        try { await handle.removeEntry(old); } catch { /* ignore */ }
      }
    }
  }

  // ---------- downloads destination ----------
  async function hasDownloadsPermission() {
    try { return await chrome.permissions.contains({ permissions: ['downloads'] }); } catch { return false; }
  }

  async function writeToDownloads(subfolder, name, text, keep, meta) {
    const folder = sanitizeFolder(subfolder);
    const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
    const id = await chrome.downloads.download({
      url, filename: folder ? `${folder}/${name}` : name, conflictAction: 'uniquify', saveAs: false,
    });
    const ids = (meta.downloadIds || []).concat(id);
    if (keep > 0 && ids.length > keep) {
      for (const oldId of ids.splice(0, ids.length - keep)) {
        try { await chrome.downloads.removeFile(oldId); } catch { /* already gone */ }
        try { await chrome.downloads.erase({ id: oldId }); } catch { /* ignore */ }
      }
    }
    return ids;
  }

  // ---------- main entry ----------
  // opts.force       - run even if a backup was made in the last 24h ("Back up now")
  // opts.interactive - may show Chrome's folder permission prompt (needs a user click)
  async function run(data, opts = {}) {
    const { force = false, interactive = false } = opts;
    const b = data.settings.backup;
    if (!b.destination) return { status: 'not-configured' };
    if (!force && !b.enabled) return { status: 'disabled' };

    const meta = await getMeta();
    const now = Date.now();
    if (!force && !isDue(data.settings, meta, now)) return { status: 'not-due' };
    if (meta.lockUntil > now) return { status: 'busy' };
    await setMeta({ lockUntil: now + 30000 });

    const name = fileName();
    const text = serialize(data);
    try {
      if (b.destination === 'folder') {
        const handle = await getFolderHandle();
        let perm = 'missing';
        if (handle) {
          try { perm = await folderPermission(handle, interactive); } catch { perm = 'error'; }
        }
        if (perm === 'granted') {
          await writeToFolder(handle, name, text, b.keep);
          await setMeta({ lastBackupAt: now, lastFile: name, lastDestination: 'folder', lastError: '', pending: false });
          return { status: 'ok', destination: 'folder', name };
        }
        // Folder not reachable. If we've gone 2+ days without a backup, fall back to Downloads.
        const overdue = now - (meta.lastBackupAt || 0) >= 2 * DAY;
        if (!force && b.fallbackToDownloads && overdue && (await hasDownloadsPermission())) {
          const ids = await writeToDownloads(b.subfolder, name, text, b.keep, meta);
          await setMeta({
            lastBackupAt: now, lastFile: name, lastDestination: 'downloads-fallback',
            lastError: 'backup.err.fallback', pending: true, downloadIds: ids,
          });
          return { status: 'ok', destination: 'downloads', fallback: true, name };
        }
        const msg = perm === 'missing' ? 'backup.err.noFolder' : 'backup.err.folderPermission';
        await setMeta({ pending: true, lastError: msg });
        return { status: 'needs-permission', perm, error: msg };
      }

      if (!(await hasDownloadsPermission())) {
        await setMeta({ pending: true, lastError: 'backup.err.downloadsPermission' });
        return { status: 'needs-permission', error: 'backup.err.downloadsPermission' };
      }
      const ids = await writeToDownloads(b.subfolder, name, text, b.keep, meta);
      await setMeta({ lastBackupAt: now, lastFile: name, lastDestination: 'downloads', lastError: '', pending: false, downloadIds: ids });
      return { status: 'ok', destination: 'downloads', name };
    } catch (e) {
      const msg = (e && e.message) || String(e);
      await setMeta({ lastError: msg, pending: true });
      return { status: 'error', error: msg };
    } finally {
      await setMeta({ lockUntil: 0 });
    }
  }

  g.LS = g.LS || {};
  g.LS.backup = {
    META_KEY, DAY, PREFIX,
    getMeta, setMeta, isDue, fileName, serialize, sanitizeFolder,
    getFolderHandle, setFolderHandle, folderPermission, listFolderBackups, readFolderBackup,
    hasDownloadsPermission, run,
  };
})(self);
