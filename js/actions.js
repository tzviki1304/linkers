// All user actions. Views call these; each one updates the store and gives feedback.
(function (g) {
  const LS = (g.LS = g.LS || {});
  const D = LS.data;
  const { h, toast, formModal, confirmDialog, modal } = LS.dom;
  const store = LS.store;
  const t = (...a) => LS.i18n.t(...a);

  const undoToast = (message, snapshot) =>
    toast(message, { type: 'info', action: { label: t('common.undo'), run: () => store.restore(snapshot) } });

  function locationOptions(data) {
    return data.workspaces.map((ws) => ({
      group: ws.name,
      options: ws.categories.map((c) => ({ value: c.id, label: c.name })),
    })).filter((grp) => grp.options.length);
  }

  const pathOf = (ws, cat) => `${ws.name} › ${cat.name}`;
  const parseTags = (s) => String(s || '').split(/[,،，]/).map((x) => x.trim().replace(/^#/, '')).filter(Boolean);

  // ---------- workspaces ----------
  function setActiveWorkspace(id) {
    if (store.data.activeWorkspaceId === id) return;
    store.update((d) => { d.activeWorkspaceId = id; });
    const content = document.getElementById('content');
    if (content) content.scrollTop = 0;
  }

  function addWorkspace() {
    formModal({
      title: t('ws.new'),
      subtitle: t('ws.newSubtitle'),
      submitLabel: t('common.create'),
      fields: [
        { name: 'name', label: t('common.name'), required: true, placeholder: t('ws.namePlaceholder'), autofocus: true },
        { name: 'icon', label: t('ws.emoji'), optional: true, placeholder: '💼', maxlength: 4 },
        { name: 'color', label: t('ws.color'), type: 'swatches', value: D.COLOR_NAMES[store.data.workspaces.length % D.COLOR_NAMES.length] },
      ],
      onSubmit: (v) => {
        store.update((d) => {
          const ws = D.createWorkspace(d, v);
          D.createCategory(ws, t('cat.defaultName'));
          d.activeWorkspaceId = ws.id;
        });
      },
    });
  }

  function editWorkspace(wsId) {
    const ws = D.getWorkspace(store.data, wsId);
    if (!ws) return;
    formModal({
      title: t('ws.editTitle'),
      fields: [
        { name: 'name', label: t('common.name'), required: true, value: ws.name },
        { name: 'icon', label: t('ws.emoji'), optional: true, value: ws.icon, placeholder: '💼', maxlength: 4 },
        { name: 'color', label: t('ws.color'), type: 'swatches', value: ws.color },
      ],
      onSubmit: (v) => {
        store.update((d) => {
          const w = D.getWorkspace(d, wsId);
          w.name = v.name;
          w.icon = v.icon.slice(0, 4);
          w.color = D.COLORS[v.color] ? v.color : w.color;
        });
      },
    });
  }

  function deleteWorkspace(wsId) {
    const ws = D.getWorkspace(store.data, wsId);
    if (!ws) return;
    if (store.data.workspaces.length === 1) {
      toast(t('ws.needOne'), { type: 'error' });
      return;
    }
    const n = D.countLinks(ws);
    confirmDialog({
      title: t('ws.deleteTitle', { name: ws.name }),
      message: n
        ? t('ws.deleteText', { categories: t('count.categories', { count: ws.categories.length }), links: t('count.links', { count: n }) })
        : t('ws.deleteEmpty'),
      onConfirm: () => {
        const snap = store.update((d) => {
          d.workspaces = d.workspaces.filter((w) => w.id !== wsId);
          if (d.activeWorkspaceId === wsId) d.activeWorkspaceId = d.workspaces[0].id;
        });
        undoToast(t('ws.deleted', { name: ws.name }), snap);
      },
    });
  }

  // ---------- categories ----------
  function addCategory(wsId = store.data.activeWorkspaceId) {
    formModal({
      title: t('cat.new'),
      subtitle: t('cat.newSubtitle'),
      submitLabel: t('common.create'),
      fields: [{ name: 'name', label: t('common.name'), required: true, placeholder: t('cat.namePlaceholder'), autofocus: true }],
      onSubmit: (v) => {
        let id;
        store.update((d) => { id = D.createCategory(D.getWorkspace(d, wsId), v.name).id; });
        requestAnimationFrame(() => {
          const el = document.querySelector(`.cat[data-id="${id}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      },
    });
  }

  function renameCategory(catId, name) {
    name = name.trim();
    const f = D.findCategory(store.data, catId);
    if (!f || !name || f.cat.name === name) return;
    store.update((d) => { D.findCategory(d, catId).cat.name = name; });
  }

  function deleteCategory(catId) {
    const f = D.findCategory(store.data, catId);
    if (!f) return;
    const snap = store.update((d) => {
      const x = D.findCategory(d, catId);
      x.ws.categories.splice(x.index, 1);
    });
    const n = f.cat.links.length;
    undoToast(n ? t('cat.deletedWithLinks', { name: f.cat.name, links: t('count.links', { count: n }) }) : t('cat.deleted', { name: f.cat.name }), snap);
  }

  function toggleCollapse(catId) {
    store.update((d) => { const c = D.findCategory(d, catId).cat; c.collapsed = !c.collapsed; });
  }

  function setAllCollapsed(collapsed) {
    store.update((d) => { D.activeWorkspace(d).categories.forEach((c) => { c.collapsed = collapsed; }); });
  }

  function moveCategoryDialog(catId) {
    const f = D.findCategory(store.data, catId);
    if (!f) return;
    formModal({
      title: t('cat.moveTitle', { name: f.cat.name }),
      submitLabel: t('common.move'),
      fields: [{
        name: 'ws', label: t('cat.toWorkspace'), type: 'select', value: f.ws.id,
        options: store.data.workspaces.map((w) => ({ value: w.id, label: w.name })),
      }],
      onSubmit: (v) => {
        if (v.ws === f.ws.id) return;
        store.update((d) => D.moveCategory(d, catId, v.ws));
        toast(t('toast.movedTo', { place: D.getWorkspace(store.data, v.ws).name }));
      },
    });
  }

  // ---------- links ----------
  function addLink(catId) {
    formModal({
      title: t('link.add'),
      submitLabel: t('link.add'),
      fields: [
        { name: 'url', label: t('link.url'), type: 'url', required: true, placeholder: 'https://example.com', autofocus: true },
        { name: 'title', label: t('link.title'), optional: true, placeholder: t('link.titlePlaceholder') },
        { name: 'note', label: t('link.note'), type: 'textarea', optional: true, rows: 2 },
        { name: 'tags', label: t('link.tags'), optional: true, placeholder: t('link.tagsPlaceholder') },
        { name: 'cat', label: t('link.category'), type: 'select', value: catId, options: locationOptions(store.data) },
      ],
      onSubmit: (v) => {
        const url = D.normalizeUrlInput(v.url);
        try { new URL(url); } catch { return t('link.invalidUrl'); }
        saveUrl(v.cat, { url, title: v.title || D.domainOf(url), note: v.note, tags: parseTags(v.tags) });
      },
    });
  }

  function editLink(linkId) {
    const f = D.findLink(store.data, linkId);
    if (!f) return;
    const { link } = f;
    formModal({
      title: t('link.editTitle'),
      fields: [
        { name: 'title', label: t('link.title'), required: true, value: link.title, autofocus: true },
        { name: 'url', label: t('link.url'), type: 'url', required: true, value: link.url },
        { name: 'note', label: t('link.note'), type: 'textarea', optional: true, value: link.note, rows: 2 },
        { name: 'tags', label: t('link.tags'), optional: true, value: link.tags.join(', '), placeholder: t('link.tagsPlaceholder') },
        { name: 'cat', label: t('link.category'), type: 'select', value: f.cat.id, options: locationOptions(store.data) },
      ],
      onSubmit: (v) => {
        const url = D.normalizeUrlInput(v.url);
        try { new URL(url); } catch { return t('link.invalidUrl'); }
        store.update((d) => {
          const x = D.findLink(d, linkId);
          Object.assign(x.link, { title: v.title, url, note: v.note, tags: parseTags(v.tags) });
          if (v.cat !== x.cat.id) D.moveLink(d, linkId, v.cat);
        });
      },
    });
  }

  function deleteLink(linkId) {
    const f = D.findLink(store.data, linkId);
    if (!f) return;
    const snap = store.update((d) => { const x = D.findLink(d, linkId); x.cat.links.splice(x.index, 1); });
    undoToast(t('link.deleted', { title: truncate(f.link.title, 40) }), snap);
  }

  function togglePin(linkId) {
    store.update((d) => { const l = D.findLink(d, linkId).link; l.pinned = !l.pinned; });
  }

  function moveLinkDialog(linkId) {
    const f = D.findLink(store.data, linkId);
    if (!f) return;
    formModal({
      title: t('link.moveTitle'),
      subtitle: truncate(f.link.title, 60),
      submitLabel: t('common.move'),
      fields: [{ name: 'cat', label: t('link.toCategory'), type: 'select', value: f.cat.id, options: locationOptions(store.data) }],
      onSubmit: (v) => {
        if (v.cat === f.cat.id) return;
        store.update((d) => D.moveLink(d, linkId, v.cat));
        const to = D.findCategory(store.data, v.cat);
        toast(t('toast.movedTo', { place: pathOf(to.ws, to.cat) }));
      },
    });
  }

  async function copyUrl(linkId) {
    const f = D.findLink(store.data, linkId);
    if (!f) return;
    try {
      await navigator.clipboard.writeText(f.link.url);
      toast(t('link.copied'));
    } catch {
      toast(t('link.copyFailed'), { type: 'error' });
    }
  }

  // Saves a URL into a category, skipping exact duplicates in that category.
  function saveUrl(catId, linkLike, { index, quiet = false } = {}) {
    const f = D.findCategory(store.data, catId);
    if (!f) return false;
    const key = D.urlKey(linkLike.url);
    if (f.cat.links.some((l) => D.urlKey(l.url) === key)) {
      if (!quiet) toast(t('link.alreadyIn', { name: f.cat.name }), { type: 'info' });
      return false;
    }
    const elsewhere = D.findByUrl(store.data, linkLike.url);
    store.update((d) => {
      const c = D.findCategory(d, catId).cat;
      D.addLink(c, linkLike, index == null ? c.links.length : index);
      c.collapsed = false;
    });
    if (!quiet) {
      const also = elsewhere.length ? ' · ' + t('link.alsoIn', { place: pathOf(elsewhere[0].ws, elsewhere[0].cat) }) : '';
      toast(t('link.savedTo', { name: f.cat.name }) + also);
    }
    return true;
  }

  function saveTab(tab, catId, opts) {
    return saveUrl(catId, { title: tab.title || D.domainOf(tab.url), url: tab.url, icon: tab.favIconUrl }, opts);
  }

  function openLink(link, newTab) {
    const url = link.url;
    if (/^(javascript|data|vbscript):/i.test(url)) return;
    if (newTab) chrome.tabs.create({ url, active: false });
    else chrome.tabs.getCurrent((tab) => (tab ? chrome.tabs.update(tab.id, { url }) : chrome.tabs.create({ url })));
  }

  function openAll(catId, inNewWindow) {
    const f = D.findCategory(store.data, catId);
    if (!f || !f.cat.links.length) return;
    const urls = f.cat.links.map((l) => l.url);
    const go = () => {
      if (inNewWindow) chrome.windows.create({ url: urls });
      else urls.forEach((url) => chrome.tabs.create({ url, active: false }));
    };
    if (urls.length > 12) {
      confirmDialog({
        title: t('cat.openAllConfirmTitle', { count: urls.length }), message: t('cat.openAllConfirmText', { name: f.cat.name }),
        confirmLabel: t('cat.openAllButton'), danger: false, onConfirm: go,
      });
    } else go();
  }

  // ---------- save all open tabs ----------
  function saveAllTabsDialog(tabs, presetCatId) {
    if (!tabs.length) { toast(t('tabs.noneToSave'), { type: 'info' }); return; }
    const d = new Date();
    const loc = LS.i18n.locale();
    const defaultName = t('tabs.sessionName', { date: `${d.toLocaleDateString(loc, { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}` });
    const ws = store.activeWorkspace();
    formModal({
      title: t('tabs.saveAllTitle', { count: tabs.length }),
      subtitle: t('tabs.saveAllSubtitle'),
      submitLabel: t('tabs.saveTabsButton'),
      fields: [
        {
          name: 'target', label: t('tabs.saveInto'), type: 'select', value: presetCatId || '__new__',
          options: [{ value: '__new__', label: t('tabs.newCategoryOption') }, ...locationOptions(store.data)],
        },
        { name: 'name', label: t('tabs.newCategoryName'), value: defaultName, hint: t('tabs.newCategoryHint') },
        {
          name: 'close', label: t('tabs.afterSaving'), type: 'select', value: 'keep',
          options: [{ value: 'keep', label: t('tabs.keepOpen') }, { value: 'close', label: t('tabs.closeSaved') }],
        },
      ],
      onSubmit: (v) => {
        let catId = v.target;
        let added = 0;
        const snap = store.update((dd) => {
          let cat;
          if (catId === '__new__') {
            cat = D.createCategory(D.getWorkspace(dd, ws.id), v.name || defaultName);
            catId = cat.id;
          } else cat = D.findCategory(dd, catId).cat;
          cat.collapsed = false;
          for (const tab of tabs) if (D.addLink(cat, { title: tab.title || D.domainOf(tab.url), url: tab.url, icon: tab.favIconUrl }).added) added++;
        });
        if (v.close === 'close') chrome.tabs.remove(tabs.map((tab) => tab.id));
        const skipped = tabs.length - added;
        undoToast(t('tabs.savedCount', { count: added }) + (skipped ? ' ' + t('tabs.skippedCount', { count: skipped }) : ''), snap);
      },
    });
  }

  // ---------- import / export ----------
  function exportData() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    LS.dom.downloadText(LS.backup.serialize(store.data), `link-saver-export-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`);
    toast(t('data.exported'));
  }

  async function importFromFile() {
    const file = await LS.dom.pickFile();
    if (!file) return;
    importText(await LS.dom.readFile(file), file.name);
  }

  function importText(text, sourceName) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { toast(t('data.invalidJson'), { type: 'error' }); return; }
    if (!parsed || typeof parsed !== 'object' || !(parsed.workspaces || (parsed.data && parsed.data.workspaces))) {
      toast(t('data.notLinkSaver'), { type: 'error' });
      return;
    }
    const incoming = D.normalizeData(parsed);
    const s = D.stats(incoming);
    const m = modal({
      title: t('data.restoreTitle'),
      subtitle: sourceName,
      size: 'sm',
      body: h('div', { class: 'import-summary' },
        h('div', { class: 'stat-row' },
          stat(s.workspaces, t('stat.workspaces')), stat(s.categories, t('stat.categories')), stat(s.links, t('stat.links'))),
        h('p', { class: 'muted' }, t('data.restoreText'))),
      footer: [
        h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, t('common.cancel')),
        h('button', {
          class: 'btn btn-secondary',
          onclick: () => {
            m.close();
            const snap = store.snapshot();
            const added = D.mergeData(store.data, incoming);
            store.restore(store.data);
            undoToast(t('data.merged', { links: added.links, categories: added.categories }), snap);
          },
        }, t('data.merge')),
        h('button', {
          class: 'btn btn-danger',
          onclick: () => {
            m.close();
            const snap = store.snapshot();
            incoming.settings = store.data.settings; // keep this device's settings
            store.restore(incoming);
            undoToast(t('data.replaced'), snap);
          },
        }, t('data.replace')),
      ],
    });
  }

  const stat = (n, label) => h('div', { class: 'stat' }, h('div', { class: 'stat-num' }, String(n)), h('div', { class: 'stat-label' }, label));

  // ---------- settings ----------
  function setSetting(key, value) {
    store.update((d) => { d.settings[key] = value; });
  }

  function setBackupSetting(key, value) {
    store.update((d) => { d.settings.backup[key] = value; });
  }

  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  LS.actions = {
    setActiveWorkspace, addWorkspace, editWorkspace, deleteWorkspace,
    addCategory, renameCategory, deleteCategory, toggleCollapse, setAllCollapsed, moveCategoryDialog,
    addLink, editLink, deleteLink, togglePin, moveLinkDialog, copyUrl, saveUrl, saveTab, openLink, openAll,
    saveAllTabsDialog, exportData, importFromFile, importText, setSetting, setBackupSetting, pathOf, truncate,
  };
})(self);
