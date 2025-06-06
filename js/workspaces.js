class WorkspacesManager {
  constructor(store, ui) {
    this.store = store;
    this.ui = ui;
    this.workspacesList = document.getElementById('workspacesList');
    this.addWorkspaceBtn = document.getElementById('addWorkspaceBtn');
    
    this.init();
  }

  init() {
    this.initEventListeners();
  }

  initEventListeners() {
    this.addWorkspaceBtn.addEventListener('click', () => {
      this.showAddWorkspaceModal();
    });
  }

  renderWorkspaces(state) {
    this.workspacesList.innerHTML = '';
    
    if (state.workspaces.length === 0) {
      this.workspacesList.innerHTML = `
        <div class="empty-message">
          <span class="material-icons">dashboard</span>
          <p>No workspaces yet</p>
          <button class="btn mt-3 flex items-center gap-2 mx-auto">
            <span class="material-icons" style="font-size: 20px;">add_circle</span>
            Create Workspace
          </button>
        </div>`;
      
      this.workspacesList.querySelector('button').addEventListener('click', () => {
        this.showAddWorkspaceModal();
      });
      return;
    }
    
    state.workspaces.forEach((workspace, index) => {
      const workspaceElement = document.createElement('div');
      workspaceElement.className = `workspace-item ${state.activeWorkspace === index ? 'active' : ''}`;
      workspaceElement.dataset.index = index;
      workspaceElement.draggable = true;
        workspaceElement.innerHTML = `
        <div class="workspace-content">
          <div class="workspace-header">
            <span class="workspace-name">
              <span class="material-icons">dashboard</span>
              ${workspace.name}
            </span>
          </div>
          <div class="actions-group">
            <button class="btn-icon btn-sm edit-workspace-btn" title="Edit Workspace">
              <span class="material-icons">edit</span>
            </button>
            <button class="btn-icon btn-sm delete-workspace-btn" title="Delete Workspace">
              <span class="material-icons">delete</span>
            </button>
          </div>
        </div>
      `;
      
      this.workspacesList.appendChild(workspaceElement);
        // Add click listener to select workspace
      workspaceElement.addEventListener('click', (event) => {
        if (!event.target.closest('button')) {
          this.selectWorkspace(index);
        }
      });
      
      // Add edit button listener
      workspaceElement.querySelector('.edit-workspace-btn').addEventListener('click', () => {
        this.showEditWorkspaceModal(workspace, index);
      });
      
      // Add delete button listener
      workspaceElement.querySelector('.delete-workspace-btn').addEventListener('click', () => {
        this.showDeleteWorkspaceConfirmation(index);
      });
      
      // Add drag events
      this.addDragEvents(workspaceElement);
    });
  }

  addDragEvents(workspaceElement) {
    workspaceElement.addEventListener('dragstart', (e) => {
      // Add a class to show it's being dragged
      workspaceElement.classList.add('dragging');
      // Store the original index
      e.dataTransfer.setData('text/plain', workspaceElement.dataset.index);
    });

    workspaceElement.addEventListener('dragend', () => {
      workspaceElement.classList.remove('dragging');
    });

    workspaceElement.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    workspaceElement.addEventListener('dragenter', (e) => {
      e.preventDefault();
      workspaceElement.classList.add('drag-over');
    });

    workspaceElement.addEventListener('dragleave', () => {
      workspaceElement.classList.remove('drag-over');
    });

    workspaceElement.addEventListener('drop', (e) => {
      e.preventDefault();
      workspaceElement.classList.remove('drag-over');
      
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = parseInt(workspaceElement.dataset.index);
      
      if (fromIndex !== toIndex) {
        this.reorderWorkspaces(fromIndex, toIndex);
      }
    });
  }

  reorderWorkspaces(fromIndex, toIndex) {
    this.store.dispatch({
      type: 'REORDER_WORKSPACES',
      payload: { fromIndex, toIndex }
    });
  }

  selectWorkspace(index) {
    this.store.dispatch({
      type: 'SET_ACTIVE_WORKSPACE',
      payload: { index }
    });
  }

  showAddWorkspaceModal() {
    this.ui.createFormModal(
      'Add New Workspace',
      [
        { name: 'name', label: 'Workspace Name', type: 'text', required: true, placeholder: 'Enter a name for your workspace' }
      ],
      (data) => {
        this.store.dispatch({
          type: 'ADD_WORKSPACE',
          payload: { name: data.name }
        });
      }
    );
  }

  showEditWorkspaceModal(workspace, index) {
    this.ui.createFormModal(
      'Edit Workspace',
      [
        { name: 'name', label: 'Workspace Name', type: 'text', required: true, placeholder: 'Enter a new name' }
      ],
      (data) => {
        this.store.dispatch({
          type: 'EDIT_WORKSPACE',
          payload: { name: data.name, index }
        });
      },
      { name: workspace.name }
    );
  }

  showDeleteWorkspaceConfirmation(index) {
    this.ui.createConfirmDialog(
      'Are you sure you want to delete this workspace? All categories and links will be lost.',
      () => {
        this.store.dispatch({
          type: 'DELETE_WORKSPACE',
          payload: { index }
        });
      }
    );
  }
}
