import { supabase } from '../supabase.js';
import { state, refreshProfile } from '../app.js';
import { toast, formatNumber, escapeHtml } from '../utils.js';
import { navigate } from '../router.js';

export async function render() {
  const el = document.createElement('div');
  el.className = 'container fade-in';
  const p = state.profile;

  // 1. Pedir fecha
  let today;
  try {
    const { data } = await supabase.rpc('get_today_date');
    today = data;
  } catch (e) {
    const now = new Date();
    today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // 2. Comprobar si ya jugó
  const { data: existing } = await supabase
    .from('results')
    .select('score')
    .eq('user_id', p.id)
    .eq('challenge_date', today)
    .maybeSingle();

  if (existing) {
    el.innerHTML = `
      <div class="card" style="text-align:center; padding:40px">
        <h2 class="question-text">Reto completado</h2>
        <p class="dim">Ya has jugado hoy (${today}).</p>
        <p class="big-number" style="margin-top:12px">${formatNumber(existing.score)}</p>
        <p class="dim">puntos</p>
        <button class="btn btn-primary" style="margin-top:20px" onclick="location.hash='/'">Volver</button>
      </div>
    `;
    return el;
  }

  // 3. Buscar reto
  const { data: challenge } = await supabase
    .from('daily_challenges')
    .select('id')
    .eq('challenge_date', today)
    .maybeSingle();

  if (!challenge) {
    el.innerHTML = `<div class="card" style="text-align:center; padding:40px"><h2>Sin reto</h2><p class="dim">No hay reto hoy.</p></div>`;
    return el;
  }

  const { data: qs, error } = await supabase
    .from('challenge_questions')
    .select('position, questions(id, text, unit)')
    .eq('challenge_id', challenge.id)
    .order('position');

  if (error || !qs || qs.length === 0) {
    el.innerHTML = `<div class="card"><p class="dim">Error cargando las preguntas.</p></div>`;
    return el;
  }

  // 4. Lógica del juego con cuenta atrás
  const answers = {};
  let idx = 0;
  let submitting = false;
  let timerInterval = null;
  let timeLeft = 15;

  function renderQuestion() {
    const q = qs[idx].questions;
    timeLeft = 15; // Reiniciar el reloj para cada pregunta

    el.innerHTML = `
      <div class="progress-dots">${qs.map((_, i) => `<div class="dot ${i <= idx ? 'active' : ''}"></div>`).join('')}</div>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <p class="dim">Pregunta ${idx + 1} de ${qs.length}</p>
        <div id="timer-box" style="background:var(--bg-elev); padding:6px 12px; border-radius:99px; border: 1px solid var(--border); font-weight:900; color:var(--gold); font-size:16px;">
          ⏱️ 15s
        </div>
      </div>

      <div class="card" id="question-card" style="margin-top:8px; transition: all 0.4s ease;">
        <h2 class="question-text">${escapeHtml(q.text)}</h2>
        <p class="question-unit">Unidad: ${escapeHtml(q.unit || '—')}</p>
        <input class="big-input" id="answer" type="number" inputmode="numeric" placeholder="Tu respuesta" value="${answers[idx] ?? ''}" />
        <button class="btn-primary" id="submit-btn">Confirmar respuesta</button>
      </div>
    `;

    // Lógica del temporizador
    if (timerInterval) clearInterval(timerInterval);
    const timerBox = el.querySelector('#timer-box');
    
    timerInterval = setInterval(() => {
      timeLeft--;
      timerBox.textContent = `⏱️ ${timeLeft}s`;
      
      if (timeLeft <= 5) {
        timerBox.style.color = 'var(--red)';
        timerBox.style.borderColor = 'var(--red)';
      }

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        // Tiempo agotado: forzamos respuesta 0
        showFeedback(q, 0, true); 
      }
    }, 1000);
    
    const input = el.querySelector('#answer');
    input.focus();
    input.addEventListener('input', () => { answers[idx] = input.value; });
    
    el.querySelector('#submit-btn').addEventListener('click', () => {
      if (answers[idx] === '' || answers[idx] == null) { 
        toast('Escribe una respuesta', 'error'); 
        return; 
      }
      clearInterval(timerInterval); // Paramos el reloj
      showFeedback(q, answers[idx], false);
    });
  }

  async function showFeedback(q, givenValue, timeout = false) {
    submitting = true;
    let data = { correct: 0, points: 0 };

    // Si no se agotó el tiempo, evaluamos normal
    if (!timeout) {
      const { data: res, error } = await supabase.rpc('score_single_answer', { 
        p_question_id: q.id, 
        p_given: Number(givenValue) 
      });
      if (!error) data = res;
    } else {
       // Si se agotó, forzamos a que nos devuelva la correcta para mostrarla
       const { data: res } = await supabase.rpc('score_single_answer', { 
        p_question_id: q.id, 
        p_given: 0 // Enviamos 0 para que nos diga la correcta sin dar puntos
      });
      data = { correct: res?.correct || 0, points: 0 };
    }

    submitting = false;

    const card = el.querySelector('#question-card');
    card.style.opacity = '0';
    card.style.transform = 'translateY(-10px)';

    setTimeout(() => {
      const isLast = idx === qs.length - 1;
      card.innerHTML = `
        <h2 class="question-text" style="font-size:20px; margin-bottom:20px;">${escapeHtml(q.text)}</h2>
        
        ${timeout ? '<p style="color:var(--red); font-weight:800; text-align:center; margin-bottom:16px;">¡TIEMPO AGOTADO! ⏱️</p>' : ''}
        
        <div style="display:flex; justify-content:space-between; background:var(--bg-elev); padding:16px; border-radius:12px; margin-bottom:16px;">
          <div style="text-align:center; flex:1;">
            <p class="dim" style="font-size:12px;">Tu respuesta</p>
            <p style="font-weight:800; font-size:18px;">${timeout ? '—' : formatNumber(givenValue)}</p>
          </div>
          <div style="text-align:center; flex:1; border-left: 1px solid var(--border);">
            <p class="dim" style="font-size:12px;">Correcta</p>
            <p style="font-weight:800; font-size:18px; color:var(--gold)">${formatNumber(data.correct)}</p>
          </div>
          <div style="text-align:center; flex:1; border-left: 1px solid var(--border);">
            <p class="dim" style="font-size:12px;">Puntos</p>
            <p style="font-weight:800; font-size:18px; color:var(--gold)">+${data.points}</p>
          </div>
        </div>
        <button class="btn-primary" id="next-btn">${isLast ? 'Ver resultado final' : 'Siguiente pregunta →'}</button>
      `;
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';

      el.querySelector('#next-btn').addEventListener('click', async () => {
        if (isLast) await submitAll();
        else { idx++; renderQuestion(); }
      });
    }, 300);
  }

  async function submitAll() {
    submitting = true;
    // Si alguna pregunta no se respondió por tiempo, se guarda como 0
    const payload = qs.map((q, i) => ({ question_id: q.questions.id, value: Number(answers[i] || 0) }));
    
    const { data, error } = await supabase.rpc('submit_challenge', { 
      p_challenge_date: today, 
      p_answers: payload 
    });
    
    submitting = false;
    
    if (error) { 
      alert("Error al enviar: " + error.message);
      return; 
    }
    
    await refreshProfile();

    const total = data.total;
    const { data: allResults } = await supabase.from('results').select('score').eq('challenge_date', today);
    
    let textoPercentil = "Eres el primero en jugar hoy.";
    if (allResults && allResults.length > 1) {
      const others = allResults.filter(r => r.score !== total);
      const betterCount = others.filter(r => r.score < total).length;
      const percentile = Math.round((betterCount / others.length) * 100);
      textoPercentil = `Has sido mejor que el <strong style="color:var(--gold); font-size:24px;">${percentile}%</strong> de los jugadores`;
    }

    showResult(data, qs, textoPercentil);
  }

  function showResult(result, questions, textoPercentil) {
    const maxPoints = 5000;
    const ratio = Math.min(result.total / maxPoints, 1);
    const innerCircleSize = 160 - (ratio * 140); 

    el.innerHTML = `
      <div class="score-hero fade-in" style="animation-delay: 0s;">
        <p class="dim">Reto completado</p>
        <p class="big-number" style="font-size:72px">${formatNumber(result.total)}</p>
        <p class="dim">de 5.000 puntos</p>
      </div>

      <div class="card fade-in" style="animation-delay: 0.2s; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px;">
        <div style="position:relative; width:200px; height:200px; border-radius:50%; background:#262626; display:flex; align-items:center; justify-content:center; border: 2px solid #333;">
          <div style="position:absolute; width:180px; height:180px; border-radius:50%; border: 2px dashed #444;"></div>
          <div style="position:absolute; width:140px; height:140px; border-radius:50%; border: 2px dashed #555;"></div>
          <div style="position:absolute; width:100px; height:100px; border-radius:50%; border: 2px dashed #666;"></div>
          <div style="position:absolute; width:${innerCircleSize}px; height:${innerCircleSize}px; border-radius:50%; background:var(--gold); opacity:0.8; transition: all 1s ease; box-shadow: 0 0 20px var(--gold);"></div>
          <div style="position:absolute; width:12px; height:12px; border-radius:50%; background:#fff; box-shadow: 0 0 10px #fff;"></div>
        </div>
      </div>

      <div class="card fade-in" style="animation-delay: 0.4s; text-align:center;">
        <h3>${textoPercentil}</h3>
      </div>

      <div class="card fade-in" style="animation-delay: 0.6s;">
        <h3>Resumen de respuestas</h3>
        ${result.breakdown.map((b, i) => `
          <div class="breakdown-item" style="flex-direction:column; align-items:flex-start; gap:4px;">
            <span class="q" style="font-weight:600; margin-bottom:4px;">${escapeHtml(questions[i].questions.text)}</span>
            <div style="width:100%; display:flex; justify-content:space-between; font-size:13px;">
              <span class="dim">Tú: ${b.given > 0 ? formatNumber(b.given) : 'Sin respuesta'}</span>
              <span class="dim">Correcta: ${formatNumber(b.correct)}</span>
              <span class="pts">${b.points} pts</span>
            </div>
          </div>
        `).join('')}
      </div>
      
      <button class="btn btn-primary fade-in" style="width:100%; animation-delay: 0.8s;" onclick="location.hash='/'">Volver al inicio</button>
    `;
  }

  renderQuestion();
  return el;
}