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

    // Close modal on Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.modalContainer.classList.contains('hidden')) {
        this.closeModal();
      }
    });
  }
  updateTheme(theme) {
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    
    if (theme === 'dark') {
      htmlElement.classList.add('dark');
      bodyElement.classList.add('dark');
      this.themeToggle.querySelector('.material-icons').textContent = 'light_mode';
    } else {
      htmlElement.classList.remove('dark');
      bodyElement.classList.remove('dark');
      this.themeToggle.querySelector('.material-icons').textContent = 'dark_mode';
    }
  }

  showModal(content) {
    // Add modal-open class to body to prevent background scroll
    document.body.classList.add('modal-open');
    
    // Reset modal state
    this.modalContent.style.transform = 'translateY(-20px)';
    this.modalContent.style.opacity = '0';
    this.modalContent.innerHTML = content;
    
    // Show modal
    this.modalContainer.classList.remove('hidden');
    
    // Trigger animation on next frame
    requestAnimationFrame(() => {
      this.modalContent.style.transform = 'translateY(0)';
      this.modalContent.style.opacity = '1';
    });

    // Focus first input if exists
    setTimeout(() => {
      const firstInput = this.modalContent.querySelector('input');
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
  }

  closeModal() {
    // Start close animation
    this.modalContent.style.transform = 'translateY(-20px)';
    this.modalContent.style.opacity = '0';
    
    // Remove modal-open class from body
    document.body.classList.remove('modal-open');
    
    // Hide modal after animation
    setTimeout(() => {
      this.modalContainer.classList.add('hidden');
      // Reset modal state
      this.modalContent.innerHTML = '';
      this.modalContent.style.transform = 'translateY(0)';
      this.modalContent.style.opacity = '1';
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
    
    // Show toast with animation
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translate(-50%, 0)';
    });
    
    // Hide and remove toast
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, 20px)';
      
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  createConfirmDialog(message, onConfirm) {
    const content = `
      <div class="modal-header">
        <h3 class="modal-title">Confirm Action</h3>
        <button class="modal-close" id="closeModalBtn">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="flex items-center">
          <span class="material-icons text-red-500 mr-3" style="font-size: 24px;">warning</span>
          <p class="text-gray-700 dark:text-gray-300">${message}</p>
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-actions">
          <button class="modal-btn modal-btn-secondary" id="cancelBtn">Cancel</button>
          <button class="modal-btn modal-btn-danger" id="confirmBtn">
            <span class="material-icons">delete</span>
            Confirm
          </button>
        </div>
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
        <button class="modal-close" id="closeModalBtn">
          <span class="material-icons">close</span>
        </button>
      </div>
      <form id="modalForm">
        <div class="modal-body">
    `;
    
    fields.forEach(field => {
      const value = initialValues[field.name] || '';
      formContent += `
        <div class="form-group">
          <label for="${field.name}" class="form-label">${field.label}</label>
          <input type="${field.type}" id="${field.name}" name="${field.name}" class="form-input" 
                 placeholder="${field.placeholder || `Enter ${field.label.toLowerCase()}`}" 
                 value="${value}" ${field.required ? 'required' : ''}>
        </div>
      `;
    });
    
    formContent += `
        </div>
        <div class="modal-footer">
          <div class="modal-actions">
            <button type="button" class="modal-btn modal-btn-secondary" id="cancelBtn">Cancel</button>
            <button type="submit" class="modal-btn modal-btn-primary">
              <span class="material-icons">save</span>
              Save
            </button>
          </div>
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