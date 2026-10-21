// Service worker: onboarding, toolbar button, right-click menu, keyboard
// shortcuts and the hourly check for the daily backup.
importScripts('shared/idb.js', 'shared/data.js', 'shared/backup.js',
  'i18n/i18n.js', 'i18n/en.js', 'i18n/he.js', 'i18n/fr.js', 'i18n/es.js', 'i18n/zh.js');
const t = (...a) => LS.i18n.t(...a);

const DASHBOARD = chrome.runtime.getURL('newtab.html');
const BACKUP_ALARM = 'backup-check';

// ---------- install / update ----------
chrome.runtime.onInstalled.addListener(async (details) => {
  const { data, migrated } = await LS.data.load();
  if (migrated) await LS.data.save({ ...data, rev: Date.now() });
  await ensureAlarm();
  rebuildMenus();

  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  } else if (details.reason === 'update' && parseInt(details.previousVersion || '0', 10) < 2) {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html?updated=1') });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarm();
  rebuildMenus();
  checkBackup();
});

async function ensureAlarm() {
  const existing = await chrome.alarms.get(BACKUP_ALARM);
  if (!existing) await chrome.alarms.create(BACKUP_ALARM, { delayInMinutes: 1, periodInMinutes: 60 });
}

// ---------- daily backup ----------
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BACKUP_ALARM) checkBackup();
});

async function checkBackup() {
  try {
    const { data } = await LS.data.load();
    await LS.backup.run(data, { interactive: false });
  } catch (e) {
    console.warn('Backup check failed', e);
  }
}

// ---------- toolbar button: open (or focus) the dashboard ----------
chrome.action.onClicked.addListener(async (tab) => {
  const isBlankNewTab = tab && /^chrome:\/\/(newtab|new-tab-page)/.test(tab.url || tab.pendingUrl || '');
  if (isBlankNewTab) {
    chrome.tabs.update(tab.id, { url: DASHBOARD + '?app=1' });
    return;
  }
  const tabs = await chrome.tabs.query({ windowId: tab ? tab.windowId : undefined });
  const existing = tabs.find((t) => (t.url || '').startsWith(DASHBOARD));
  if (existing) {
    chrome.tabs.update(existing.id, { active: true });
  } else {
    chrome.tabs.create({ url: DASHBOARD + '?app=1', index: tab ? tab.index + 1 : undefined });
  }
});

// ---------- right-click menu: "Save to Link Saver" ----------
let menuChain = Promise.resolve();
let lastMenuSignature = '';

function menuSignature(data) {
  return JSON.stringify([data.settings.language, data.workspaces.map((w) => [w.id, w.name, w.categories.map((c) => [c.id, c.name])])]);
}

const menuTitle = (s) => s.replace(/&/g, '&&');
const ignoreError = () => void chrome.runtime.lastError;

function rebuildMenus(force = true) {
  menuChain = menuChain.then(async () => {
    const { data } = await LS.data.load();
    const sig = menuSignature(data);
    if (!force && sig === lastMenuSignature) return;
    lastMenuSignature = sig;
    LS.i18n.setLang(data.settings.language);

    await chrome.contextMenus.removeAll();
    const contexts = ['page', 'link'];
    const create = (props) => chrome.contextMenus.create({ contexts, ...props }, ignoreError);
    create({ id: 'ls-root', title: menuTitle(t('menu.root')) });
    create({ id: 'ls-inbox', parentId: 'ls-root', title: menuTitle(t('menu.inbox')) });
    create({ id: 'ls-sep', parentId: 'ls-root', type: 'separator' });
    for (const ws of data.workspaces) {
      const wsMenu = `ws:${ws.id}`;
      create({ id: wsMenu, parentId: 'ls-root', title: menuTitle(ws.name) });
      if (!ws.categories.length) create({ id: `wsinbox:${ws.id}`, parentId: wsMenu, title: menuTitle(t('inbox')) });
      for (const cat of ws.categories) {
        create({ id: `cat:${ws.id}:${cat.id}`, parentId: wsMenu, title: menuTitle(cat.name) });
      }
    }
  }).catch((e) => console.warn('Menu rebuild failed', e));
}

let menuTimer = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[LS.data.STORAGE_KEY]) return;
  clearTimeout(menuTimer);
  menuTimer = setTimeout(() => rebuildMenus(false), 400);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const id = String(info.menuItemId);
  const url = info.linkUrl || info.pageUrl || (tab && tab.url);
  if (!url) return;
  const title = info.linkUrl
    ? (info.selectionText || prettyUrl(info.linkUrl))
    : ((tab && tab.title) || prettyUrl(url));

  let target = null;
  if (id === 'ls-inbox') target = { inbox: true };
  else if (id.startsWith('wsinbox:')) target = { inbox: true, wsId: id.slice(8) };
  else if (id.startsWith('cat:')) {
    const [, wsId, catId] = id.split(':');
    target = { wsId, catId };
  }
  const icon = !info.linkUrl && tab ? tab.favIconUrl : '';
  if (target) await saveLink(target, { title, url, icon }, tab && tab.id);
});

// ---------- keyboard shortcut: quick save current tab ----------
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'quick-save') return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || tab.url.startsWith(chrome.runtime.getURL(''))) return;
  if (/^chrome:\/\/(newtab|new-tab-page)/.test(tab.url)) return;
  await saveLink({ inbox: true }, { title: tab.title || prettyUrl(tab.url), url: tab.url, icon: tab.favIconUrl }, tab.id);
});

async function saveLink(target, linkLike, tabId) {
  const { data } = await LS.data.load();
  let ws = target.wsId ? LS.data.getWorkspace(data, target.wsId) : null;
  if (!ws) ws = LS.data.activeWorkspace(data);
  let cat = target.catId ? ws.categories.find((c) => c.id === target.catId) : null;
  if (!cat) {
    LS.i18n.setLang(data.settings.language);
    cat = LS.data.ensureInbox(ws, t('inbox'));
  }

  const res = LS.data.addLink(cat, linkLike);
  if (res.added) {
    data.rev = Date.now() + Math.random();
    await LS.data.save(data);
  }
  flashBadge(tabId, res.added ? '✓' : '=', res.added ? '#16a34a' : '#64748b');
}

function flashBadge(tabId, text, color) {
  if (tabId == null) return;
  chrome.action.setBadgeBackgroundColor({ tabId, color }, ignoreError);
  chrome.action.setBadgeText({ tabId, text }, ignoreError);
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }, ignoreError), 2000);
}

function prettyUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : decodeURIComponent(u.pathname);
    return (u.hostname.replace(/^www\./, '') + path).slice(0, 120);
  } catch {
    return url;
  }
}
