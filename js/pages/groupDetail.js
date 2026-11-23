import { supabase } from '../supabase.js';
import { state } from '../app.js';
import { getInitials, formatNumber, escapeHtml } from '../utils.js';

export async function render(ctx) {
  const el = document.createElement('div');
  el.className = 'container fade-in';
  const groupId = ctx.params.id;

  // 1. Datos del grupo
  const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).single();
  if (!group) return el.innerHTML = '<p class="card">Grupo no encontrado.</p>';

  // 2. Miembros
  const { data: members } = await supabase
    .from('group_members')
    .select('profiles(id, username)')
    .eq('group_id', groupId);

  const memberIds = members.map(m => m.profiles.id);

  // 3. Resultados
  const { data: allResults } = await supabase
    .from('results')
    .select('user_id, score, challenge_date')
    .in('user_id', memberIds);

  // 4. Último reto
  const { data: lastChallenge } = await supabase
    .from('daily_challenges')
    .select('id, challenge_date')
    .order('challenge_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const today = lastChallenge ? lastChallenge.challenge_date : 'Sin fecha';

  // 5. Rankings
  const dailyRanking = members.map(m => {
    const r = allResults?.find(res => res.user_id === m.profiles.id && res.challenge_date === today);
    return { ...m.profiles, dailyScore: r ? r.score : 0, playedToday: !!r };
  }).sort((a, b) => b.dailyScore - a.dailyScore);

  // Calcular semana (simplificado: sumamos todos los resultados de este grupo)
  const weeklyRanking = members.map(m => {
    const weekScore = allResults
      ?.filter(res => res.user_id === m.profiles.id)
      .reduce((sum, res) => sum + res.score, 0) || 0;
    return { ...m.profiles, weeklyScore: weekScore };
  }).sort((a, b) => b.weeklyScore - a.weeklyScore);

  // Identificar al campeón
  const championId = weeklyRanking[0]?.weeklyScore > 0 ? weeklyRanking[0].id : null;

  // 6. Render
  el.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
      <div class="avatar" style="width:48px; height:48px; font-size:24px;">${group.icon || '🎯'}</div>
      <div>
        <h1 style="margin:0">${escapeHtml(group.name)}</h1>
        <p class="dim" style="margin:0">Código: <strong>${group.invite_code}</strong></p>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" id="tab-daily">Hoy</button>
      <button class="tab" id="tab-weekly">Semanal</button>
    </div>

    <!-- RANKING DIARIO -->
    <div id="view-daily">
      <div class="card">
        <h3>Clasificación de hoy</h3>
        <p class="dim" style="font-size:12px; margin-bottom:12px;">Fecha del reto: ${today}</p>
        ${dailyRanking.map((u, i) => `
          <div class="ranking-row ${u.id === state.profile.id ? 'me' : ''}">
            <div class="ranking-pos p${i+1}">${i+1}</div>
            <div class="avatar">${getInitials(u.username)}</div>
            <div class="ranking-name">${escapeHtml(u.username)}</div>
            <div style="text-align:right">
              <div class="ranking-score">${u.playedToday ? formatNumber(u.dailyScore) : '—'}</div>
              ${!u.playedToday ? '<span class="badge-notplayed">No jugado</span>' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- RANKING SEMANAL CON CAMPEÓN -->
    <div id="view-weekly" style="display:none">
      <div class="card">
        <h3>Clasificación de la semana</h3>
        <p class="dim" style="font-size:12px; margin-bottom:12px;">El líder acumula los puntos de toda la semana.</p>
        ${weeklyRanking.map((u, i) => {
          const isChampion = u.id === championId;
          return `
          <div class="ranking-row ${u.id === state.profile.id ? 'me' : ''} ${isChampion ? 'weekly-champion' : ''}">
            <div class="ranking-pos p${i+1}">${i+1}</div>
            <div class="avatar" style="${isChampion ? 'border: 2px solid var(--gold);' : ''}">${getInitials(u.username)}</div>
            <div class="ranking-name" style="${isChampion ? 'color: var(--gold); font-weight: 800;' : ''}">
              ${isChampion ? '<span class="crown-icon">👑</span>' : ''}${escapeHtml(u.username)}
            </div>
            <div class="ranking-score" style="${isChampion ? 'font-size: 18px; text-shadow: 0 0 10px rgba(250,204,21,0.5);' : ''}">
              ${formatNumber(u.weeklyScore)}
            </div>
          </div>
        `}).join('')}
      </div>
    </div>

    <button class="btn" style="width:100%; margin-top:20px" onclick="location.hash='/groups'">Volver a mis grupos</button>
  `;

  // Pestañas
  el.querySelector('#tab-daily').addEventListener('click', () => {
    el.querySelector('#tab-daily').classList.add('active');
    el.querySelector('#tab-weekly').classList.remove('active');
    el.querySelector('#view-daily').style.display = 'block';
    el.querySelector('#view-weekly').style.display = 'none';
  });
  el.querySelector('#tab-weekly').addEventListener('click', () => {
    el.querySelector('#tab-weekly').classList.add('active');
    el.querySelector('#tab-daily').classList.remove('active');
    el.querySelector('#view-daily').style.display = 'none';
    el.querySelector('#view-weekly').style.display = 'block';
  });

  return el;
}