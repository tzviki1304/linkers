class CategoriesManager {
  constructor(store, ui) {
    this.store = store;
    this.ui = ui;
    this.categoriesList = document.getElementById('categoriesList');
    this.addCategoryBtn = document.getElementById('addCategoryBtn');
    
    this.init();
  }

  init() {
    this.initEventListeners();
  }

  initEventListeners() {
    this.addCategoryBtn.addEventListener('click', () => {
      this.showAddCategoryModal();
    });
  }

  renderCategories(state) {
    this.categoriesList.innerHTML = '';
    
    if (state.activeWorkspace === null) {
      this.categoriesList.innerHTML = '<div class="text-white dark:text-white text-center py-4">Select a workspace</div>';
      return;
    }
    
    const workspace = state.workspaces[state.activeWorkspace];
    
    if (workspace.categories.length === 0) {
      this.categoriesList.innerHTML = `
        <div class="empty-message">
          <span class="material-icons">folder</span>
          <p>No categories</p>
          <button class="btn mt-3 flex items-center gap-2 mx-auto">
            <span class="material-icons" style="font-size: 20px;">add_circle</span>
            Create Category
          </button>
        </div>`;

      this.categoriesList.querySelector('button').addEventListener('click', () => {
        this.showAddCategoryModal();
      });
      return;
    }
      workspace.categories.forEach((category, index) => {
      const categoryElement = document.createElement('div');
      categoryElement.className = `category-item ${state.activeCategory === index ? 'active expanded' : ''}`;
      categoryElement.dataset.index = index;
      categoryElement.draggable = true;
      
      categoryElement.innerHTML = `
        <div class="category-content">
          <div class="category-header">
            <span class="category-name">${category.name}</span>
            <span class="category-count text-sm text-white dark:text-white">
              ${category.links?.length || 0}
            </span>
          </div>
          <div class="actions-group">
            <button class="btn-icon btn-sm edit-category-btn" title="Edit Category">
              <span class="material-icons">edit</span>
            </button>
            <button class="btn-icon btn-sm delete-category-btn" title="Delete Category">
              <span class="material-icons">delete</span>
            </button>
          </div>        </div>
      `;
      
      // Create a category container to hold both the category item and its links
      const categoryContainer = document.createElement('div');
      categoryContainer.className = 'category-container';
      categoryContainer.dataset.index = index;
      
      // Add click listener to select category
      categoryElement.addEventListener('click', (event) => {
        if (!event.target.closest('button')) {
          this.selectCategory(index);
        }
      });
      
      // Add edit button listener
      categoryElement.querySelector('.edit-category-btn').addEventListener('click', () => {
        this.showEditCategoryModal(category, index);
      });
      
      // Add delete button listener
      categoryElement.querySelector('.delete-category-btn').addEventListener('click', () => {
        this.showDeleteCategoryConfirmation(index);
      });
      
      // Add drag and drop functionality for categories
      this.addCategoryDragEvents(categoryElement);
      
      // Add drag and drop functionality for tab dropping
      this.setupDragAndDrop(categoryElement, index);
      
      // Create a links container to hold the category links
      const linksContainer = document.createElement('div');
      linksContainer.className = 'links-container-placeholder';
      linksContainer.dataset.categoryIndex = index;
      
      // Move the category element into the container
      categoryContainer.appendChild(categoryElement);
      categoryContainer.appendChild(linksContainer);
      this.categoriesList.appendChild(categoryContainer);
      
      // Setup drag and drop for the links container
      this.setupDragAndDrop(linksContainer, index);
    });
  }

  // Method to add drag events for category reordering
  addCategoryDragEvents(categoryElement) {
    categoryElement.addEventListener('dragstart', (e) => {
      categoryElement.classList.add('dragging');
      e.dataTransfer.setData('application/x-category-index', categoryElement.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
    });

    categoryElement.addEventListener('dragend', () => {
      categoryElement.classList.remove('dragging');
    });

    categoryElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      // Only allow category reordering if we're dragging a category
      if (e.dataTransfer.types.includes('application/x-category-index')) {
        categoryElement.classList.add('drag-over');
      }
    });

    categoryElement.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes('application/x-category-index')) {
        categoryElement.classList.add('drag-over');
      }
    });

    categoryElement.addEventListener('dragleave', () => {
      categoryElement.classList.remove('drag-over');
    });

    categoryElement.addEventListener('drop', (e) => {
      e.preventDefault();
      categoryElement.classList.remove('drag-over');
      
      // Handle category reordering
      if (e.dataTransfer.types.includes('application/x-category-index')) {
        const fromIndex = parseInt(e.dataTransfer.getData('application/x-category-index'));
        const toIndex = parseInt(categoryElement.dataset.index);
        
        if (fromIndex !== toIndex) {
          this.reorderCategories(fromIndex, toIndex);
        }
      }
    });
  }

  reorderCategories(fromIndex, toIndex) {
    this.store.dispatch({
      type: 'REORDER_CATEGORIES',
      payload: { fromIndex, toIndex }
    });
  }

  // New method to setup drag and drop functionality for any element
  setupDragAndDrop(element, categoryIndex) {
    element.addEventListener('dragover', (event) => {
      event.preventDefault();
      // Find the category container and highlight it
      const container = element.closest('.category-container');
      if (container) {
        const categoryItem = container.querySelector('.category-item');
        categoryItem.classList.add('drop-target');
      }
    });
    
    element.addEventListener('dragleave', (event) => {
      // Only remove the highlight if we're leaving the container completely
      // This prevents flicker when moving between the category and its links container
      if (!event.relatedTarget || !element.contains(event.relatedTarget)) {
        const container = element.closest('.category-container');
        if (container) {
          const categoryItem = container.querySelector('.category-item');
          categoryItem.classList.remove('drop-target');
        }
      }
    });
    
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      const container = element.closest('.category-container');
      if (container) {
        const categoryItem = container.querySelector('.category-item');
        categoryItem.classList.remove('drop-target');
      }
      
      try {
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        this.store.dispatch({
          type: 'SET_ACTIVE_CATEGORY',
          payload: { index: categoryIndex }
        });
        
        this.store.dispatch({
          type: 'ADD_LINK',
          payload: data
        });
        
        this.ui.showToast('Link added to category');
      } catch (error) {
        console.error('Error parsing drag data:', error);
      }
    });
  }
  selectCategory(index) {
    const state = this.store.getState();
    
    // If clicking on the already active category, close it
    if (state.activeCategory === index) {
      this.store.dispatch({
        type: 'SET_ACTIVE_CATEGORY',
        payload: { index: null }
      });
    } else {
      // Otherwise, set the new active category
      this.store.dispatch({
        type: 'SET_ACTIVE_CATEGORY',
        payload: { index }
      });
    }
  }

  showAddCategoryModal() {
    const state = this.store.getState();
    if (state.activeWorkspace === null) {
      this.ui.showToast('Please select a workspace first', 'error');
      return;
    }
    
    this.ui.createFormModal(
      'Add Category',
      [
        { name: 'name', label: 'Category Name', type: 'text', required: true }
      ],
      (data) => {
        this.store.dispatch({
          type: 'ADD_CATEGORY',
          payload: { name: data.name }
        });
      }
    );
  }

  showEditCategoryModal(category, index) {
    this.ui.createFormModal(
      'Edit Category',
      [
        { name: 'name', label: 'Category Name', type: 'text', required: true }
      ],
      (data) => {
        this.store.dispatch({
          type: 'EDIT_CATEGORY',
          payload: { name: data.name, index }
        });
      },
      { name: category.name }
    );
  }

  showDeleteCategoryConfirmation(index) {
    this.ui.createConfirmDialog(
      'Are you sure you want to delete this category? All links will be lost.',
      () => {
        this.store.dispatch({
          type: 'DELETE_CATEGORY',
          payload: { index }
        });
      }
    );
  }
}
