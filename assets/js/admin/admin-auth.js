/**
 * CVISUAL POS — admin-auth.js
 * Sécurisation du panneau Super-Administrateur Cvisual.
 * Vérifie la présence de l'email dans la table admin_users à chaque accès.
 */

import { db } from '../supabase.js';

export async function checkAdminAccess() {
    try {
        const { data: { session }, error } = await db.auth.getSession();
        if (error || !session) {
            window.location.href = 'index.html';
            return null;
        }

        const email = session.user.email;
        const { data: adminRecord, error: adminErr } = await db.from('cvisual_admin_users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (adminErr || !adminRecord) {
            console.warn('[Cvisual Admin] Accès refusé pour:', email);
            window.location.href = 'index.html';
            return null;
        }

        return { user: session.user, admin: adminRecord };
    } catch (e) {
        console.error('[Cvisual Admin] Erreur vérification admin:', e);
        window.location.href = 'index.html';
        return null;
    }
}
