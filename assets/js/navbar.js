/**
 * CVISUAL POS — navbar.js
 * Contrôleur de navigation conforme aux règles de design strictes :
 * - Desktop : Pill flottante glassmorphic (top:16px, border-radius:999px, blur 20px, bordure fine primaire 18%)
 * - Mobile : Bottom bar Android style (max 5 onglets, icône + label 10px) + Drawer "Plus"
 */

import { logout, lockScreen } from './auth.js';
import { syncNow } from './sync.js';

export function initNavbar(session) {
    const biz = session?.business || {};
    const staff = session?.staff || {};
    const user = session?.user || {};
    const isAdmin = session?.isAdmin || localStorage.getItem('CVISUAL_IS_ADMIN') === 'true';

    const navbarContainer = document.getElementById('cvisual-navbar-root');
    if (!navbarContainer) return;

    navbarContainer.innerHTML = `
        <!-- NAVBAR DESKTOP : PILL FLOTTANTE GLASSMORPHIC -->
        <header class="cvisual-desktop-pill-nav">
            <div class="nav-brand" onclick="window.location.hash='#pos'" style="cursor:pointer;">
                <div class="nav-logo-circle">
                    <img src="${biz.logo_url || 'assets/img/logo-placeholder.svg'}" alt="Logo" class="nav-logo-img" />
                </div>
                <div class="nav-brand-text">
                    <span class="nav-brand-name">${biz.name || 'Cvisual POS'}</span>
                    <span class="nav-brand-user">${staff.name || user.email || 'Utilisateur'}</span>
                </div>
            </div>

            <nav class="nav-links">
                <a href="#pos" class="nav-item" data-route="pos">
                    <i data-lucide="shopping-cart"></i>
                    <span>Vendre</span>
                </a>
                <a href="#products" class="nav-item" data-route="products">
                    <i data-lucide="package"></i>
                    <span>Produits</span>
                </a>
                <a href="#stock" class="nav-item" data-route="stock">
                    <i data-lucide="boxes"></i>
                    <span>Stock</span>
                </a>
                <a href="#reports" class="nav-item" data-route="reports">
                    <i data-lucide="bar-chart-3"></i>
                    <span>Rapports</span>
                </a>
                <div class="nav-item-dropdown">
                    <button type="button" class="nav-item nav-dropdown-btn" id="btn-desktop-more">
                        <i data-lucide="more-horizontal"></i>
                        <span>Plus</span>
                        <i data-lucide="chevron-down" style="width:12px; height:12px; margin-left:2px;"></i>
                    </button>
                    <div class="nav-dropdown-menu" id="desktop-more-menu">
                        <a href="#customers" class="dropdown-item" data-route="customers">
                            <i data-lucide="users"></i>
                            <span>Clients & Crédits</span>
                        </a>
                        <a href="#suppliers" class="dropdown-item" data-route="suppliers">
                            <i data-lucide="truck"></i>
                            <span>Fournisseurs</span>
                        </a>
                        <a href="#expenses" class="dropdown-item" data-route="expenses">
                            <i data-lucide="receipt"></i>
                            <span>Dépenses</span>
                        </a>
                        <a href="#cash" class="dropdown-item" data-route="cash">
                            <i data-lucide="banknote"></i>
                            <span>Journal de Caisse</span>
                        </a>
                        <a href="#staff" class="dropdown-item" data-route="staff">
                            <i data-lucide="shield-check"></i>
                            <span>Personnel & Accès</span>
                        </a>
                        <div class="dropdown-divider"></div>
                        <a href="#catalogue-settings" class="dropdown-item" data-route="catalogue-settings">
                            <i data-lucide="globe"></i>
                            <span>Catalogue Public</span>
                        </a>
                        <a href="#settings" class="dropdown-item" data-route="settings">
                            <i data-lucide="settings"></i>
                            <span>Paramètres</span>
                        </a>
                        ${isAdmin ? `
                        <div class="dropdown-divider"></div>
                        <a href="admin.html" class="dropdown-item" style="color: var(--color-primary); font-weight: 600;">
                            <i data-lucide="shield"></i>
                            <span>Console Super-Admin</span>
                        </a>
                        ` : ''}
                    </div>
                </div>
            </nav>

            <div class="nav-actions">
                <div id="cvisual-sync-indicator"></div>

                ${isAdmin ? `
                <a href="admin.html" class="nav-icon-btn" title="Console Super-Admin" style="color: var(--color-primary); background: #FFF7ED; border: 1px solid rgba(249, 115, 22, 0.25);">
                    <i data-lucide="shield"></i>
                </a>
                ` : ''}

                <button type="button" id="btn-quick-lock" class="nav-icon-btn" title="Verrouiller l'écran">
                    <i data-lucide="lock"></i>
                </button>

                <button type="button" id="btn-logout" class="nav-icon-btn nav-icon-logout" title="Déconnexion">
                    <i data-lucide="log-out"></i>
                </button>
            </div>
        </header>

        <!-- MOBILE BOTTOM BAR (STYLE ANDROID, 5 ONGLETS) -->
        <nav class="cvisual-mobile-bottom-bar">
            <a href="#pos" class="mobile-nav-tab" data-route="pos">
                <i data-lucide="shopping-cart"></i>
                <span>Vendre</span>
            </a>
            <a href="#products" class="mobile-nav-tab" data-route="products">
                <i data-lucide="package"></i>
                <span>Produits</span>
            </a>
            <a href="#stock" class="mobile-nav-tab" data-route="stock">
                <i data-lucide="boxes"></i>
                <span>Stock</span>
            </a>
            <a href="#reports" class="mobile-nav-tab" data-route="reports">
                <i data-lucide="bar-chart-3"></i>
                <span>Rapports</span>
            </a>
            <button type="button" class="mobile-nav-tab" id="btn-mobile-more">
                <i data-lucide="menu"></i>
                <span>Plus</span>
            </button>
        </nav>

        <!-- DRAWER MODALE MOBILE "PLUS" -->
        <div class="cvisual-drawer-backdrop" id="mobile-more-drawer">
            <div class="cvisual-drawer-panel">
                <div class="drawer-header">
                    <div style="font-family:'Syne', sans-serif; font-size:18px; font-weight:700; color:#1B2A4A;">Menu Général</div>
                    <button type="button" class="drawer-close-btn" id="btn-close-drawer">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="drawer-body">
                    <a href="#customers" class="drawer-link" data-route="customers">
                        <i data-lucide="users"></i>
                        <span>Clients & Crédits</span>
                    </a>
                    <a href="#suppliers" class="drawer-link" data-route="suppliers">
                        <i data-lucide="truck"></i>
                        <span>Fournisseurs</span>
                    </a>
                    <a href="#expenses" class="drawer-link" data-route="expenses">
                        <i data-lucide="receipt"></i>
                        <span>Dépenses</span>
                    </a>
                    <a href="#cash" class="drawer-link" data-route="cash">
                        <i data-lucide="banknote"></i>
                        <span>Journal de Caisse</span>
                    </a>
                    <a href="#staff" class="drawer-link" data-route="staff">
                        <i data-lucide="shield-check"></i>
                        <span>Personnel</span>
                    </a>
                    <a href="#catalogue-settings" class="drawer-link" data-route="catalogue-settings">
                        <i data-lucide="globe"></i>
                        <span>Catalogue Public</span>
                    </a>
                    <a href="#settings" class="drawer-link" data-route="settings">
                        <i data-lucide="settings"></i>
                        <span>Paramètres</span>
                    </a>
                    ${isAdmin ? `
                    <div style="border-top:1px solid #F1F5F9; margin:8px 0;"></div>
                    <a href="admin.html" class="drawer-link" style="color: var(--color-primary); font-weight: 600;">
                        <i data-lucide="shield"></i>
                        <span>Console Super-Admin</span>
                    </a>
                    ` : ''}
                    <div style="border-top:1px solid #F1F5F9; margin:12px 0;"></div>
                    <button type="button" class="drawer-link" id="btn-mobile-lock" style="border:none; background:none; width:100%; text-align:left; cursor:pointer;">
                        <i data-lucide="lock"></i>
                        <span>Verrouiller l'écran</span>
                    </button>
                    <button type="button" class="drawer-link danger" id="btn-mobile-logout" style="border:none; background:none; width:100%; text-align:left; cursor:pointer; color:#EF4444;">
                        <i data-lucide="log-out"></i>
                        <span>Déconnexion</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Événements boutons et dropdowns
    const desktopMoreBtn = document.getElementById('btn-desktop-more');
    const desktopMoreMenu = document.getElementById('desktop-more-menu');
    if (desktopMoreBtn && desktopMoreMenu) {
        desktopMoreBtn.onclick = (e) => {
            e.stopPropagation();
            desktopMoreMenu.classList.toggle('show');
        };
        document.addEventListener('click', () => {
            desktopMoreMenu.classList.remove('show');
        });
    }

    // Drawer mobile
    const mobileMoreBtn = document.getElementById('btn-mobile-more');
    const mobileDrawer = document.getElementById('mobile-more-drawer');
    const closeDrawerBtn = document.getElementById('btn-close-drawer');
    if (mobileMoreBtn && mobileDrawer) {
        mobileMoreBtn.onclick = () => mobileDrawer.classList.add('open');
        if (closeDrawerBtn) closeDrawerBtn.onclick = () => mobileDrawer.classList.remove('open');
        mobileDrawer.onclick = (e) => {
            if (e.target === mobileDrawer) mobileDrawer.classList.remove('open');
        };
        // Fermer le drawer lors d'un clic sur un lien
        mobileDrawer.querySelectorAll('.drawer-link').forEach(link => {
            link.addEventListener('click', () => mobileDrawer.classList.remove('open'));
        });
    }

    // Boutons de verrouillage & déconnexion
    const lockBtn = document.getElementById('btn-quick-lock');
    if (lockBtn) lockBtn.onclick = () => lockScreen();

    const mobileLockBtn = document.getElementById('btn-mobile-lock');
    if (mobileLockBtn) mobileLockBtn.onclick = () => lockScreen();

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.onclick = () => logout();

    const mobileLogoutBtn = document.getElementById('btn-mobile-logout');
    if (mobileLogoutBtn) mobileLogoutBtn.onclick = () => logout();

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: navbarContainer });
    }
}
