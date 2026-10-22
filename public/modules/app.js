import { $, $$, esc } from './utils.js';
import { loadContent } from './content.js';
import { getRoute, onRouteChange } from './router.js';
import { renderDashboard } from './views/dashboard.js';
import { renderProjects } from './views/projects.js';
import { renderProject } from './views/project-detail.js';
import { renderReference } from './views/reference.js';
import { renderLogin } from './views/login.js';
import { stateBox, STATE, toast } from './state.js';
import { getSession, logout } from './api.js';

let contentLoaded = false;
let currentUser = null;

async function init() {
  await loadContent();
  contentLoaded = true;
  wireLogout();
  currentUser = await getSession();
  if (!currentUser) return showLogin();
  showApp();
}

function showLogin() {
  document.body.classList.add('logged-out');
  const chip = $('#userChip');
  if (chip) chip.hidden = true;
  const out = $('#logoutBtn');
  if (out) out.hidden = true;
  renderLogin($('#main'), user => {
    currentUser = user;
    showApp();
    render();
  });
}

function showApp() {
  document.body.classList.remove('logged-out');
  const chip = $('#userChip');
  if (chip) {
    chip.hidden = false;
    chip.textContent = `${currentUser.full_name} · ${currentUser.role}`;
  }
  const out = $('#logoutBtn');
  if (out) out.hidden = false;
}

function wireLogout() {
  const out = $('#logoutBtn');
  if (!out) return;
  out.onclick = async () => {
    try { await logout(); } catch { /* sesi sudah tidak berlaku */ }
    currentUser = null;
    showLogin();
    toast('Anda sudah keluar.');
  };
}

async function render() {
  const main = $('#main');
  const { path } = getRoute();

  $$('.nav-item').forEach(a => {
    const active = (path === '/dashboard' || path === '/') && a.hash === '#/dashboard' ||
                   path.startsWith('/projects') && a.hash === '#/projects' ||
                   path.startsWith('/reference') && a.hash === '#/reference' ||
                   path.startsWith('/project/') && a.hash === '#/projects';
    a.classList.toggle('active', active);
    a.setAttribute('aria-current', active ? 'page' : 'false');
  });

  if (!currentUser) return;
  if (!contentLoaded) {
    main.innerHTML = stateBox({ state: STATE.loading });
    return;
  }

  try {
    if (path.startsWith('/project/')) await renderProject(main);
    else if (path.startsWith('/projects')) await renderProjects(main);
    else if (path.startsWith('/reference')) renderReference(main);
    else await renderDashboard(main);
  } catch (err) {
    if (err.status === 401) {
      currentUser = null;
      return showLogin();
    }
    main.innerHTML = stateBox({ state: STATE.error, error: err });
  }
}

onRouteChange(render);
init();
