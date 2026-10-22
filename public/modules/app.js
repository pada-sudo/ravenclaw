import { $, $$, esc } from './utils.js';
import { loadContent } from './content.js';
import { getRoute, onRouteChange } from './router.js';
import { renderDashboard } from './views/dashboard.js';
import { renderProjects } from './views/projects.js';
import { renderProject } from './views/project-detail.js';
import { renderReference } from './views/reference.js';
import { stateBox, STATE, toast } from './state.js';
import { getActor, setActor } from './api.js';
import { modal } from './components.js';

let contentLoaded = false;

async function init() {
  await loadContent();
  contentLoaded = true;
  setupActorButton();
  render();
}

function setupActorButton() {
  const btn = $('#actorToggle');
  if (!btn) return;
  btn.onclick = () => {
    const actor = getActor();
    modal({
      title: 'Identitas Operator',
      body: `<div class="form-grid">
        <div><label for="a_id">ID Operator</label><input id="a_id" name="id" value="${esc(actor.id || '')}"></div>
        <div><label for="a_name">Nama Operator</label><input id="a_name" name="name" value="${esc(actor.name || '')}"></div>
      </div>`,
      onSubmit: (data, close) => {
        setActor(data);
        close();
        toast('Identitas operator disimpan.');
      }
    });
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
    main.innerHTML = stateBox({ state: STATE.error, error: err });
  }
}

onRouteChange(render);
init();
