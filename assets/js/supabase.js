/**
 * CVISUAL POS — supabase.js
 * Initialisation unique du client Supabase et exposition sur window.db.
 * Respect strict de l'architecture : tout accès backend passe par ce module.
 */

// Configuration par défaut (remplaçable dynamiquement via localStorage ou assistant d'installation)
const DEFAULT_SUPABASE_URL = localStorage.getItem('CVISUAL_SUPABASE_URL') || 'https://oykuhhogcdbmoybskexd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = localStorage.getItem('CVISUAL_SUPABASE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95a3VoaG9nY2RibW95YnNrZXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTk1OTksImV4cCI6MjA5NjQ5NTU5OX0.xbIdgA6-DCILYkDQcl_VzWgz7HmIlHYhmRp0u_a87F4';

let supabaseClient = null;

export function initSupabase(url = DEFAULT_SUPABASE_URL, anonKey = DEFAULT_SUPABASE_ANON_KEY) {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(url, anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: window.localStorage
            },
            realtime: {
                params: {
                    eventsPerSecond: 10
                }
            }
        });
        window.db = supabaseClient;
        console.log('[Cvisual POS] Supabase initialisé avec succès.');
        return supabaseClient;
    } else {
        console.error('[Cvisual POS] Librairie Supabase JS non trouvée dans window.supabase.');
        return null;
    }
}

// Initialisation immédiate
const db = initSupabase();

// Exposition globale selon spécification
window.db = db;

/**
 * Met à jour les identifiants Supabase en cours d'exécution
 */
export function setSupabaseCredentials(url, anonKey) {
    if (!url || !anonKey) return false;
    localStorage.setItem('CVISUAL_SUPABASE_URL', url.trim());
    localStorage.setItem('CVISUAL_SUPABASE_KEY', anonKey.trim());
    initSupabase(url.trim(), anonKey.trim());
    return true;
}

export { db };
export default db;
