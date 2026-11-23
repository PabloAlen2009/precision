import { supabase } from '../supabase.js';
import { state } from '../app.js';
import { getRank, formatNumber, escapeHtml } from '../utils.js';
import { navigate } from '../router.js';

export async function render() {
  const el = document.createElement('div');
  el.className = 'container fade-in';
  const p = state.profile;

  // 1. Último reto
  const { data: lastChallenge } = await supabase
    .from('daily_challenges')
    .select('id, challenge_date')
    .order('challenge_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  let result = null;
  if (lastChallenge) {
    const { data } = await supabase
      .from('results')
      .select('score, answers')
      .eq('user_id', p.id)
      .eq('challenge_id', lastChallenge.id)
      .maybeSingle();
    result = data;
  }

  // 2. Grupos
  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id, groups(id, name, icon)')
    .eq('user_id', p.id);

  const { current, next } = getRank(p.total_points);

  // 3. Desglose de respuestas
  let respuestasHtml = '';
  if (result && result.answers && result.answers.length > 0) {
    respuestasHtml = `
      <div class="card" style="margin-top:16px; background: rgba(0,0,0,0.4); border-color: #333;">
        <h3 style="margin-bottom:12px; font-size:14px; color: var(--text-dim)">Tus respuestas de hoy</h3>
        ${result.answers.map((b, i) => `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #222; padding:10px 0; font-size:13px;">
            <span class="dim">Pregunta ${i+1}</span>
            <span style="text-align:right;">Tú: <strong>${formatNumber(b.given)}</strong> <br> Real: <strong style="color:var(--gold)">${formatNumber(b.correct)}</strong></span>
            <span style="color:var(--gold); font-weight:800; font-size:15px;">+${b.points}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 4. Lógica visual de la racha
  const fireClass = p.current_streak >= 30 ? 'streak-fire mega' : 'streak-fire';

  // 5. Render
  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
      <div>
        <h1 style="margin:0; font-size:28px;">Hola, ${p.username} 👋</h1>
        <p class="dim" style="margin:4px 0 0 0;">Rango: <strong>${current.name}</strong></p>
      </div>
      
      <!-- NUEVA CÁPSULA DE PUNTOS -->
      <div style="background: var(--gold-gradient); color: #000; padding: 8px 16px; border-radius: 99px; font-weight: 900; font-size: 16px; display:flex; align-items:center; gap:6px; box-shadow: 0 4px 15px rgba(250,204,21,0.3);">
        <span style="font-size: 18px;">⭐</span> ${formatNumber(p.total_points)}
      </div>
    </div>
    
    <div class="card card-gold" style="margin-top:10px; border: 1px solid var(--border-highlight);">
      <h2>Reto de hoy</h2>
      ${result 
        ? `<p class="dim">Puntuación obtenida:</p>
           <p class="big-number" style="color: var(--gold); font-size: 64px; line-height: 1; margin: 10px 0;">${formatNumber(result.score)}</p>
           <p class="dim">de 5.000 puntos</p>
           
           <!-- CUENTA ATRÁS -->
           <div class="countdown-box">
             <p class="dim" style="margin-bottom:8px; font-size:12px; text-transform:uppercase; letter-spacing:1px;">Próximo reto en</p>
             <div class="countdown-time" id="countdown">--:--:--</div>
           </div>
           
           ${respuestasHtml}`
        : `<p class="dim" style="margin-bottom:14px">5 preguntas. 5.000 puntos posibles. Un intento.</p>
           <button class="btn-primary" id="play-btn" style="font-size:18px;">Jugar ahora</button>`
      }
    </div>

    <div class="card">
      <h3>Progreso de rango</h3>
      <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;">
        <span class="dim">${current.name}</span>
        <span class="dim">${next ? next.name : 'Máximo'}</span>
      </div>
      <div style="height:8px; background:var(--bg-elev); border-radius:4px; overflow:hidden; margin-bottom:10px;">
        <div style="height:100%; background:var(--gold); width:${next ? Math.min(100, ((p.total_points - current.min) / (next.min - current.min)) * 100) : 100}%;"></div>
      </div>
      <p class="dim" style="font-size:12px;">${formatNumber(p.total_points)} pts${next ? ` · faltan ${formatNumber(next.min - p.total_points)} para subir` : ''}</p>
    </div>

    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h3 style="margin:0">Racha</h3>
        <p class="dim" style="margin:0; font-size:12px;">Mejor racha: ${p.best_streak} días</p>
      </div>
      <div style="text-align:right;">
        <div class="${fireClass}">🔥</div>
        <p style="margin:0; font-weight:800; color:var(--gold);">${p.current_streak} DÍAS</p>
      </div>
    </div>

    <div class="card">
      <h3>Mis grupos</h3>
      ${(memberships || []).length === 0
        ? `<p class="dim">Aún no tienes grupos. <a href="#/groups" style="color:var(--gold); text-decoration:underline;">Crear o unirse</a></p>`
        : memberships.map(m => `
            <div class="ranking-row" style="cursor:pointer; margin-bottom:8px;" onclick="location.hash='/group/${m.groups.id}'">
              <div class="avatar">${m.groups.icon || '🎯'}</div>
              <div class="ranking-name">${escapeHtml(m.groups.name)}</div>
              <div class="dim" style="font-size:18px;">→</div>
            </div>
          `).join('')
      }
    </div>
  `;
  
  el.querySelector('#play-btn')?.addEventListener('click', () => navigate('/play'));

  // --- LÓGICA DE LA CUENTA ATRÁS ---
  const countdownEl = el.querySelector('#countdown');
  if (countdownEl) {
    const timer = setInterval(() => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Medianoche

      const diff = tomorrow - now;
      if (diff <= 0) {
        clearInterval(timer);
        countdownEl.textContent = "¡Ya disponible!";
        return;
      }

      const h = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
      const m = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
      const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
      
      countdownEl.textContent = `${h}:${m}:${s}`;
    }, 1000);
  }

  return el;
}