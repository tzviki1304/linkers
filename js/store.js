// Page-side store: holds the data, persists it, keeps open pages in sync with
// each other and with saves made from the right-click menu / shortcut.
(function (g) {
  const LS = (g.LS = g.LS || {});

  class Store {
    constructor() {
      this.data = null;
      this.listeners = new Set();
      this.ownRevs = new Set();
    }

    async init() {
      const { data, migrated } = await LS.data.load();
      this.data = data;
      if (migrated) await this.persist();
      this.mirror();
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        const change = changes[LS.data.STORAGE_KEY];
        if (change && change.newValue) {
          if (this.ownRevs.has(change.newValue.rev)) {
            this.ownRevs.delete(change.newValue.rev);
          } else {
            this.data = LS.data.normalizeData(change.newValue);
            this.mirror();
            this.emit('external');
          }
        }
        if (changes[LS.backup.META_KEY]) this.emit('backup');
      });
    }

    get settings() { return this.data.settings; }
    activeWorkspace() { return LS.data.activeWorkspace(this.data); }

    // Mutate the data, re-render immediately, then save. Returns a snapshot for undo.
    update(mutator) {
      const before = this.snapshot();
      mutator(this.data);
      this.emit('change');
      this.persist();
      return before;
    }

    snapshot() { return JSON.parse(JSON.stringify(this.data)); }

    restore(snapshot) {
      this.data = LS.data.normalizeData(snapshot);
      this.emit('change');
      return this.persist();
    }

    async persist() {
      const rev = Date.now() + Math.random();
      this.data.rev = rev;
      this.ownRevs.add(rev);
      this.mirror();
      await LS.data.save(this.data);
    }

    // Copy a few settings into localStorage so the page can apply them before first paint.
    mirror() {
      try {
        localStorage.setItem('ls.theme', this.data.settings.theme);
        localStorage.setItem('ls.newTabMode', this.data.settings.newTabMode);
        localStorage.setItem('ls.lang', this.data.settings.language);
      } catch { /* storage blocked */ }
    }

    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit(reason) { this.listeners.forEach((fn) => fn(reason)); }
  }

  LS.store = new Store();
})(self);
