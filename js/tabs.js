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
        // Filter out the current newtab page
        const filteredTabs = tabs.filter(tab => {
          return !tab.url.includes('chrome://newtab') && 
                 !tab.url.startsWith('chrome-extension://') ||
                 !tab.active; // Include non-active extension pages
        });
        resolve(filteredTabs);
      });
    });
  }

  renderTabs(tabs) {
    this.tabsList.innerHTML = '';
    
    if (tabs.length === 0) {
      this.tabsList.innerHTML = '<div class="text-white dark:text-white text-center py-4">No open tabs</div>';
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
      
      let domain = '';
      try {
        domain = new URL(tab.url).hostname.replace('www.', '');
      } catch (e) {
        domain = tab.url;
      }
      
      // Create a shortened title (max 50 characters)
      const shortTitle = tab.title.length > 50 ? tab.title.substring(0, 50) + '...' : tab.title;
        tabElement.innerHTML = `
        <div class="tab-content">
          <div class="tab-header">
            <div class="tab-image">
              <img src="${tab.favIconUrl || 'icons/default-favicon.png'}" alt="favicon" 
                  onerror="this.src='icons/default-favicon.png'">
            </div>
            <div class="tab-info">
              <div class="tab-title">${shortTitle}</div>
            </div>
            <div class="actions-group">
              <button class="btn-icon btn-sm go-to-tab-btn" title="Go to tab">
                <span class="material-icons">open_in_new</span>
              </button>
              <button class="btn-icon btn-sm save-tab-btn" title="Save to active category">
                <span class="material-icons">bookmark_add</span>
              </button>
            </div>
          </div>
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
      
      // Add go to tab button listener
      tabElement.querySelector('.go-to-tab-btn').addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
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
