class TabsManager {
  constructor(store, ui) {
    this.store = store;
    this.ui = ui;
    this.tabsList = document.getElementById('openTabsList');
    this.refreshTabsBtn = document.getElementById('refreshTabsBtn');
    
    this.init();
  }

  init() {
    this.loadOpenTabs();
    this.initEventListeners();
  }

  initEventListeners() {
    this.refreshTabsBtn.addEventListener('click', () => {
      this.loadOpenTabs();
    });
  }

  async loadOpenTabs() {
    const tabs = await this.getOpenTabs();
    this.renderTabs(tabs);
  }

  async getOpenTabs() {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        resolve(tabs);
      });
    });
  }

  renderTabs(tabs) {
    this.tabsList.innerHTML = '';
    
    if (tabs.length === 0) {
      this.tabsList.innerHTML = '<div class="text-gray-500 dark:text-gray-400 text-center py-4">No open tabs</div>';
      return;
    }
    
    tabs.forEach(tab => {
      const tabElement = document.createElement('div');
      tabElement.className = 'tab-item draggable';
      tabElement.setAttribute('draggable', 'true');
      tabElement.dataset.tabId = tab.id;
      tabElement.dataset.title = tab.title;
      tabElement.dataset.url = tab.url;
      tabElement.dataset.favIcon = tab.favIconUrl || '';
      
      tabElement.innerHTML = `
        <div class="link-preview">
          <img src="${tab.favIconUrl || 'icons/default-favicon.png'}" alt="favicon" onerror="this.src='icons/default-favicon.png'">
          <span class="link-title">${tab.title}</span>
        </div>
        <div class="tab-actions">
          <button class="btn-icon btn-sm save-tab-btn" title="Save to active category">
            <span class="material-icons">save</span>
          </button>
        </div>
      `;
      
      this.tabsList.appendChild(tabElement);
      
      // Add drag event listeners
      tabElement.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', JSON.stringify({
          title: tab.title,
          url: tab.url,
          image: tab.favIconUrl || ''
        }));
        tabElement.classList.add('dragging');
      });
      
      tabElement.addEventListener('dragend', () => {
        tabElement.classList.remove('dragging');
      });
      
      // Add save button listener
      tabElement.querySelector('.save-tab-btn').addEventListener('click', () => {
        this.saveTabToActiveCategory(tab);
      });
    });
  }

  saveTabToActiveCategory(tab) {
    const state = this.store.getState();
    if (state.activeWorkspace === null || state.activeCategory === null) {
      this.ui.showToast('Please select a category first', 'error');
      return;
    }
    
    this.store.dispatch({
      type: 'ADD_LINK',
      payload: {
        title: tab.title,
        url: tab.url,
        image: tab.favIconUrl || ''
      }
    });
    
    this.ui.showToast('Link saved successfully');
  }
}
