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
          <p>No workspaces</p>
          <button class="btn mt-2 flex items-center mx-auto">
            <span class="material-icons mr-1" style="font-size: 18px;">add</span>
            Add Workspace
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
      
      workspaceElement.innerHTML = `
        <span class="workspace-name">${workspace.name}</span>
        <div class="workspace-actions">
          <button class="btn-icon btn-sm edit-workspace-btn" title="Edit">
            <span class="material-icons" style="font-size: 16px;">edit</span>
          </button>
          <button class="btn-icon btn-sm delete-workspace-btn" title="Delete">
            <span class="material-icons" style="font-size: 16px;">delete</span>
          </button>
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
      'Add Workspace',
      [
        { name: 'name', label: 'Workspace Name', type: 'text', required: true }
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
        { name: 'name', label: 'Workspace Name', type: 'text', required: true }
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
