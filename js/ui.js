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
  }

  showModal(content) {
    this.modalContent.innerHTML = content;
    this.modalContainer.classList.remove('hidden');
  }

  closeModal() {
    this.modalContainer.classList.add('hidden');
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  createConfirmDialog(message, onConfirm) {
    const content = `
      <div class="modal-header">
        <h3 class="modal-title">Confirm</h3>
        <button class="modal-close" id="closeModalBtn">×</button>
      </div>
      <div class="p-2">
        <p class="text-gray-700 dark:text-gray-300">${message}</p>
        <div class="modal-footer">
          <button class="btn bg-gray-300 text-gray-700 hover:bg-gray-400" id="cancelBtn">Cancel</button>
          <button class="btn bg-red-500 hover:bg-red-600" id="confirmBtn">Confirm</button>
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
        <button class="modal-close" id="closeModalBtn">×</button>
      </div>
      <form id="modalForm">
    `;
    
    fields.forEach(field => {
      const value = initialValues[field.name] || '';
      formContent += `
        <div class="form-group">
          <label for="${field.name}" class="form-label">${field.label}</label>
          <input type="${field.type}" id="${field.name}" name="${field.name}" class="form-input" value="${value}" ${field.required ? 'required' : ''}>
        </div>
      `;
    });
    
    formContent += `
        <div class="modal-footer">
          <button type="button" class="btn bg-gray-300 text-gray-700 hover:bg-gray-400" id="cancelBtn">Cancel</button>
          <button type="submit" class="btn">Save</button>
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
