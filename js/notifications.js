(function (window) {
  'use strict';

  const Storage = window.SmartShuttleStorage;

  const state = {
    dialog: null,
    previousFocus: null,
    onClose: null,
    initialized: false
  };

  const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    error: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
    warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>'
  };

  function escapeHTML(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, (character) => ESCAPE_MAP[character]);
  }

  function init() {
    if (state.initialized) {
      return;
    }

    state.dialog = document.getElementById('app-modal');
    if (!state.dialog) {
      return;
    }

    const closeButton = state.dialog.querySelector('.modal-close');
    if (closeButton) {
      closeButton.addEventListener('click', closeModal);
    }

    state.dialog.addEventListener('click', (event) => {
      if (event.target === state.dialog) {
        closeModal();
      }
    });

    state.dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('modal-open');
      const callback = state.onClose;
      state.onClose = null;
      if (state.previousFocus && typeof state.previousFocus.focus === 'function') {
        state.previousFocus.focus({ preventScroll: true });
      }
      state.previousFocus = null;
      if (typeof callback === 'function') {
        callback();
      }
    });

    state.initialized = true;
  }

  function closeModal() {
    if (state.dialog && state.dialog.open) {
      state.dialog.close();
    }
  }

  function openModal(options) {
    init();
    const config = options || {};
    if (!state.dialog) {
      return null;
    }

    if (state.dialog.open) {
      state.onClose = null;
      state.dialog.close();
    }

    const title = state.dialog.querySelector('#app-modal-title');
    const body = state.dialog.querySelector('#app-modal-body');
    const footer = state.dialog.querySelector('#app-modal-footer');
    const closeButton = state.dialog.querySelector('.modal-close');

    if (title) {
      title.textContent = config.title || 'Informasi';
    }
    if (body) {
      body.innerHTML = config.bodyHTML || '';
    }
    if (footer) {
      footer.innerHTML = '';
      const actions = Array.isArray(config.actions) ? config.actions : [];

      actions.forEach((action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn btn--${action.variant || 'secondary'}`;
        if (action.block) {
          button.classList.add('btn--block');
        }
        button.textContent = action.label || 'Tutup';
        button.addEventListener('click', () => {
          if (typeof action.onClick === 'function') {
            action.onClick();
          }
          if (action.close !== false) {
            closeModal();
          }
        });
        footer.appendChild(button);
      });

      footer.hidden = actions.length === 0;
    }

    state.dialog.classList.toggle('app-modal--wide', config.size === 'wide');
    state.previousFocus = document.activeElement;
    state.onClose = typeof config.onClose === 'function' ? config.onClose : null;
    document.documentElement.classList.add('modal-open');
    state.dialog.showModal();

    if (config.focusBody && body) {
      body.setAttribute('tabindex', '-1');
      body.focus({ preventScroll: true });
    } else if (closeButton) {
      closeButton.focus({ preventScroll: true });
    }

    if (typeof config.onOpen === 'function') {
      config.onOpen(state.dialog);
    }

    return state.dialog;
  }

  function confirm(options) {
    const config = options || {};

    return new Promise((resolve) => {
      let settled = false;

      function finish(value) {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      }

      openModal({
        title: config.title || 'Konfirmasi',
        bodyHTML: config.bodyHTML || '',
        onClose: () => finish(false),
        actions: [
          {
            label: config.cancelLabel || 'Batal',
            variant: 'secondary',
            onClick: () => finish(false)
          },
          {
            label: config.confirmLabel || 'Ya, lanjutkan',
            variant: config.variant || 'primary',
            onClick: () => finish(true)
          }
        ]
      });
    });
  }

  function removeToast(toast) {
    if (!toast || !toast.parentNode) {
      return;
    }
    toast.classList.add('toast--leaving');
    window.setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 220);
  }

  function toast(type, message) {
    const region = document.getElementById('toast-region');
    if (!region) {
      return;
    }

    const allowedType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    const element = document.createElement('div');
    element.className = `toast toast--${allowedType}`;
    element.setAttribute('role', allowedType === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.innerHTML = TOAST_ICONS[allowedType];

    const content = document.createElement('p');
    content.className = 'toast__message';
    content.textContent = String(message || '');

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__close';
    close.setAttribute('aria-label', 'Tutup notifikasi');
    close.textContent = '×';
    close.addEventListener('click', () => removeToast(element));

    element.appendChild(icon);
    element.appendChild(content);
    element.appendChild(close);
    region.appendChild(element);

    while (region.children.length > 4) {
      region.removeChild(region.firstElementChild);
    }

    window.setTimeout(() => removeToast(element), 5200);
  }

  function success(message) {
    toast('success', message);
  }

  function error(message) {
    toast('error', message);
  }

  function info(message) {
    toast('info', message);
  }

  function warning(message) {
    toast('warning', message);
  }

  function notify(options) {
    const config = options || {};
    if (!Storage || typeof Storage.addNotification !== 'function') {
      return null;
    }

    const settings = Storage.getSettings();
    if (!settings.notificationsEnabled) {
      return null;
    }

    const notification = Storage.addNotification({
      type: config.type || 'info',
      title: config.title || 'Notifikasi SmartShuttle',
      message: config.message || config.title || '',
      eventKey: config.eventKey || '',
      code: config.code || '',
      createdAt: config.createdAt
    });

    if (notification && config.toast !== false) {
      toast(notification.type, notification.message || notification.title);
    }

    return notification;
  }

  window.SmartShuttleNotifications = {
    init,
    openModal,
    closeModal,
    confirm,
    toast,
    success,
    error,
    info,
    warning,
    notify,
    escapeHTML
  };
})(window);
