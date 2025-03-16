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
      this.categoriesList.innerHTML = '<div class="text-gray-500 dark:text-gray-400 text-center py-4">Select a workspace</div>';
      return;
    }
    
    const workspace = state.workspaces[state.activeWorkspace];
    
    if (workspace.categories.length === 0) {
      this.categoriesList.innerHTML = '<div class="text-gray-500 dark:text-gray-400 text-center py-4">No categories</div>';
      return;
    }
    
    workspace.categories.forEach((category, index) => {
      const categoryElement = document.createElement('div');
      categoryElement.className = `category-item ${state.activeCategory === index ? 'active' : ''}`;
      categoryElement.dataset.index = index;
      
      categoryElement.innerHTML = `
        <span class="category-name">${category.name}</span>
        <div class="category-actions">
          <button class="btn-icon btn-sm edit-category-btn" title="Edit">
            <span class="material-icons">edit</span>
          </button>
          <button class="btn-icon btn-sm delete-category-btn" title="Delete">
            <span class="material-icons">delete</span>
          </button>
        </div>
      `;
      
      this.categoriesList.appendChild(categoryElement);
      
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
      categoryElement.addEventListener('dragover', (event) => {
        event.preventDefault();
        categoryElement.classList.add('drop-target');
      });
      
      categoryElement.addEventListener('dragleave', () => {
        categoryElement.classList.remove('drop-target');
      });
      
      categoryElement.addEventListener('drop', (event) => {
        event.preventDefault();
        categoryElement.classList.remove('drop-target');
        
        try {
          const data = JSON.parse(event.dataTransfer.getData('text/plain'));
          this.store.dispatch({
            type: 'SET_ACTIVE_CATEGORY',
            payload: { index }
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
