import { getSession, getProfile, onAuthChange, signOut } from './auth.js';
import { register, navigate, render, currentPath } from './router.js';
import { getInitials, getRank } from './utils.js';
import { supabase } from './supabase.js';

// Importación de todas las páginas
import * as loginPage from './pages/login.js';
import * as registerPage from './pages/register.js';
import * as homePage from './pages/home.js';
import * as playPage from './pages/play.js';
import * as groupsPage from './pages/groups.js';
import * as groupDetailPage from './pages/groupDetail.js';

export const state = { session: null, profile: null };

// Función de seguridad: Si no hay sesión, te manda al login
function requireAuth(fn) {
  return async (ctx) => { 
    if (!state.session) return loginPage.render(); 
    return fn(ctx); 
  };
}

// --- REGISTRO DE RUTAS ---
register('/', requireAuth(() => homePage.render()));
register('/login', () => loginPage.render());
register('/register', () => registerPage.render());
register('/play', requireAuth(() => playPage.render()));
register('/groups', requireAuth(() => groupsPage.render()));
register('/group/:id', requireAuth((ctx) => groupDetailPage.render(ctx)));

// --- RENDERIZADO DEL HEADER (Barra superior) ---
function renderHeader() {
  const header = document.getElementById('header');
  if (!state.session || !state.profile) { 
    header.classList.add('hidden'); 
    return; 
  }
  header.classList.remove('hidden');
  const { current } = getRank(state.profile.total_points);
  const path = currentPath();
  
  header.innerHTML = `
    <div class="brand">PRECISIÓN</div>
    <nav class="header-nav">
      <a href="#/" class="${path === '/' ? 'active' : ''}">Inicio</a>
      <a href="#/play" class="${path === '/play' ? 'active' : ''}">Jugar</a>
      <a href="#/groups" class="${path === '/groups' ? 'active' : ''}">Grupos</a>
    </nav>
    <div class="header-user">
      <span class="dim">${current.name}</span>
      <div class="avatar">${getInitials(state.profile.username)}</div>
      <button class="btn" style="padding:6px 10px;font-size:12px" id="logout">Salir</button>
    </div>
  `;
  
  header.querySelector('#logout').addEventListener('click', async () => { 
    await signOut(); 
    navigate('/login'); 
  });
}

// --- RENDERIZADO DEL MENÚ INFERIOR (Móvil) ---
function renderBottomNav() {
  let nav = document.querySelector('.bottom-nav');
  if (!state.session) { if (nav) nav.remove(); return; }
  
  if (!nav) { 
    nav = document.createElement('nav'); 
    nav.className = 'bottom-nav'; 
    document.body.appendChild(nav); 
  }
  
  const path = currentPath();
  nav.innerHTML = `
    <a href="#/" class="${path === '/' ? 'active' : ''}"><span class="icon">🏠</span>Inicio</a>
    <a href="#/play" class="${path === '/play' ? 'active' : ''}"><span class="icon">🎯</span>Jugar</a>
    <a href="#/groups" class="${path === '/groups' ? 'active' : ''}"><span class="icon">👥</span>Grupos</a>
  `;
}

// --- CARGAR PERFIL ---
export async function refreshProfile() {
  if (!state.session) return;
  
  try {
    let profile = await getProfile(state.session.user.id);
    
    // Si el perfil no existe, lo creamos usando los metadatos del registro
    if (!profile) {
      const userMeta = state.session.user.user_metadata;
      const username = userMeta?.username || 'Jugador_' + Math.floor(Math.random() * 1000);
      const login_key = userMeta?.login_key || username.toLowerCase();

      const { data, error } = await supabase.from('profiles').insert({
        id: state.session.user.id,
        username: username,
        login_key: login_key
      }).select().single();

      if (error) throw new Error("No se pudo crear el perfil: " + error.message);
      profile = data;
    }
    
    state.profile = profile;
    renderHeader();
  } catch (err) {
    console.error("Fallo al cargar el perfil:", err);
    // Si hay un error crítico de lectura, cerramos sesión
    await signOut();
    navigate('/login');
  }
}

// --- ARRANQUE DE LA APLICACIÓN ---
async function boot() {
  // 1. Verificar si hay sesión guardada
  state.session = await getSession();
  
  // 2. Si hay sesión, cargar el perfil
  if (state.session) {
    await refreshProfile();
  }

  // 3. Control de rutas inicial
  if (!state.session && currentPath() === '/') {
    navigate('/login');
  } else if (state.session && (currentPath() === '/login' || currentPath() === '/register')) {
    navigate('/');
  }

  renderHeader(); 
  renderBottomNav(); 
  await render();
}

// --- ESCUCHAR CAMBIOS DE AUTENTICACIÓN ---
onAuthChange(async (session) => {
  state.session = session;
  
  if (session) {
    if (!state.profile) await refreshProfile();
  } else {
    state.profile = null;
  }
  
  renderHeader(); 
  renderBottomNav();
  
  // Redirección automática si estamos en login/registro
  if (session && (currentPath() === '/login' || currentPath() === '/register')) {
    navigate('/');
  }
});

// --- ESCUCHAR CAMBIOS DE RUTA ---
window.addEventListener('hashchange', () => { 
  renderHeader(); 
  renderBottomNav(); 
});

// --- INICIAR ---
boot();