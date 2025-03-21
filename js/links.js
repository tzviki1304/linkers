class LinksManager {
  constructor(store, ui) {
    this.store = store;
    this.ui = ui;
    this.categoriesList = document.getElementById('categoriesList');
    
    this.init();
  }

  init() {
    // Nothing to initialize here as links are displayed within categories
  }

  renderLinks(state) {
    if (state.activeWorkspace === null || state.activeCategory === null) {
      return;
    }
    
    const workspace = state.workspaces[state.activeWorkspace];
    const category = workspace.categories[state.activeCategory];
    
    // Find the placeholder for this category's links
    const linksPlaceholder = document.querySelector(`.links-container-placeholder[data-category-index="${state.activeCategory}"]`);
    if (!linksPlaceholder) return;
    
    // Clear the placeholder
    linksPlaceholder.innerHTML = '';
    
    // Add a header with add link button
    const linksHeader = document.createElement('div');
    linksHeader.className = 'flex justify-between items-center mb-2 text-sm';
    linksHeader.innerHTML = `
      <span class="font-semibold text-gray-700 dark:text-gray-300">Links</span>
      <button class="btn-icon btn-sm add-link-btn" title="Add Link">
        <span class="material-icons" style="font-size: 14px">add</span>
      </button>
    `;
    linksPlaceholder.appendChild(linksHeader);
    
    // Add each link
    if (category.links.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'text-gray-500 dark:text-gray-400 text-center text-xs py-2';
      emptyMessage.textContent = 'No links in this category';
      linksPlaceholder.appendChild(emptyMessage);
    } else {
      // Create a grid container for card-style links
      const linksGrid = document.createElement('div');
      linksGrid.className = 'links-grid';
      linksPlaceholder.appendChild(linksGrid);
      
      category.links.forEach((link, index) => {
        const linkElement = document.createElement('div');
        linkElement.className = 'link-card';
        
        // Format URL for display
        let displayUrl;
        try {
          const url = new URL(link.url);
          displayUrl = url.hostname;
        } catch (e) {
          displayUrl = link.url;
        }
        
        linkElement.innerHTML = `
          <div class="link-card-content">
            <div class="link-thumbnail">
              <img src="${link.image || 'icons/default-favicon.png'}" alt="favicon" 
                   onerror="this.src='icons/default-favicon.png'">
            </div>
            <div class="link-info">
              <h3 class="link-card-title">${link.title}</h3>
              <span class="link-card-url">${displayUrl}</span>
            </div>
          </div>
          <div class="link-card-actions">
            <a href="${link.url}" target="_blank" class="link-card-btn visit-btn" title="Visit Link">
              <span class="material-icons">open_in_new</span>
            </a>
            <button class="link-card-btn edit-link-btn" title="Edit Link" data-index="${index}">
              <span class="material-icons">edit</span>
            </button>
            <button class="link-card-btn delete-link-btn" title="Delete Link" data-index="${index}">
              <span class="material-icons">delete</span>
            </button>
          </div>
        `;
        
        linksGrid.appendChild(linkElement);
        
        // Add edit button listener
        linkElement.querySelector('.edit-link-btn').addEventListener('click', (event) => {
          const linkIndex = parseInt(event.currentTarget.dataset.index);
          this.showEditLinkModal(link, linkIndex);
        });
        
        // Add delete button listener
        linkElement.querySelector('.delete-link-btn').addEventListener('click', (event) => {
          const linkIndex = parseInt(event.currentTarget.dataset.index);
          this.showDeleteLinkConfirmation(linkIndex);
        });
      });
    }
    
    // Add event listener for add link button
    linksPlaceholder.querySelector('.add-link-btn').addEventListener('click', () => {
      this.showAddLinkModal();
    });
  }

  showAddLinkModal() {
    this.ui.createFormModal(
      'Add Link',
      [
        { name: 'title', label: 'Link Title', type: 'text', required: true },
        { name: 'url', label: 'URL', type: 'url', required: true },
        { name: 'image', label: 'Image URL (optional)', type: 'text' }
      ],
      (data) => {
        this.store.dispatch({
          type: 'ADD_LINK',
          payload: {
            title: data.title,
            url: data.url,
            image: data.image || ''
          }
        });
      }
    );
  }

  showEditLinkModal(link, index) {
    this.ui.createFormModal(
      'Edit Link',
      [
        { name: 'title', label: 'Link Title', type: 'text', required: true },
        { name: 'url', label: 'URL', type: 'url', required: true },
        { name: 'image', label: 'Image URL (optional)', type: 'text' }
      ],
      (data) => {
        this.store.dispatch({
          type: 'EDIT_LINK',
          payload: {
            title: data.title,
            url: data.url,
            image: data.image || '',
            index
          }
        });
      },
      {
        title: link.title,
        url: link.url,
        image: link.image
      }
    );
  }

  showDeleteLinkConfirmation(index) {
    this.ui.createConfirmDialog(
      'Are you sure you want to delete this link?',
      () => {
        this.store.dispatch({
          type: 'DELETE_LINK',
          payload: { index }
        });
      }
    );
  }
}
