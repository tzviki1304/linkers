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
      categoryElement.className = `category-item ${state.activeCategory === index ? 'active' : ''}`;
      categoryElement.dataset.index = index;
      
      categoryElement.innerHTML = `
        <div class="category-content">
          <div class="category-header">
            <span class="category-name">${category.name}</span>
            <span class="category-count text-sm text-white dark:text-white">
              ${category.links?.length || 0} links
            </span>
          </div>
          <div class="actions-group">
            <button class="btn-icon btn-sm edit-category-btn" title="Edit Category">
              <span class="material-icons">edit</span>
            </button>
            <button class="btn-icon btn-sm delete-category-btn" title="Delete Category">
              <span class="material-icons">delete</span>
            </button>
          </div>
        </div>
      `;
      
      // Create a category container to hold both the category item and its links
      const categoryContainer = document.createElement('div');
      categoryContainer.className = 'category-container';
      categoryContainer.dataset.index = index;
      
      // Move the category element into the container
      categoryContainer.appendChild(categoryElement);
      this.categoriesList.appendChild(categoryContainer);
      
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
      
      // Add drag and drop functionality
      this.setupDragAndDrop(categoryElement, index);
      
      // Create a placeholder for the links container
      const linksContainer = document.createElement('div');
      linksContainer.className = 'links-container-placeholder pl-4 mb-4';
      linksContainer.dataset.categoryIndex = index;
      categoryContainer.appendChild(linksContainer);
      
      // Setup drag and drop for the links container
      this.setupDragAndDrop(linksContainer, index);
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
    this.store.dispatch({
      type: 'SET_ACTIVE_CATEGORY',
      payload: { index }
    });
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
