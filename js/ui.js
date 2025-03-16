class UI {
  constructor(store) {
    this.store = store;
    this.modalContainer = document.getElementById('modalContainer');
    this.modalContent = document.getElementById('modalContent');
    this.themeToggle = document.getElementById('themeToggle');
    this.exportBtn = document.getElementById('exportBtn');
    this.importBtn = document.getElementById('importBtn');
    this.importFile = document.getElementById('importFile');
    
    this.initEventListeners();
  }

  initEventListeners() {
    // Theme toggle
    this.themeToggle.addEventListener('click', () => {
      this.store.dispatch({
        type: 'TOGGLE_THEME'
      });
    });

    // Export button
    this.exportBtn.addEventListener('click', () => {
      this.store.exportData();
    });

    // Import button
    this.importBtn.addEventListener('click', () => {
      this.importFile.click();
    });

    // Import file change
    this.importFile.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const success = await this.store.importData(e.target.result);
          if (success) {
            this.showToast('Data imported successfully');
          } else {
            this.showToast('Error importing data', 'error');
          }
          this.importFile.value = '';
        };
        reader.readAsText(file);
      }
    });
    
    // Close modal when clicking outside
    this.modalContainer.addEventListener('click', (event) => {
      if (event.target === this.modalContainer) {
        this.closeModal();
      }
    });
  }

  updateTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      this.themeToggle.querySelector('.material-icons').textContent = 'light_mode';
    } else {
      document.documentElement.classList.remove('dark');
      this.themeToggle.querySelector('.material-icons').textContent = 'dark_mode';
    }
    
    // Add a transition effect when switching themes
    document.body.classList.add('theme-transition');
    setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, 300);
  }

  showModal(content) {
    this.modalContent.innerHTML = content;
    this.modalContainer.classList.remove('hidden');
    
    // Add focus to the first input if exists
    setTimeout(() => {
      const firstInput = this.modalContent.querySelector('input');
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
  }

  closeModal() {
    // Add a fade-out effect
    this.modalContainer.style.opacity = '0';
    
    setTimeout(() => {
      this.modalContainer.classList.add('hidden');
      this.modalContainer.style.opacity = '1';
    }, 300);
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconName = type === 'success' ? 'check_circle' : 'error';
    
    toast.innerHTML = `
      <div class="toast-icon">
        <span class="material-icons">${iconName}</span>
      </div>
      <div class="toast-message">${message}</div>
    `;
    
    document.body.appendChild(toast);
    
    // Ensure the toast is visible before setting transition
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, 10px)';
      toast.style.transition = 'all 0.3s ease';
      
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  createConfirmDialog(message, onConfirm) {
    const content = `
      <div class="modal-header">
        <h3 class="modal-title">Confirm Action</h3>
        <button class="modal-close" id="closeModalBtn"></button>
      </div>
      <div class="modal-content-body">
        <div class="flex items-center">
          <span class="material-icons text-red-500 mr-3" style="font-size: 24px;">warning</span>
          <p>${message}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-secondary" id="cancelBtn">Cancel</button>
        <button class="modal-btn modal-btn-danger" id="confirmBtn">
          <span class="material-icons" style="font-size: 18px; margin-right: 6px;">delete</span>
          Confirm
        </button>
      </div>
    `;
    
    this.showModal(content);
    
    document.getElementById('closeModalBtn').addEventListener('click', () => this.closeModal());
    document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
    document.getElementById('confirmBtn').addEventListener('click', () => {
      onConfirm();
      this.closeModal();
    });
  }

  createFormModal(title, fields, onSubmit, initialValues = {}) {
    let formContent = `
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" id="closeModalBtn"></button>
      </div>
      <form id="modalForm">
    `;
    
    fields.forEach(field => {
      const value = initialValues[field.name] || '';
      formContent += `
        <div class="form-group">
          <label for="${field.name}" class="form-label">${field.label}</label>
          <input type="${field.type}" id="${field.name}" name="${field.name}" class="form-input" 
                 placeholder="Enter ${field.label.toLowerCase()}" value="${value}" ${field.required ? 'required' : ''}>
        </div>
      `;
    });
    
    formContent += `
        <div class="modal-footer">
          <button type="button" class="modal-btn modal-btn-secondary" id="cancelBtn">Cancel</button>
          <button type="submit" class="modal-btn modal-btn-primary">
            <span class="material-icons">save</span>
            Save
          </button>
        </div>
      </form>
    `;
    
    this.showModal(formContent);
    
    document.getElementById('closeModalBtn').addEventListener('click', () => this.closeModal());
    document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
    
    document.getElementById('modalForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(event.target);
      const data = {};
      
      fields.forEach(field => {
        data[field.name] = formData.get(field.name);
      });
      
      onSubmit(data);
      this.closeModal();
    });
  }
}
