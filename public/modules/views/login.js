import { login, ApiError } from '../api.js';

const DEMO_ACCOUNTS = [
  { username: 'operator', label: 'Operator', role: 'operator' },
  { username: 'pm', label: 'PM', role: 'pm' },
  { username: 'approver', label: 'Approver', role: 'approver' },
  { username: 'auditor', label: 'Auditor', role: 'auditor' },
];

export function renderLogin(main, onSuccess) {
  main.innerHTML = `
    <div class="login-layout">
      <div class="login-brand" aria-hidden="true">
        <div class="login-brand-inner">
          <div class="logo">DDP <span>Project Control</span></div>
          <h2>Governance Console</h2>
          <p>Kelola workflow bisnis project DDP Telkom — jalur First Responder &amp; Buffer, gate G0–G5, dan SOP-01 s/d SOP-07 dalam satu dasbor terpadu.</p>
        </div>
      </div>
      <div class="login-form-panel">
        <div class="login-card">
          <h1>Masuk</h1>
          <p class="muted">Gunakan akun peran Anda untuk mengakses DDP Project Control.</p>
          <form id="loginForm" novalidate>
            <div class="form-grid">
              <div><label for="lg_user">Username</label><input id="lg_user" name="username" autocomplete="username" required autofocus></div>
              <div><label for="lg_pass">Kata sandi</label><input id="lg_pass" name="password" type="password" autocomplete="current-password" required></div>
            </div>
            <div class="alert red" id="loginError" role="alert" hidden></div>
            <div class="actions"><button type="submit" class="btn" id="loginSubmit">Masuk</button></div>
          </form>
          <div class="demo-chips">
            <p>Akun demo — klik sekali untuk isi</p>
            <div role="group" aria-label="Akun demo">
              ${DEMO_ACCOUNTS.map(a => `<button type="button" class="demo-chip" data-demo-user="${a.username}" data-demo-pass="${a.username}" title="Masuk sebagai ${a.label}">${a.label}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const form = main.querySelector('#loginForm');
  const errorBox = main.querySelector('#loginError');
  const submit = main.querySelector('#loginSubmit');

  main.querySelectorAll('[data-demo-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      form.username.value = btn.dataset.demoUser;
      form.password.value = btn.dataset.demoPass;
      submit.focus();
    });
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errorBox.hidden = true;
    submit.disabled = true;
    try {
      const res = await login(
        form.username.value.trim(),
        form.password.value
      );
      onSuccess(res.user);
    } catch (err) {
      const message = err instanceof ApiError && err.status === 401
        ? 'Username atau kata sandi salah.'
        : (err.message || 'Gagal masuk.');
      errorBox.textContent = message;
      errorBox.hidden = false;
      submit.disabled = false;
    }
  });
}
