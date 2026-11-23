import { registerUser } from '../auth.js';
import { toast } from '../utils.js';

export function render() {
  const wrap = document.createElement('div');
  wrap.className = 'auth-wrap';
  wrap.innerHTML = `
    <div class="auth-box card fade-in">
      <div class="brand">PRECISIÓN</div>
      <p class="sub">Crea tu cuenta para jugar.</p>
      <form id="reg-form">
        <div class="field"><label>Nombre de usuario</label><input name="username" required minlength="3" maxlength="15" placeholder="Ej: Carlos10" /></div>
        <div class="field"><label>Contraseña</label><input type="password" name="password" required minlength="6" placeholder="Mínimo 6 caracteres" /></div>
        <p class="form-error" id="err"></p>
        <button class="btn-primary" type="submit" id="btn-reg">Crear cuenta y jugar</button>
      </form>
      <p class="form-switch">¿Ya tienes cuenta? <a href="#/login">Inicia sesión</a></p>
    </div>
  `;
  
  wrap.querySelector('#reg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errEl = wrap.querySelector('#err'); 
    const btn = wrap.querySelector('#btn-reg');
    errEl.textContent = ''; btn.textContent = 'Creando cuenta...'; btn.disabled = true;

    try {
      await registerUser(fd.get('username'), fd.get('password'));
      toast('¡Cuenta creada!', 'success'); 
      
      // LA MAGIA: Fuerza la redirección limpia al inicio
      window.location.href = '#/';
      window.location.reload(); 
      
    } catch (err) { 
      errEl.textContent = err.message; 
      btn.textContent = 'Crear cuenta y jugar'; btn.disabled = false;
    }
  });
  return wrap;
}