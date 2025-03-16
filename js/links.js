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
    
    // Find the active category element
    const categoryElement = document.querySelector(`.category-item[data-index="${state.activeCategory}"]`);
    if (!categoryElement) return;
    
    // Remove any existing links container
    let linksContainer = categoryElement.nextElementSibling;
    if (linksContainer && linksContainer.classList.contains('links-container')) {
      linksContainer.remove();
    }
    
    // Create new links container
    linksContainer = document.createElement('div');
    linksContainer.className = 'links-container pl-4 mb-4';
    
    // Add a header with add link button
    const linksHeader = document.createElement('div');
    linksHeader.className = 'flex justify-between items-center mb-2 text-sm';
    linksHeader.innerHTML = `
      <span class="font-semibold text-gray-700 dark:text-gray-300">Links</span>
      <button class="btn-icon btn-sm add-link-btn" title="Add Link">
        <span class="material-icons" style="font-size: 14px">add</span>
      </button>
    `;
    linksContainer.appendChild(linksHeader);
    
    // Add each link
    if (category.links.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'text-gray-500 dark:text-gray-400 text-center text-xs py-2';
      emptyMessage.textContent = 'No links in this category';
      linksContainer.appendChild(emptyMessage);
    } else {
      category.links.forEach((link, index) => {
        const linkElement = document.createElement('div');
        linkElement.className = 'link-item text-sm';
        linkElement.innerHTML = `
          <a href="${link.url}" target="_blank" class="link-preview">
            <img src="${link.image || 'icons/default-favicon.png'}" alt="favicon" onerror="this.src='icons/default-favicon.png'">
            <span class="link-title">${link.title}</span>
          </a>
          <div class="link-actions">
            <button class="btn-icon btn-sm edit-link-btn" title="Edit" data-index="${index}">
              <span class="material-icons" style="font-size: 14px">edit</span>
            </button>
            <button class="btn-icon btn-sm delete-link-btn" title="Delete" data-index="${index}">
              <span class="material-icons" style="font-size: 14px">delete</span>
            </button>
          </div>
        `;
        linksContainer.appendChild(linkElement);
        
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
    
    // Insert links container after the category element
    categoryElement.parentNode.insertBefore(linksContainer, categoryElement.nextSibling);
    
    // Add event listener for add link button
    linksContainer.querySelector('.add-link-btn').addEventListener('click', () => {
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
