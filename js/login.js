(function (window, document) {
  'use strict';

  const REMEMBER_KEY = 'smartshuttle.login.identifier.v1';
  const DEMO_DELAY = 650;

  const form = document.getElementById('login-form');
  const identifier = document.getElementById('login-identifier');
  const password = document.getElementById('login-password');
  const remember = document.getElementById('login-remember');
  const passwordToggle = document.getElementById('login-password-toggle');
  const submit = document.getElementById('login-submit');
  const submitText = document.getElementById('login-submit-text');
  const alertBox = document.getElementById('login-alert');
  const alertText = document.getElementById('login-alert-text');
  const register = document.getElementById('login-register');
  const identifierError = document.getElementById('login-identifier-error');
  const passwordError = document.getElementById('login-password-error');

  if (!form || !identifier || !password || !remember || !passwordToggle || !submit || !alertBox) {
    return;
  }

  let submitting = false;

  function readRememberedIdentifier() {
    try {
      return window.localStorage.getItem(REMEMBER_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function saveRememberedIdentifier(value) {
    try {
      if (value) {
        window.localStorage.setItem(REMEMBER_KEY, value);
      } else {
        window.localStorage.removeItem(REMEMBER_KEY);
      }
    } catch (error) {
      return;
    }
  }

  function setFieldError(input, errorElement, message) {
    input.setAttribute('aria-invalid', 'true');
    errorElement.textContent = message;
    errorElement.hidden = false;
  }

  function clearFieldError(input, errorElement) {
    input.removeAttribute('aria-invalid');
    errorElement.textContent = '';
    errorElement.hidden = true;
  }

  function hideAlert() {
    alertBox.hidden = true;
    alertBox.classList.remove('is-warning');
    if (alertText) {
      alertText.textContent = '';
    }
  }

  function showAlert(message, tone) {
    if (!alertText) {
      return;
    }
    alertText.textContent = message;
    alertBox.classList.toggle('is-warning', tone === 'warning');
    alertBox.hidden = false;
    alertBox.focus({ preventScroll: false });
  }

  function validate() {
    const identifierValue = identifier.value.trim();
    const passwordValue = password.value;
    let firstInvalid = null;

    clearFieldError(identifier, identifierError);
    clearFieldError(password, passwordError);

    if (!identifierValue) {
      setFieldError(identifier, identifierError, 'Masukkan email atau username.');
      firstInvalid = identifier;
    }

    if (!passwordValue) {
      setFieldError(password, passwordError, 'Masukkan password.');
      if (!firstInvalid) {
        firstInvalid = password;
      }
    }

    return {
      valid: !firstInvalid,
      firstInvalid,
      identifierValue
    };
  }

  function setLoading(isLoading) {
    submitting = isLoading;
    submit.disabled = isLoading;
    submit.classList.toggle('is-loading', isLoading);
    submit.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    if (submitText) {
      submitText.textContent = isLoading ? 'Memeriksa...' : 'Masuk';
    }
  }

  function restoreRememberedIdentifier() {
    const remembered = readRememberedIdentifier();
    if (!remembered) {
      return;
    }
    identifier.value = remembered;
    remember.checked = true;
  }

  function handlePasswordToggle() {
    const isVisible = password.type === 'text';
    password.type = isVisible ? 'password' : 'text';
    passwordToggle.setAttribute('aria-pressed', isVisible ? 'false' : 'true');
    passwordToggle.setAttribute('aria-label', isVisible ? 'Tampilkan password' : 'Sembunyikan password');
    password.focus({ preventScroll: true });
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    hideAlert();
    const result = validate();
    if (!result.valid) {
      result.firstInvalid.focus();
      return;
    }

    identifier.value = result.identifierValue;
    saveRememberedIdentifier(remember.checked ? result.identifierValue : '');
    setLoading(true);

    window.setTimeout(() => {
      setLoading(false);
      showAlert('Form sudah valid. Mode demo ini belum terhubung ke server autentikasi, jadi tidak ada sesi yang dibuat.');
    }, DEMO_DELAY);
  }

  function handleRegisterNotice() {
    showAlert('Pendaftaran akun belum tersedia pada demo SmartShuttle ini.', 'warning');
  }

  identifier.addEventListener('input', () => {
    clearFieldError(identifier, identifierError);
    hideAlert();
  });

  password.addEventListener('input', () => {
    clearFieldError(password, passwordError);
    hideAlert();
  });

  passwordToggle.addEventListener('click', handlePasswordToggle);
  register.addEventListener('click', handleRegisterNotice);
  form.addEventListener('submit', handleSubmit);

  restoreRememberedIdentifier();
})(window, document);
