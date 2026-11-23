export const RANKS = [
  { name: 'Novato', min: 0 }, 
  { name: 'Principiante', min: 2500 },
  { name: 'Aprendiz', min: 7500 }, 
  { name: 'Calculador', min: 15000 },
  { name: 'Experto', min: 25000 }, 
  { name: 'Estratega', min: 40000 },
  { name: 'Maestro', min: 60000 }, 
  { name: 'Leyenda', min: 100000 },
  { name: 'Élite', min: 175000 }, 
  { name: 'Imparable', min: 300000 },
];

export function getRank(points) {
  let current = RANKS[0]; 
  let next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (points >= RANKS[i].min) { 
      current = RANKS[i]; 
      next = RANKS[i + 1] || null; 
    }
  }
  return { current, next };
}

export function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatNumber(n) { 
  return new Intl.NumberFormat('es-ES').format(n); 
}

export function getInitials(name = '?') { 
  return name.slice(0, 2).toUpperCase(); 
}

export function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.className = 'toast'), 3000);
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}