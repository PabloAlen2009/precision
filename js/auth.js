import { supabase } from './supabase.js';

const FAKE_DOMAIN = '@mailinator.com';

export async function registerUser(username, password) {
  // 1. Comprobar si el nombre está libre
  const { data: isAvailable, error: checkError } = await supabase.rpc('check_username_available', { p_username: username });
  if (checkError) throw new Error('Error al comprobar nombre');
  if (!isAvailable) throw new Error('Este nombre de usuario ya está en uso');

  // 2. Generar correo falso
  const safeName = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  const fakeEmail = safeName + FAKE_DOMAIN;

  // 3. Registrar en Supabase
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: fakeEmail, 
    password: password,
    options: { data: { username: username, login_key: username.toLowerCase() } }
  });
  if (authError) throw authError;

  // 4. Forzar creación del perfil
  if (authData.user) {
    // Pequeña espera de 100ms para que Supabase asiente la sesión
    await new Promise(r => setTimeout(r, 100));
    
    // Usamos upsert para que si el trigger ya lo creó, no de error
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      username: username,
      login_key: username.toLowerCase()
    }, { onConflict: 'id' });
    
    if (profileError) {
      console.warn("Aviso al crear perfil desde registro:", profileError);
    }
  }

  return authData;
}

export async function loginUser(username, password) {
  const safeName = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  const fakeEmail = safeName + FAKE_DOMAIN;
  const { data, error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password: password });
  if (error) throw new Error('Usuario o contraseña incorrectos');
  return data;
}

export async function signOut() { await supabase.auth.signOut(); }

export async function getSession() { 
  const { data } = await supabase.auth.getSession(); 
  return data.session; 
}

export async function getProfile(userId) { 
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle(); 
    
  if (error) throw error; 
  return data; 
}

export function onAuthChange(cb) { 
  return supabase.auth.onAuthStateChange((_event, session) => cb(session)); 
}