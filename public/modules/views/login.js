import { login, ApiError } from '../api.js';

export function renderLogin(main, onSuccess) {
  main.innerHTML = `
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
    </div>`;

  const form = main.querySelector('#loginForm');
  const errorBox = main.querySelector('#loginError');
  const submit = main.querySelector('#loginSubmit');

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
