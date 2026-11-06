/**
 * CVISUAL POS — auth.js
 * Authentification isolée avec préfixe 'cvisual_'
 */

import { db } from './supabase.js';
import { toast } from './toast.js';

let currentUser = null;
let currentBusiness = null;
let currentStaff = null;
let isScreenLocked = false;
let inactivityTimer = null;

const INACTIVITY_TIMEOUT = 15 * 60 * 1000;

export async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getSessionUser() {
    if (currentUser && currentBusiness) {
        return { user: currentUser, business: currentBusiness, staff: currentStaff };
    }

    const offlineSession = localStorage.getItem('CVISUAL_OFFLINE_SESSION');
    if (!navigator.onLine && offlineSession) {
        try {
            const parsed = JSON.parse(offlineSession);
            currentUser = parsed.user;
            currentBusiness = parsed.business;
            currentStaff = parsed.staff;
            return { user: currentUser, business: currentBusiness, staff: currentStaff, offline: true };
        } catch (e) {
            console.error('Session hors ligne invalide:', e);
        }
    }

    try {
        const { data: { session }, error } = await db.auth.getSession();
        if (error || !session) return null;

        currentUser = session.user;

        // 1. Chercher si l'utilisateur est propriétaire direct
        let { data: biz } = await db.from('cvisual_businesses')
            .select('*')
            .eq('owner_id', currentUser.id)
            .maybeSingle();

        // 2. Si non propriétaire direct, vérifier si c'est un employé lié
        if (!biz) {
            const { data: staffLink } = await db.from('cvisual_staff')
                .select('business_id')
                .or(`auth_user_id.eq.${currentUser.id},email.eq.${currentUser.email}`)
                .maybeSingle();

            if (staffLink?.business_id) {
                const { data: staffBiz } = await db.from('cvisual_businesses')
                    .select('*')
                    .eq('id', staffLink.business_id)
                    .maybeSingle();
                biz = staffBiz;
            }
        }

        currentBusiness = biz;

        // Vérification statut administrateur
        const { data: adminRecord } = await db.from('cvisual_admin_users')
            .select('*')
            .eq('email', currentUser.email)
            .maybeSingle();

        const isAdmin = !!adminRecord;
        if (isAdmin) {
            localStorage.setItem('CVISUAL_IS_ADMIN', 'true');
        } else {
            localStorage.removeItem('CVISUAL_IS_ADMIN');
        }

        if (biz) {
            const { data: staffData } = await db.from('cvisual_staff')
                .select('*')
                .eq('business_id', biz.id)
                .or(`auth_user_id.eq.${currentUser.id},email.eq.${currentUser.email}`)
                .maybeSingle();
            
            currentStaff = staffData;

            localStorage.setItem('CVISUAL_OFFLINE_SESSION', JSON.stringify({
                user: currentUser,
                business: currentBusiness,
                staff: currentStaff,
                isAdmin
            }));
        }

        return { user: currentUser, business: currentBusiness, staff: currentStaff, isAdmin };
    } catch (e) {
        console.warn('Erreur vérification session en ligne:', e);
        return null;
    }
}

export async function loginWithEmail(email, password) {
    try {
        const { data, error } = await db.auth.signInWithPassword({
            email: email.trim(),
            password
        });

        if (error) throw error;

        // Vérification SuperAdmin dans cvisual_admin_users
        const { data: adminRecord } = await db.from('cvisual_admin_users')
            .select('*')
            .eq('email', data.user.email)
            .maybeSingle();

        if (adminRecord) {
            localStorage.setItem('CVISUAL_IS_ADMIN', 'true');
        } else {
            localStorage.removeItem('CVISUAL_IS_ADMIN');
        }

        const session = await getSessionUser();
        resetInactivityTimer();

        let redirectUrl = 'app.html#pos';

        if (session && session.business) {
            if (session.business.status === 'pending') {
                redirectUrl = 'app.html#pending';
            } else {
                redirectUrl = 'app.html#pos';
            }
        } else if (adminRecord) {
            // Si c'est un pur administrateur de plateforme sans entreprise POS
            redirectUrl = 'admin.html';
        } else {
            redirectUrl = 'app.html';
        }

        window.location.href = redirectUrl;
        return { success: true, redirect: redirectUrl };
    } catch (err) {
        toast.error('Échec de connexion', err.message || 'Identifiants incorrects.');
        return { success: false, error: err.message };
    }
}

export async function loginWithAccessCode(accessCode) {
    try {
        const codeTrim = accessCode.trim();
        const codeHash = await sha256(codeTrim);

        const { data: staffMember, error } = await db.from('cvisual_staff')
            .select('*, cvisual_businesses(*)')
            .eq('access_code_hash', codeHash)
            .eq('status', 'active')
            .maybeSingle();

        if (error || !staffMember) {
            throw new Error('Code d\'accès invalide ou employé inactif.');
        }

        const biz = staffMember.cvisual_businesses;
        if (!biz || biz.status !== 'approved') {
            throw new Error('Votre entreprise n\'est pas encore approuvée ou est suspendue.');
        }

        currentStaff = staffMember;
        currentBusiness = biz;
        currentUser = {
            id: staffMember.id,
            email: staffMember.email || `${staffMember.name.toLowerCase().replace(/\s+/g, '')}@cvisual.local`,
            role: staffMember.role,
            isStaffCode: true
        };

        localStorage.setItem('CVISUAL_OFFLINE_SESSION', JSON.stringify({
            user: currentUser,
            business: currentBusiness,
            staff: currentStaff
        }));

        await db.from('cvisual_staff').update({ last_login_at: new Date().toISOString() }).eq('id', staffMember.id);

        toast.success('Bienvenue !', `Connecté en tant que ${staffMember.name}`);
        resetInactivityTimer();
        window.location.href = 'app.html#pos';
        return { success: true };
    } catch (err) {
        toast.error('Erreur code d\'accès', err.message);
        return { success: false, error: err.message };
    }
}

export async function logout() {
    try {
        if (navigator.onLine && db) {
            await db.auth.signOut();
        }
    } catch (e) {
        console.warn('Erreur déconnexion:', e);
    } finally {
        localStorage.removeItem('CVISUAL_OFFLINE_SESSION');
        localStorage.removeItem('CVISUAL_IS_ADMIN');
        currentUser = null;
        currentBusiness = null;
        currentStaff = null;
        window.location.href = 'index.html';
    }
}

export function hasPermission(permissionName) {
    if (!currentStaff) return true;
    if (currentStaff.role === 'owner') return true;
    if (currentStaff.permissions && currentStaff.permissions[permissionName] === true) {
        return true;
    }
    return false;
}

export function lockScreen() {
    isScreenLocked = true;
    const lockOverlay = document.getElementById('cvisual-lock-overlay');
    if (lockOverlay) {
        lockOverlay.style.display = 'flex';
        const pinInput = document.getElementById('lock-pin-input');
        if (pinInput) {
            pinInput.value = '';
            pinInput.focus();
        }
    }
}

export function unlockScreen(pin) {
    const storedPin = localStorage.getItem('CVISUAL_QUICK_PIN') || '1234';
    if (pin === storedPin) {
        isScreenLocked = false;
        const lockOverlay = document.getElementById('cvisual-lock-overlay');
        if (lockOverlay) lockOverlay.style.display = 'none';
        resetInactivityTimer();
        toast.success('Écran déverrouillé', 'Reprise de vos ventes.');
        return true;
    } else {
        toast.error('Code PIN incorrect', 'Veuillez saisir votre code à 4 chiffres.');
        return false;
    }
}

export function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        if (!isScreenLocked && window.location.pathname.includes('app.html')) {
            lockScreen();
        }
    }, INACTIVITY_TIMEOUT);
}

['mousedown', 'mousemove', 'keypress', 'touchstart', 'scroll'].forEach(evt => {
    window.addEventListener(evt, () => resetInactivityTimer(), { passive: true });
});
