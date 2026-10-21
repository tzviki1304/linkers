// Data model, migration from v1 and pure helpers shared by every page and the
// service worker. Nothing here touches the DOM.
(function (g) {
  const STORAGE_KEY = 'linkSaver';        // v2 data (object)
  const LEGACY_KEY = 'linkSaverData';     // v1 data (JSON string), left untouched as a safety copy
  const SCHEMA = 2;

  const COLORS = {
    indigo: '#6366f1', blue: '#3b82f6', teal: '#14b8a6', green: '#22c55e',
    amber: '#f59e0b', orange: '#f97316', rose: '#f43f5e', violet: '#a855f7', slate: '#64748b',
  };
  const COLOR_NAMES = Object.keys(COLORS);

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const str = (v) => (typeof v === 'string' ? v : '');
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

  function defaultSettings() {
    return {
      language: 'en',             // en | he | fr | es | zh
      theme: 'system',            // system | light | dark
      view: 'grid',               // grid | list
      newTabMode: 'dashboard',    // dashboard | chrome
      openLinksIn: 'same',        // same | new
      googleIcons: true,          // fetch missing site icons from Google's favicon service
      showTabsPanel: true,
      onboarded: false,
      backupPromptDismissed: false,
      backup: {
        enabled: true,
        destination: '',          // '' (not set up) | folder | downloads
        folderName: '',
        subfolder: 'LinkSaver Backups',
        keep: 14,
        fallbackToDownloads: true,
      },
    };
  }

  function mergeShallow(defaults, raw) {
    const out = { ...defaults };
    if (!raw || typeof raw !== 'object') return out;
    for (const k of Object.keys(defaults)) {
      if (k in raw && typeof raw[k] === typeof defaults[k] && typeof defaults[k] !== 'object') out[k] = raw[k];
    }
    return out;
  }

  function normalizeSettings(raw) {
    const d = defaultSettings();
    const s = mergeShallow(d, raw);
    s.backup = mergeShallow(d.backup, raw && raw.backup);
    if (!['en', 'he', 'fr', 'es', 'zh'].includes(s.language)) s.language = 'en';
    if (!['system', 'light', 'dark'].includes(s.theme)) s.theme = 'system';
    if (!['grid', 'list'].includes(s.view)) s.view = 'grid';
    if (!['dashboard', 'chrome'].includes(s.newTabMode)) s.newTabMode = 'dashboard';
    if (!['same', 'new'].includes(s.openLinksIn)) s.openLinksIn = 'same';
    if (!['', 'folder', 'downloads'].includes(s.backup.destination)) s.backup.destination = '';
    s.backup.keep = Math.max(0, Math.min(365, Math.round(s.backup.keep) || 0));
    return s;
  }

  // A site icon we can show: a web or data: image URL (v1 called this field "image").
  function cleanIcon(v) {
    const s = str(v).trim();
    if (s.length > 100000) return '';
    return /^(https?:\/\/|data:image\/)/i.test(s) ? s : '';
  }

  function normalizeLink(l) {
    if (!l || typeof l !== 'object') return null;
    const url = str(l.url).trim();
    if (!url) return null;
    return {
      id: str(l.id) || uid(),
      title: str(l.title).trim() || url,
      url,
      icon: cleanIcon(l.icon) || cleanIcon(l.image),
      note: str(l.note),
      tags: Array.isArray(l.tags) ? l.tags.map((t) => String(t).trim()).filter(Boolean) : [],
      pinned: !!l.pinned,
      createdAt: num(l.createdAt) || Date.now(),
    };
  }

  function normalizeCategory(c) {
    if (!c || typeof c !== 'object') return null;
    return {
      id: str(c.id) || uid(),
      name: str(c.name).trim() || 'Untitled',
      collapsed: !!c.collapsed,
      links: (Array.isArray(c.links) ? c.links : []).map(normalizeLink).filter(Boolean),
    };
  }

  function normalizeWorkspace(w, i) {
    if (!w || typeof w !== 'object') return null;
    return {
      id: str(w.id) || uid(),
      name: str(w.name).trim() || 'Workspace',
      color: COLORS[w.color] ? w.color : COLOR_NAMES[i % COLOR_NAMES.length],
      icon: str(w.icon).slice(0, 4),
      categories: (Array.isArray(w.categories) ? w.categories : []).map(normalizeCategory).filter(Boolean),
    };
  }

  // Accepts v2 data, a v2 backup file, or v1 data (object or JSON string).
  function normalizeData(raw) {
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch { raw = null; }
    }
    if (raw && raw.app === 'LinkSaver' && raw.data) raw = raw.data;
    const data = { schema: SCHEMA, workspaces: [], activeWorkspaceId: null, settings: defaultSettings(), rev: 0 };
    if (!raw || typeof raw !== 'object') return ensureWorkspace(data);

    data.workspaces = (Array.isArray(raw.workspaces) ? raw.workspaces : []).map(normalizeWorkspace).filter(Boolean);
    data.settings = normalizeSettings(raw.settings);
    // v1 kept the theme at the top level
    if (!raw.settings && (raw.theme === 'light' || raw.theme === 'dark')) data.settings.theme = raw.theme;

    if (typeof raw.activeWorkspaceId === 'string' && data.workspaces.some((w) => w.id === raw.activeWorkspaceId)) {
      data.activeWorkspaceId = raw.activeWorkspaceId;
    } else if (Number.isInteger(raw.activeWorkspace) && data.workspaces[raw.activeWorkspace]) {
      data.activeWorkspaceId = data.workspaces[raw.activeWorkspace].id;
    }
    data.rev = num(raw.rev);
    if (raw.iconsRecovered) data.iconsRecovered = true;
    return ensureWorkspace(data);
  }

  function ensureWorkspace(data) {
    if (!data.workspaces.length) {
      data.workspaces.push({
        id: uid(), name: 'My Links', color: 'indigo', icon: '',
        categories: [{ id: uid(), name: 'General', collapsed: false, links: [] }],
      });
    }
    if (!data.workspaces.some((w) => w.id === data.activeWorkspaceId)) data.activeWorkspaceId = data.workspaces[0].id;
    return data;
  }

  // ---------- storage ----------
  async function load() {
    const res = await chrome.storage.local.get([STORAGE_KEY, LEGACY_KEY]);
    if (!res[STORAGE_KEY]) return { data: normalizeData(res[LEGACY_KEY] || null), migrated: true };
    const data = normalizeData(res[STORAGE_KEY]);
    // 2.0.0 dropped the site icons saved by 1.x; copy them back once from the untouched v1 data.
    if (!res[STORAGE_KEY].iconsRecovered) {
      data.iconsRecovered = true;
      if (res[LEGACY_KEY]) {
        const icons = new Map();
        for (const x of allLinks(normalizeData(res[LEGACY_KEY]))) if (x.link.icon) icons.set(urlKey(x.link.url), x.link.icon);
        for (const x of allLinks(data)) if (!x.link.icon) x.link.icon = icons.get(urlKey(x.link.url)) || '';
      }
      return { data, migrated: true };
    }
    data.iconsRecovered = true;
    return { data, migrated: false };
  }

  async function save(data) {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  }

  // ---------- queries ----------
  const getWorkspace = (data, id) => data.workspaces.find((w) => w.id === id) || null;
  const activeWorkspace = (data) => getWorkspace(data, data.activeWorkspaceId) || data.workspaces[0];

  function findCategory(data, catId) {
    for (const ws of data.workspaces) {
      const index = ws.categories.findIndex((c) => c.id === catId);
      if (index !== -1) return { ws, cat: ws.categories[index], index };
    }
    return null;
  }

  function findLink(data, linkId) {
    for (const ws of data.workspaces) {
      for (const cat of ws.categories) {
        const index = cat.links.findIndex((l) => l.id === linkId);
        if (index !== -1) return { ws, cat, link: cat.links[index], index };
      }
    }
    return null;
  }

  function allLinks(data) {
    const out = [];
    for (const ws of data.workspaces) for (const cat of ws.categories) for (const link of cat.links) out.push({ ws, cat, link });
    return out;
  }

  const countLinks = (ws) => ws.categories.reduce((n, c) => n + c.links.length, 0);

  // Compare URLs loosely: ignore the hash, trailing slash and "www."
  function urlKey(url) {
    try {
      const u = new URL(url);
      u.hash = '';
      const host = u.hostname.replace(/^www\./, '').toLowerCase();
      const path = u.pathname.replace(/\/+$/, '');
      return `${u.protocol}//${host}${u.port ? ':' + u.port : ''}${path}${u.search}`;
    } catch {
      return String(url).trim().toLowerCase();
    }
  }

  function findByUrl(data, url) {
    const key = urlKey(url);
    return allLinks(data).filter((x) => urlKey(x.link.url) === key);
  }

  function domainOf(url) {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '') || u.protocol.replace(':', '');
    } catch {
      return url;
    }
  }

  function normalizeUrlInput(input) {
    const v = String(input || '').trim();
    if (!v) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
    return 'https://' + v;
  }

  function faviconUrl(url, size = 32) {
    return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`);
  }

  // ---------- mutations (operate on a data object in place) ----------
  function createLink({ title, url, note, tags, pinned, icon }) {
    return normalizeLink({ title, url, note, tags, pinned, icon, createdAt: Date.now() });
  }

  // Icon sources to try in order: the icon saved with the link (taken from the
  // browser tab), Google's favicon service, then Chrome's own favicon cache.
  function iconSources(url, savedIcon, useGoogle = true) {
    const out = [];
    if (cleanIcon(savedIcon)) out.push(savedIcon);
    let host = '';
    try { const u = new URL(url); if (/^https?:$/.test(u.protocol)) host = u.hostname; } catch { /* not a URL */ }
    if (useGoogle && host) out.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`);
    out.push(faviconUrl(url, 64));
    return out;
  }

  // Adds to a category unless the same URL is already in it.
  function addLink(cat, linkLike, index = cat.links.length) {
    const key = urlKey(linkLike.url);
    const existing = cat.links.find((l) => urlKey(l.url) === key);
    if (existing) return { added: false, link: existing };
    const link = createLink(linkLike);
    if (!link) return { added: false, link: null };
    cat.links.splice(Math.max(0, Math.min(index, cat.links.length)), 0, link);
    return { added: true, link };
  }

  function createCategory(ws, name, index = ws.categories.length) {
    const cat = { id: uid(), name: name.trim() || 'Untitled', collapsed: false, links: [] };
    ws.categories.splice(index, 0, cat);
    return cat;
  }

  // The quick-save category. Matches "Inbox" in any language it may have been created in.
  function ensureInbox(ws, name = 'Inbox') {
    const names = new Set(['inbox', name.trim().toLowerCase()]);
    return ws.categories.find((c) => names.has(c.name.trim().toLowerCase())) || createCategory(ws, name, 0);
  }

  function firstCategory(ws) {
    return ws.categories[0] || createCategory(ws, 'General');
  }

  function createWorkspace(data, { name, color, icon }) {
    const ws = {
      id: uid(), name: name.trim() || 'Workspace',
      color: COLORS[color] ? color : COLOR_NAMES[data.workspaces.length % COLOR_NAMES.length],
      icon: str(icon).slice(0, 4), categories: [],
    };
    data.workspaces.push(ws);
    return ws;
  }

  // Moves a link to another (or the same) category. `beforeId` / `afterId` position it.
  function moveLink(data, linkId, toCatId, { beforeId = null, afterId = null } = {}) {
    const from = findLink(data, linkId);
    const to = findCategory(data, toCatId);
    if (!from || !to) return false;
    from.cat.links.splice(from.index, 1);
    let index = to.cat.links.length;
    const ref = beforeId || afterId;
    if (ref) {
      const i = to.cat.links.findIndex((l) => l.id === ref);
      if (i !== -1) index = beforeId ? i : i + 1;
    }
    to.cat.links.splice(index, 0, from.link);
    return true;
  }

  function moveCategory(data, catId, toWsId, { beforeId = null, afterId = null } = {}) {
    const from = findCategory(data, catId);
    const toWs = getWorkspace(data, toWsId);
    if (!from || !toWs) return false;
    from.ws.categories.splice(from.index, 1);
    let index = toWs.categories.length;
    const ref = beforeId || afterId;
    if (ref) {
      const i = toWs.categories.findIndex((c) => c.id === ref);
      if (i !== -1) index = beforeId ? i : i + 1;
    }
    toWs.categories.splice(index, 0, from.cat);
    return true;
  }

  function moveWorkspace(data, wsId, { beforeId = null, afterId = null } = {}) {
    const i = data.workspaces.findIndex((w) => w.id === wsId);
    if (i === -1) return false;
    const [ws] = data.workspaces.splice(i, 1);
    const ref = beforeId || afterId;
    let index = data.workspaces.length;
    const j = data.workspaces.findIndex((w) => w.id === ref);
    if (j !== -1) index = beforeId ? j : j + 1;
    data.workspaces.splice(index, 0, ws);
    return true;
  }

  // Merges `incoming` into `data`: workspaces and categories are matched by name,
  // links are de-duplicated by URL. Returns what was added.
  function mergeData(data, incoming) {
    const added = { workspaces: 0, categories: 0, links: 0 };
    const byName = (list, name) => list.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
    for (const inWs of incoming.workspaces) {
      let ws = byName(data.workspaces, inWs.name);
      if (!ws) {
        ws = createWorkspace(data, { name: inWs.name, color: inWs.color, icon: inWs.icon });
        added.workspaces++;
      }
      for (const inCat of inWs.categories) {
        let cat = byName(ws.categories, inCat.name);
        if (!cat) {
          cat = createCategory(ws, inCat.name);
          added.categories++;
        }
        for (const l of inCat.links) {
          const key = urlKey(l.url);
          if (cat.links.some((x) => urlKey(x.url) === key)) continue;
          cat.links.push({ ...l, id: uid() });
          added.links++;
        }
      }
    }
    return added;
  }

  function stats(data) {
    let categories = 0, links = 0;
    for (const ws of data.workspaces) {
      categories += ws.categories.length;
      links += countLinks(ws);
    }
    return { workspaces: data.workspaces.length, categories, links };
  }

  g.LS = g.LS || {};
  g.LS.data = {
    STORAGE_KEY, LEGACY_KEY, SCHEMA, COLORS, COLOR_NAMES,
    uid, defaultSettings, normalizeData, normalizeSettings, load, save,
    getWorkspace, activeWorkspace, findCategory, findLink, allLinks, countLinks, findByUrl, urlKey,
    domainOf, normalizeUrlInput, faviconUrl, iconSources, cleanIcon,
    createLink, addLink, createCategory, ensureInbox, firstCategory, createWorkspace,
    moveLink, moveCategory, moveWorkspace, mergeData, stats,
  };
})(self);
