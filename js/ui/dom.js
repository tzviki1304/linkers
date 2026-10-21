// DOM helpers: element builder (text is always set safely, never as HTML),
// toasts with undo, modals, forms, confirm dialogs and dropdown/context menus.
(function (g) {
  const LS = (g.LS = g.LS || {});
  const icon = (...a) => LS.icon(...a);
  const t = (...a) => LS.i18n.t(...a);

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    append(el, children);
    return el;
  }

  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  // ---------- toasts ----------
  function toast(message, opts = {}) {
    let host = document.getElementById('toasts');
    if (!host) host = document.body.appendChild(h('div', { id: 'toasts', class: 'toasts', role: 'status', 'aria-live': 'polite' }));
    const type = opts.type || 'success';
    const ico = { success: 'check', error: 'alert', info: 'link' }[type];
    const el = h('div', { class: `toast toast-${type}` }, icon(ico, 16), h('span', { class: 'toast-msg' }, message));
    let timer;
    const dismiss = () => {
      clearTimeout(timer);
      el.classList.remove('show');
      setTimeout(() => el.remove(), 200);
    };
    if (opts.action) {
      el.appendChild(h('button', { class: 'toast-action', onclick: () => { dismiss(); opts.action.run(); } }, opts.action.label));
    }
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    timer = setTimeout(dismiss, opts.duration || (opts.action ? 7000 : 2600));
    return dismiss;
  }

  // ---------- modals ----------
  const stack = [];

  function modal({ title, subtitle, body, footer, size = 'md', onClose, className = '' }) {
    const prevFocus = document.activeElement;
    const backdrop = h('div', { class: 'modal-backdrop' });
    const dialog = h('div', { class: `modal modal-${size} ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' });
    if (title) {
      dialog.appendChild(h('div', { class: 'modal-head' },
        h('div', null, h('h2', { class: 'modal-title' }, title), subtitle ? h('p', { class: 'modal-sub' }, subtitle) : null),
        h('button', { class: 'icon-btn', title: t('common.close'), 'aria-label': t('common.close'), onclick: () => api.close() }, icon('x'))));
    }
    dialog.appendChild(h('div', { class: 'modal-body' }, body));
    if (footer) dialog.appendChild(h('div', { class: 'modal-foot' }, footer));
    backdrop.appendChild(dialog);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) api.close(); });
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('open'));

    const api = {
      el: dialog,
      close() {
        if (!backdrop.isConnected) return;
        const i = stack.indexOf(api);
        if (i !== -1) stack.splice(i, 1);
        backdrop.classList.remove('open');
        setTimeout(() => backdrop.remove(), 160);
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        if (onClose) onClose();
      },
    };
    stack.push(api);
    setTimeout(() => {
      const f = dialog.querySelector('[autofocus]') || dialog.querySelector('input:not([type=hidden]), select, textarea');
      if (f) { f.focus(); if (f.select && f.type !== 'url') f.select(); }
    }, 40);
    return api;
  }

  const topModal = () => stack[stack.length - 1] || null;

  // fields: [{ name, label, type: text|url|textarea|select|swatches, value, placeholder, required, options, hint, maxlength }]
  function formModal({ title, subtitle, fields, submitLabel = t('common.save'), onSubmit, danger }) {
    const inputs = {};
    const form = h('form', { class: 'form', novalidate: true });
    for (const f of fields) {
      const id = 'f_' + f.name + '_' + Math.random().toString(36).slice(2, 6);
      let control;
      if (f.type === 'textarea') {
        control = h('textarea', { id, name: f.name, class: 'input', rows: f.rows || 3, placeholder: f.placeholder || '', dir: 'auto', value: f.value || '' });
      } else if (f.type === 'select') {
        control = h('select', { id, name: f.name, class: 'input' },
          f.options.map((o) => o.group
            ? h('optgroup', { label: o.group }, o.options.map((x) => h('option', { value: x.value, selected: x.value === f.value }, x.label)))
            : h('option', { value: o.value, selected: o.value === f.value }, o.label)));
      } else if (f.type === 'swatches') {
        let current = f.value;
        control = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': f.label });
        control.value = current;
        for (const name of LS.data.COLOR_NAMES) {
          const b = h('button', {
            type: 'button', class: 'swatch' + (name === current ? ' selected' : ''), title: name,
            'aria-label': name, style: { '--sw': LS.data.COLORS[name] },
            onclick: () => {
              current = name;
              control.value = name;
              control.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('selected', s === b));
            },
          });
          control.appendChild(b);
        }
      } else {
        control = h('input', {
          id, name: f.name, type: f.type || 'text', class: 'input', placeholder: f.placeholder || '',
          value: f.value || '', autocomplete: 'off', spellcheck: 'false', maxlength: f.maxlength, dir: f.type === 'url' ? 'ltr' : 'auto',
        });
      }
      if (f.autofocus) control.setAttribute('autofocus', '');
      inputs[f.name] = control;
      form.appendChild(h('div', { class: 'field' },
        h('label', { class: 'label', for: id }, f.label, f.optional ? h('span', { class: 'label-opt' }, t('form.optional')) : null),
        control,
        f.hint ? h('div', { class: 'hint' }, f.hint) : null));
    }
    const error = h('div', { class: 'form-error', role: 'alert' });
    form.appendChild(error);
    form.appendChild(h('button', { type: 'submit', hidden: true }));

    const submit = async (e) => {
      if (e) e.preventDefault();
      const values = {};
      for (const f of fields) {
        values[f.name] = typeof inputs[f.name].value === 'string' ? inputs[f.name].value.trim() : inputs[f.name].value;
        if (f.required && !values[f.name]) {
          error.textContent = t('form.required', { label: f.label });
          inputs[f.name].focus();
          return;
        }
      }
      const result = await onSubmit(values);
      if (typeof result === 'string') { error.textContent = result; return; }
      m.close();
    };
    form.addEventListener('submit', submit);
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
    });

    const m = modal({
      title, subtitle, body: form, size: 'sm',
      footer: [
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')),
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'button', onclick: submit }, submitLabel),
      ],
    });
    return m;
  }

  function confirmDialog({ title, message, confirmLabel = t('common.delete'), danger = true, onConfirm }) {
    const m = modal({
      title, size: 'sm',
      body: h('p', { class: 'confirm-text' }, message),
      footer: [
        h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, t('common.cancel')),
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, autofocus: true, onclick: () => { m.close(); onConfirm(); } }, confirmLabel),
      ],
    });
    return m;
  }

  // ---------- menus ----------
  let openMenuEl = null;
  let openMenuAnchor = null;

  function closeMenu() {
    if (!openMenuEl) return false;
    openMenuEl.remove();
    if (openMenuAnchor) openMenuAnchor.classList.remove('menu-open');
    openMenuEl = null;
    openMenuAnchor = null;
    document.removeEventListener('mousedown', onOutside, true);
    return true;
  }

  function onOutside(e) {
    if (openMenuEl && !openMenuEl.contains(e.target)) closeMenu();
  }

  // items: [{ label, icon, run, danger, hint, disabled } | 'sep' | { header }]
  // at: an element (menu opens under it) or a {x, y} point (context menu)
  function menu(items, at) {
    const toggleSame = at instanceof Element && at === openMenuAnchor;
    closeMenu();
    if (toggleSame) return;
    const el = h('div', { class: 'menu', role: 'menu' });
    for (const it of items) {
      if (!it) continue;
      if (it === 'sep') { el.appendChild(h('div', { class: 'menu-sep' })); continue; }
      if (it.header) { el.appendChild(h('div', { class: 'menu-header' }, it.header)); continue; }
      el.appendChild(h('button', {
        class: 'menu-item' + (it.danger ? ' danger' : ''), role: 'menuitem', disabled: it.disabled,
        onclick: (e) => { e.stopPropagation(); closeMenu(); it.run(); },
      }, it.icon ? icon(it.icon, 16) : h('span', { class: 'menu-spacer' }), h('span', { class: 'menu-label' }, it.label),
      it.hint ? h('span', { class: 'menu-hint' }, it.hint) : null));
    }
    document.body.appendChild(el);

    const r = el.getBoundingClientRect();
    let x, y;
    if (at instanceof Element) {
      const a = at.getBoundingClientRect();
      const rtl = document.documentElement.dir === 'rtl';
      x = rtl ? a.left : a.right - r.width;
      y = a.bottom + 6;
      if (x < 8) x = a.left;
      if (x + r.width > innerWidth - 8) x = a.right - r.width;
      if (y + r.height > innerHeight - 8) y = a.top - r.height - 6;
      openMenuAnchor = at;
      at.classList.add('menu-open');
    } else {
      x = at.x;
      y = at.y;
      if (x + r.width > innerWidth - 8) x = innerWidth - r.width - 8;
      if (y + r.height > innerHeight - 8) y = innerHeight - r.height - 8;
    }
    el.style.left = Math.max(8, x) + 'px';
    el.style.top = Math.max(8, y) + 'px';
    openMenuEl = el;
    setTimeout(() => document.addEventListener('mousedown', onOutside, true));
    const first = el.querySelector('.menu-item:not([disabled])');
    if (first) first.focus();
  }

  // Arrow-key navigation inside menus
  document.addEventListener('keydown', (e) => {
    if (openMenuEl && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const items = [...openMenuEl.querySelectorAll('.menu-item:not([disabled])')];
      const i = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next].focus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (closeMenu()) { e.preventDefault(); return; }
    const top = topModal();
    if (top) { e.preventDefault(); top.close(); }
  });
  addEventListener('blur', closeMenu);
  addEventListener('resize', closeMenu);
  document.addEventListener('scroll', closeMenu, true);

  // ---------- misc ----------
  const timeAgo = (ts) => LS.i18n.timeAgo(ts);

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsText(file);
    });
  }

  function pickFile(accept = '.json,application/json') {
    return new Promise((resolve) => {
      const input = h('input', { type: 'file', accept, style: { display: 'none' } });
      input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); });
      document.body.appendChild(input);
      input.click();
    });
  }

  function downloadText(text, filename) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = h('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Real site icon. Tries each source in turn (saved tab icon, Google, Chrome's cache)
  // and only shows the first letter of the domain if all of them fail.
  function favicon(url, savedIcon = '', cls = 'fav') {
    const useGoogle = !LS.store || !LS.store.data || LS.store.settings.googleIcons !== false;
    const sources = LS.data.iconSources(url, savedIcon, useGoogle);
    let i = 0;
    const img = h('img', { class: cls, src: sources[0], alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => {
      i++;
      if (i < sources.length) { img.src = sources[i]; return; }
      img.replaceWith(h('span', { class: cls + ' fav-letter' }, (LS.data.domainOf(url)[0] || '?').toUpperCase()));
    });
    return img;
  }

  function isTyping(e) {
    const t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  LS.dom = { h, append, toast, modal, topModal, formModal, confirmDialog, menu, closeMenu, timeAgo, readFile, pickFile, downloadText, isTyping, favicon };
})(self);
