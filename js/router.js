const routes = [];
export function register(pattern, handler) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ regex, keys, handler });
}
export function navigate(path) { if (location.hash !== '#' + path) location.hash = path; else render(); }
export function currentPath() { return location.hash.slice(1) || '/'; }
export async function render() {
  const path = currentPath();
  const main = document.getElementById('main');
  main.innerHTML = '';
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {}; r.keys.forEach((k, i) => (params[k] = m[i + 1]));
      const node = await r.handler({ params });
      if (node instanceof HTMLElement) main.appendChild(node);
      return;
    }
  }
  const node = await routes.find(r => r.regex.test('/'))?.handler({ params: {} });
  if (node instanceof HTMLElement) main.appendChild(node);
}
window.addEventListener('hashchange', render);