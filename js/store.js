class Store {  constructor() {
    this.data = {
      workspaces: [],
      activeWorkspace: null,
      activeCategory: null,
      theme: 'dark'
    };
    this.listeners = [];
  }

  async init() {
    await this.loadFromStorage();
    
    // Create default workspace if none exists
    if (this.data.workspaces.length === 0) {
      this.data.workspaces.push({
        name: "Default Workspace",
        categories: []
      });
      this.data.activeWorkspace = 0;
      await this.saveToStorage();
    }
    
    this.notifyListeners();
  }

  async loadFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['linkSaverData'], (result) => {
        if (result.linkSaverData) {
          this.data = JSON.parse(result.linkSaverData);
        }
        resolve();
      });
    });
  }

  async saveToStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        linkSaverData: JSON.stringify(this.data)
      }, resolve);
    });
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.data));
  }

  async dispatch(action) {
    switch (action.type) {
      case 'ADD_WORKSPACE':
        this.data.workspaces.push({
          name: action.payload.name,
          categories: []
        });
        break;
      
      case 'EDIT_WORKSPACE':
        this.data.workspaces[action.payload.index].name = action.payload.name;
        break;
        
      case 'DELETE_WORKSPACE':
        this.data.workspaces.splice(action.payload.index, 1);
        if (this.data.activeWorkspace === action.payload.index) {
          this.data.activeWorkspace = this.data.workspaces.length > 0 ? 0 : null;
          this.data.activeCategory = null;
        } else if (this.data.activeWorkspace > action.payload.index) {
          this.data.activeWorkspace--;
        }
        break;
        
      case 'SET_ACTIVE_WORKSPACE':
        this.data.activeWorkspace = action.payload.index;
        this.data.activeCategory = null;
        break;
        
      case 'ADD_CATEGORY':
        if (this.data.activeWorkspace !== null) {
          this.data.workspaces[this.data.activeWorkspace].categories.push({
            name: action.payload.name,
            links: []
          });
        }
        break;
        
      case 'EDIT_CATEGORY':
        if (this.data.activeWorkspace !== null) {
          this.data.workspaces[this.data.activeWorkspace].categories[action.payload.index].name = action.payload.name;
        }
        break;
        
      case 'DELETE_CATEGORY':
        if (this.data.activeWorkspace !== null) {
          this.data.workspaces[this.data.activeWorkspace].categories.splice(action.payload.index, 1);
          if (this.data.activeCategory === action.payload.index) {
            this.data.activeCategory = null;
          } else if (this.data.activeCategory > action.payload.index) {
            this.data.activeCategory--;
          }
        }
        break;
        
      case 'SET_ACTIVE_CATEGORY':
        this.data.activeCategory = action.payload.index;
        break;
        
      case 'ADD_LINK':
        if (this.data.activeWorkspace !== null && this.data.activeCategory !== null) {
          this.data.workspaces[this.data.activeWorkspace].categories[this.data.activeCategory].links.push({
            title: action.payload.title,
            url: action.payload.url,
            image: action.payload.image
          });
        }
        break;
        
      case 'EDIT_LINK':
        if (this.data.activeWorkspace !== null && this.data.activeCategory !== null) {
          const link = this.data.workspaces[this.data.activeWorkspace].categories[this.data.activeCategory].links[action.payload.index];
          link.title = action.payload.title;
          link.url = action.payload.url;
          link.image = action.payload.image;
        }
        break;
        
      case 'DELETE_LINK':
        if (this.data.activeWorkspace !== null && this.data.activeCategory !== null) {
          this.data.workspaces[this.data.activeWorkspace].categories[this.data.activeCategory].links.splice(action.payload.index, 1);
        }
        break;
        
      case 'TOGGLE_THEME':
        this.data.theme = this.data.theme === 'light' ? 'dark' : 'light';
        break;
        
      case 'IMPORT_DATA':
        this.data = action.payload;
        break;

      case 'REORDER_WORKSPACES': {
        const { fromIndex, toIndex } = action.payload;
        const newWorkspaces = [...this.data.workspaces];
        const [movedWorkspace] = newWorkspaces.splice(fromIndex, 1);
        newWorkspaces.splice(toIndex, 0, movedWorkspace);
        
        // Adjust active workspace index if necessary
        let activeWorkspace = this.data.activeWorkspace;
        if (this.data.activeWorkspace === fromIndex) {
          activeWorkspace = toIndex;
        } else if (fromIndex < this.data.activeWorkspace && toIndex >= this.data.activeWorkspace) {
          activeWorkspace--;
        } else if (fromIndex > this.data.activeWorkspace && toIndex <= this.data.activeWorkspace) {
          activeWorkspace++;
        }
        
        this.data.workspaces = newWorkspaces;
        this.data.activeWorkspace = activeWorkspace;
        break;
      }

      case 'REORDER_CATEGORIES': {
        if (this.data.activeWorkspace !== null) {
          const { fromIndex, toIndex } = action.payload;
          const categories = this.data.workspaces[this.data.activeWorkspace].categories;
          const newCategories = [...categories];
          const [movedCategory] = newCategories.splice(fromIndex, 1);
          newCategories.splice(toIndex, 0, movedCategory);
          
          // Adjust active category index if necessary
          let activeCategory = this.data.activeCategory;
          if (this.data.activeCategory === fromIndex) {
            activeCategory = toIndex;
          } else if (fromIndex < this.data.activeCategory && toIndex >= this.data.activeCategory) {
            activeCategory--;
          } else if (fromIndex > this.data.activeCategory && toIndex <= this.data.activeCategory) {
            activeCategory++;
          }
          
          this.data.workspaces[this.data.activeWorkspace].categories = newCategories;
          this.data.activeCategory = activeCategory;
        }
        break;
      }

      case 'REORDER_LINKS': {
        if (this.data.activeWorkspace !== null && this.data.activeCategory !== null) {
          const { fromIndex, toIndex } = action.payload;
          const links = this.data.workspaces[this.data.activeWorkspace].categories[this.data.activeCategory].links;
          const newLinks = [...links];
          const [movedLink] = newLinks.splice(fromIndex, 1);
          newLinks.splice(toIndex, 0, movedLink);
          
          this.data.workspaces[this.data.activeWorkspace].categories[this.data.activeCategory].links = newLinks;
        }
        break;
      }
    }
    
    await this.saveToStorage();
    this.notifyListeners();
  }

  getState() {
    return this.data;
  }

  exportData() {
    const dataStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'link-saver-data.json';
    a.click();
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }

  async importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      await this.dispatch({
        type: 'IMPORT_DATA',
        payload: data
      });
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }
}

// Initialize the store
const store = new Store();
