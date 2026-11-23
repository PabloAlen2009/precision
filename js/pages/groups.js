import { supabase } from '../supabase.js';
import { state } from '../app.js';
import { toast, getInitials, escapeHtml } from '../utils.js';

export function render() {
  const el = document.createElement('div');
  el.className = 'container fade-in';
  const p = state.profile;

  async function loadGroups() {
    // Buscamos los grupos a los que pertenece el usuario
    const { data: memberships, error } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name, icon, invite_code)')
      .eq('user_id', p.id);

    if (error) {
      console.error("Error cargando grupos:", error);
      el.innerHTML = `<p style="color:red">Error al cargar grupos: ${error.message}</p>`;
      return;
    }

    console.log("Grupos cargados:", memberships);

    el.innerHTML = `
      <h1>Grupos</h1>
      <p class="dim">Compite con tus amigos.</p>

      <div class="card" style="margin-top:20px">
        <h3>Crear nuevo grupo</h3>
        <input id="group-name" placeholder="Nombre del grupo (ej. Los del Insti)" style="margin-bottom:10px" />
        <button class="btn-primary" id="create-btn">Crear grupo</button>
      </div>

      <div class="card">
        <h3>Unirse a un grupo</h3>
        <input id="join-code" placeholder="Código de invitación (ej. AB12CD34)" style="margin-bottom:10px; text-transform:uppercase" />
        <button class="btn btn-primary" id="join-btn" style="background:var(--bg-elev); color:var(--text)">Unirse</button>
      </div>

      <h3 style="margin-top:30px">Mis grupos</h3>
      <div id="group-list">
        ${(memberships || []).length === 0 
          ? '<p class="dim">No estás en ningún grupo todavía.</p>' 
          : memberships.map(m => `
              <div class="ranking-row" style="cursor:pointer" onclick="location.hash='/group/${m.groups.id}'">
                <div class="avatar">${m.groups.icon || '🎯'}</div>
                <div class="ranking-name">${escapeHtml(m.groups.name)}</div>
                <div class="dim">Código: ${m.groups.invite_code}</div>
              </div>
            `).join('')}
      </div>
    `;

    // Evento Crear
    el.querySelector('#create-btn').addEventListener('click', async () => {
      const name = el.querySelector('#group-name').value.trim();
      if (name.length < 3) return toast('Nombre demasiado corto', 'error');
      
      const { data: groupData, error: groupError } = await supabase.from('groups').insert({
        name: name, 
        creator_id: p.id
      }).select().single();

      if (groupError) {
        return toast("Error al crear: " + groupError.message, 'error');
      }
      
      const { error: memberError } = await supabase.from('group_members').insert({ 
        group_id: groupData.id, 
        user_id: p.id 
      });

      if (memberError) {
        return toast("Error al unirse: " + memberError.message, 'error');
      }
      
      toast('Grupo creado', 'success');
      // RECARGA BRUTAL: Forzamos que toda la página se vuelva a cargar
      window.location.reload(); 
    });

    // Evento Unirse
    el.querySelector('#join-btn').addEventListener('click', async () => {
      const code = el.querySelector('#join-code').value.trim().toUpperCase();
      if (!code) return;
      
      const { error } = await supabase.rpc('join_group_by_code', { p_code: code });
      if (error) return toast(error.message, 'error');
      
      toast('Te has unido al grupo', 'success');
      window.location.reload();
    });
  }

  loadGroups();
  return el;
}