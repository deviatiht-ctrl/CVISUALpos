/**
 * CVISUAL POS — router.js
 * Routeur Hash SPA pour app.html
 * Gestion des routes, guards d'accès, chargement dynamique des vues et appel lucide.createIcons()
 */

import { getSessionUser } from './auth.js';
import { updateSyncBadge } from './sync.js';

const routes = {
    'pos': () => import('./modules/sales.js'),
    'products': () => import('./modules/products.js'),
    'stock': () => import('./modules/stock.js'),
    'customers': () => import('./modules/customers.js'),
    'suppliers': () => import('./modules/suppliers.js'),
    'expenses': () => import('./modules/expenses.js'),
    'cash': () => import('./modules/cash-register.js'),
    'reports': () => import('./modules/reports.js'),
    'staff': () => import('./modules/staff.js'),
    'catalogue-settings': () => import('./modules/catalogue-settings.js'),
    'settings': () => import('./modules/settings.js')
};

let currentRoute = null;

export async function navigateTo(hash) {
    const cleanHash = (hash || window.location.hash || '#pos').replace('#', '').split('?')[0];
    const targetRoute = cleanHash || 'pos';

    const container = document.getElementById('app-main-content');
    if (!container) return;

    // 1. Guard de session
    const session = await getSessionUser();
    if (!session || !session.business) {
        window.location.href = 'index.html';
        return;
    }

    const business = session.business;

    // 2. Guard Entreprise Pending ou Suspendue
    if (business.status === 'pending') {
        renderPendingScreen(container, business);
        return;
    }

    if (business.status === 'rejected' || business.status === 'suspended') {
        renderBlockedScreen(container, business);
        return;
    }

    // 3. Mise à jour de la navigation visuelle (desktop pill & mobile bottom bar)
    updateActiveNavLinks(targetRoute);

    // 4. Affichage de l'état de chargement (skeleton subtil)
    container.innerHTML = `
        <div style="padding: 32px 0;">
            <div style="height: 38px; width: 220px; background: #F1F5F9; border-radius: 8px; margin-bottom: 24px; animation: pulse 1.5s infinite;"></div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
                <div style="height: 180px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px;"></div>
                <div style="height: 180px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px;"></div>
                <div style="height: 180px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px;"></div>
            </div>
        </div>
    `;

    try {
        const moduleLoader = routes[targetRoute] || routes['pos'];
        const module = await moduleLoader();

        // Nettoyage et montage
        container.innerHTML = '';
        if (typeof module.render === 'function') {
            await module.render(container, session);
        }

        currentRoute = targetRoute;

        // Règle de design non négociable : Toujours appeler lucide.createIcons()
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }

        // Rafraîchir badge sync
        updateSyncBadge();

    } catch (err) {
        console.error(`[Cvisual Router] Erreur lors du chargement de la route ${targetRoute}:`, err);
        container.innerHTML = `
            <div style="padding: 48px 24px; text-align: left; max-width: 600px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: #FEE2E2; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                    <i data-lucide="alert-triangle" style="width: 24px; height: 24px; color: #DC2626;"></i>
                </div>
                <h2 style="font-family: 'Syne', sans-serif; font-size: 22px; color: #1B2A4A; margin-bottom: 8px;">Impossible de charger cette section</h2>
                <p style="color: #64748B; font-size: 14px; margin-bottom: 20px; line-height: 1.5;">${err.message || 'Une erreur est survenue lors de l\'initialisation du module.'}</p>
                <button onclick="window.location.hash='#pos'" style="padding: 10px 20px; background: #F97316; color: #FFF; border: none; border-radius: 999px; font-weight: 600; cursor: pointer;">
                    Retour à l'écran de vente
                </button>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

function updateActiveNavLinks(activeRoute) {
    document.querySelectorAll('[data-route]').forEach(link => {
        const routeAttr = link.getAttribute('data-route');
        if (routeAttr === activeRoute) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function renderPendingScreen(container, business) {
    container.innerHTML = `
        <div style="max-width: 640px; margin: 40px auto; padding: 40px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); text-align: left;">
            <div style="width: 56px; height: 56px; border-radius: 16px; background: #FEF3C7; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                <i data-lucide="clock" style="width: 28px; height: 28px; color: #D97706;"></i>
            </div>
            <span style="display: inline-block; padding: 4px 12px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 999px; font-size: 12px; font-weight: 700; color: #B45309; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
                Statut : En attente de validation
            </span>
            <h1 style="font-family: 'Syne', sans-serif; font-size: 26px; color: #1B2A4A; margin-bottom: 12px;">Votre demande est en cours d'examen</h1>
            <p style="color: #64748B; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                Merci d'avoir inscrit <strong>${business.name}</strong> sur Cvisual POS. Notre équipe vérifie la conformité de votre établissement pour activer votre espace de vente sécurisé.
            </p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <div style="font-size: 13px; font-weight: 600; color: #1B2A4A; margin-bottom: 6px;">Informations transmises :</div>
                <div style="font-size: 13px; color: #64748B;">• Type : ${business.type}</div>
                <div style="font-size: 13px; color: #64748B;">• Contact : ${business.phone || 'Non renseigné'}</div>
                <div style="font-size: 13px; color: #64748B;">• Ville : ${business.city || 'Haïti'}</div>
            </div>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <button onclick="window.location.reload()" style="padding: 10px 20px; background: #F97316; color: #FFFFFF; border: none; border-radius: 999px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="refresh-cw" style="width: 16px; height: 16px;"></i>
                    Vérifier à nouveau
                </button>
                <button onclick="import('./auth.js').then(m => m.logout())" style="padding: 10px 20px; background: #FFFFFF; color: #64748B; border: 1px solid #CBD5E1; border-radius: 999px; font-weight: 600; cursor: pointer;">
                    Se déconnecter
                </button>
            </div>
            <div style="margin-top: 32px; border-top: 1px solid #F1F5F9; padding-top: 16px; font-size: 12px; color: #94A3B8;">
                Designed by Cvisual
            </div>
        </div>
    `;
    if (window.lucide) window.lucide.createIcons();
}

function renderBlockedScreen(container, business) {
    const isSuspended = business.status === 'suspended';
    container.innerHTML = `
        <div style="max-width: 600px; margin: 40px auto; padding: 40px; background: #FFFFFF; border: 1px solid #FEE2E2; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); text-align: left;">
            <div style="width: 56px; height: 56px; border-radius: 16px; background: #FEE2E2; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                <i data-lucide="shield-alert" style="width: 28px; height: 28px; color: #DC2626;"></i>
            </div>
            <h1 style="font-family: 'Syne', sans-serif; font-size: 24px; color: #1B2A4A; margin-bottom: 12px;">
                ${isSuspended ? 'Compte temporairement suspendu' : 'Demande d\'inscription refusée'}
            </h1>
            <p style="color: #64748B; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
                ${business.rejection_reason || 'Veuillez contacter le support administratif de Cvisual pour régulariser la situation de votre compte.'}
            </p>
            <button onclick="import('./auth.js').then(m => m.logout())" style="padding: 10px 20px; background: #1B2A4A; color: #FFFFFF; border: none; border-radius: 999px; font-weight: 600; cursor: pointer;">
                Retour à l'accueil
            </button>
        </div>
    `;
    if (window.lucide) window.lucide.createIcons();
}

// Initialisation de l'écouteur de changement de hash
window.addEventListener('hashchange', () => navigateTo(window.location.hash));
