import { loginUser } from '../auth.js';
import { toast } from '../utils.js';

export function render() {
  const wrap = document.createElement('div');
  wrap.className = 'auth-wrap';
  wrap.innerHTML = `
    <div class="auth-box card fade-in">
      <div class="brand">PRECISIÓN</div>
      <p class="sub">Entra y compite.</p>
      <form id="login-form">
        <div class="field"><label>Nombre de usuario</label><input name="username" required autocomplete="username" /></div>
        <div class="field"><label>Contraseña</label><input type="password" name="password" required autocomplete="current-password" /></div>
        <p class="form-error" id="err"></p>
        <button class="btn-primary" type="submit" id="btn-login">Iniciar sesión</button>
      </form>
      <p class="form-switch">¿No tienes cuenta? <a href="#/register">Regístrate</a></p>
    </div>
  `;
  
  wrap.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errEl = wrap.querySelector('#err'); 
    const btn = wrap.querySelector('#btn-login');
    errEl.textContent = ''; btn.textContent = 'Entrando...'; btn.disabled = true;

    try {
      await loginUser(fd.get('username'), fd.get('password'));
      toast('Bienvenido', 'success'); 
      
      window.location.href = '#/';
      window.location.reload(); 
      
    } catch (err) { 
      errEl.textContent = err.message; 
      btn.textContent = 'Iniciar sesión'; btn.disabled = false;
    }
  });
  return wrap;
}