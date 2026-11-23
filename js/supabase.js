// Pega aquí tus credenciales de Supabase
const SUPABASE_URL = 'https://wbclvpyguyuqoabdhznx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0XZir05O598VyvbCGsCk-Q_PstY9lb4';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);