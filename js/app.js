class App {
  constructor() {
    // Initialize components
    this.store = store;
    this.ui = new UI(this.store);
    this.workspacesManager = new WorkspacesManager(this.store, this.ui);
    this.categoriesManager = new CategoriesManager(this.store, this.ui);
    this.linksManager = new LinksManager(this.store, this.ui);
    this.tabsManager = new TabsManager(this.store, this.ui);
    
    this.init();
  }

  async init() {
    // Initialize store
    await this.store.init();
    
    // Subscribe to state changes
    this.store.subscribe(this.handleStateChange.bind(this));
    
    // Handle initial state
    this.handleStateChange(this.store.getState());
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TAB_UPDATED' || message.type === 'TAB_REMOVED') {
        this.tabsManager.loadOpenTabs();
      }
    });
  }

  handleStateChange(state) {
    // Update UI based on theme
    this.ui.updateTheme(state.theme);
    
    // Render components
    this.workspacesManager.renderWorkspaces(state);
    this.categoriesManager.renderCategories(state);
    this.linksManager.renderLinks(state);
  }
}

// Initialize the app when the document is ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
