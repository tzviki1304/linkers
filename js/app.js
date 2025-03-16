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

    // Initialize scrolling behavior
    this.initializeScrolling();
  }

  handleStateChange(state) {
    // Update UI based on theme
    this.ui.updateTheme(state.theme);
    
    // Render components
    this.workspacesManager.renderWorkspaces(state);
    this.categoriesManager.renderCategories(state);
    this.linksManager.renderLinks(state);

    // Re-check scrolling after content updates
    setTimeout(() => {
      this.initializeScrolling();
    }, 100);
  }
  
  initializeScrolling() {
    // Ensure all panel content areas have proper scrolling behavior
    const panelContents = document.querySelectorAll('.panel-content');
    panelContents.forEach(panel => {
      // Force overflow setting in case it's being overridden
      panel.style.overflowY = 'auto';
      
      // Add enough content to test scrolling in dev
      if (panel.scrollHeight <= panel.clientHeight) {
        console.log('Panel content fits without scrolling');
      } else {
        console.log('Panel content requires scrolling');
      }
    });
  }
}

// Initialize the app when the document is ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
