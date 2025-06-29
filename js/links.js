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
    const linksPlaceholder = document.querySelector(`.links-container-placeholder[data-category-index="${state.activeCategory}"]`);
    if (!linksPlaceholder) return;
    
    linksPlaceholder.innerHTML = '';
    
    const linksHeader = document.createElement('div');
    linksHeader.className = 'flex justify-between items-center mb-2';
    linksHeader.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="font-medium text-gray-700 dark:text-gray-300">Links</span>
        <span class="text-sm text-gray-500 dark:text-gray-400">${category.links.length} items</span>
      </div>
      <div class="actions-group">
        <button class="btn-icon btn-sm add-link-btn" title="Add Link">
          <span class="material-icons" style="font-size: 16px">add</span>
        </button>
      </div>
    `;
    linksPlaceholder.appendChild(linksHeader);
    
    if (category.links.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.innerHTML = `
        <span class="material-icons">link_off</span>
        <p>No links in this category</p>
        <p class="text-sm text-white dark:text-white mt-2">Drag tabs here or add manually</p>
      `;
      linksPlaceholder.appendChild(emptyMessage);
    } else {
      const linksGrid = document.createElement('div');
      linksGrid.className = 'links-grid';
      linksPlaceholder.appendChild(linksGrid);
      
      category.links.forEach((link, index) => {
        const linkElement = document.createElement('div');
        linkElement.className = 'link-card';
        linkElement.dataset.index = index;
        linkElement.draggable = true;
        
        let displayUrl;
        try {
          const url = new URL(link.url);
          displayUrl = url.hostname;
        } catch (e) {
          displayUrl = link.url;        }
          linkElement.innerHTML = `
          <div class="link-card-content">
            <div class="link-thumbnail">
              <img src="${link.image || 'icons/default-favicon.png'}" alt="favicon">
            </div>
            <div class="link-info">
              <h3 class="link-card-title">${link.title}</h3>
              <span class="link-card-url">${displayUrl}</span>
            </div>
          </div>
          <div class="link-card-actions">
            <div class="actions-group">
              <a href="${link.url}" target="_blank" class="btn-icon btn-sm visit-btn" title="Visit Link">
                <span class="material-icons">open_in_new</span>
              </a>
              <button class="btn-icon btn-sm edit-link-btn" title="Edit Link" data-index="${index}">
                <span class="material-icons">edit</span>
              </button>
              <button class="btn-icon btn-sm delete-link-btn" title="Delete Link" data-index="${index}">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </div>
        `;        
        linksGrid.appendChild(linkElement);
        
        // Add favicon error handling
        const faviconImg = linkElement.querySelector('.link-thumbnail img');
        faviconImg.addEventListener('error', () => {
          faviconImg.src = 'icons/default-favicon.png';
        });
        
        // Add drag and drop functionality for links
        this.addLinkDragEvents(linkElement);
        
        // Add click listener to the card itself for opening the link
        linkElement.addEventListener('click', (event) => {
          // Don't trigger if clicking on action buttons
          if (!event.target.closest('.link-card-actions')) {
            window.open(link.url, '_blank');
          }
        });
        
        // Add edit button listener
        linkElement.querySelector('.edit-link-btn').addEventListener('click', (event) => {
          event.stopPropagation(); // Prevent card click
          const linkIndex = parseInt(event.currentTarget.dataset.index);
          this.showEditLinkModal(link, linkIndex);
        });
        
        // Add delete button listener
        linkElement.querySelector('.delete-link-btn').addEventListener('click', (event) => {
          event.stopPropagation(); // Prevent card click
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

  // Method to add drag events for link reordering
  addLinkDragEvents(linkElement) {
    linkElement.addEventListener('dragstart', (e) => {
      linkElement.classList.add('dragging');
      e.dataTransfer.setData('application/x-link-index', linkElement.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
    });

    linkElement.addEventListener('dragend', () => {
      linkElement.classList.remove('dragging');
    });

    linkElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      // Only allow link reordering if we're dragging a link
      if (e.dataTransfer.types.includes('application/x-link-index')) {
        linkElement.classList.add('drag-over');
      }
    });

    linkElement.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes('application/x-link-index')) {
        linkElement.classList.add('drag-over');
      }
    });

    linkElement.addEventListener('dragleave', () => {
      linkElement.classList.remove('drag-over');
    });

    linkElement.addEventListener('drop', (e) => {
      e.preventDefault();
      linkElement.classList.remove('drag-over');
      
      // Handle link reordering
      if (e.dataTransfer.types.includes('application/x-link-index')) {
        const fromIndex = parseInt(e.dataTransfer.getData('application/x-link-index'));
        const toIndex = parseInt(linkElement.dataset.index);
        
        if (fromIndex !== toIndex) {
          this.reorderLinks(fromIndex, toIndex);
        }
      }
    });
  }

  reorderLinks(fromIndex, toIndex) {
    this.store.dispatch({
      type: 'REORDER_LINKS',
      payload: { fromIndex, toIndex }
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
