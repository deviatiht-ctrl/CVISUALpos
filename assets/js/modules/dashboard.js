/**
 * CVISUAL POS — dashboard.js
 * Tableau de bord d'accueil haute performance :
 * Répond en 5 secondes à "Comment va mon commerce aujourd'hui ?"
 * Intègre la checklist d'onboarding guidé avec jauge de progression et widgets adaptatifs.
 */

import { db } from '../supabase.js';

export async function render(container, session) {
    const biz = session.business;
    const curr = biz.primary_currency || 'HTG';

    // Récupérer les métriques via la procédure RPC get_dashboard_metrics
    let metrics = {
        today_sales: 0,
        today_count: 0,
        yesterday_sales: 0,
        sales_growth_percent: 0,
        today_profit: 0,
        low_stock_count: 0,
        total_debts: 0
    };

    try {
        if (navigator.onLine && db) {
            const { data } = await db.rpc('cvisual_get_dashboard_metrics', { p_business_id: biz.id });
            if (data) metrics = data;
        }
    } catch (e) {
        console.warn('Erreur métriques dashboard:', e);
    }

    // Calcul de l'onboarding
    const steps = [
        { id: 'logo', label: 'Ajouter le logo de la boutique', done: !!biz.logo_url, link: '#settings' },
        { id: 'products', label: 'Créer vos premiers articles', done: true, link: '#products' },
        { id: 'receipt', label: 'Configurer le format d\'impression', done: !!biz.receipt_settings, link: '#settings' },
        { id: 'catalogue', label: 'Activer votre vitrine en ligne', done: !!biz.catalogue_settings?.enabled, link: '#catalogue-settings' }
    ];
    const completedSteps = steps.filter(s => s.done).length;
    const progressPercent = Math.round((completedSteps / steps.length) * 100);

    const isGrowthPositive = Number(metrics.sales_growth_percent) >= 0;

    container.innerHTML = `
        <div class="dashboard-hero">
            <h1 class="dashboard-greeting">Comment va votre commerce aujourd'hui ?</h1>
            <p class="dashboard-subtext">${biz.name} • Tableau de bord en temps réel</p>
        </div>

        <!-- CHECKLIST ONBOARDING SI PAS À 100% -->
        ${progressPercent < 100 ? `
            <div class="onboarding-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 700; font-size: 15px; color: var(--color-navy);">
                        Checklist de démarrage de votre boutique
                    </div>
                    <span style="font-size: 13px; font-weight: 700; color: var(--color-primary);">${progressPercent}% terminé</span>
                </div>
                <div class="onboarding-progress-bar">
                    <div class="onboarding-progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="onboarding-steps">
                    ${steps.map(step => `
                        <a href="${step.link}" class="onboarding-step-item ${step.done ? 'completed' : ''}">
                            <i data-lucide="${step.done ? 'check-circle-2' : 'circle'}" style="width: 16px; height: 16px;"></i>
                            <span>${step.label}</span>
                        </a>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        <!-- 4 KPIS MAJEURS (RÉPONSE EN 5 SECONDES) -->
        <div class="kpi-grid">
            <!-- 1. VENTES DU JOUR -->
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Ventes du Jour</span>
                    <div class="kpi-icon-box" style="background: #FFF7ED; color: #EA580C;">
                        <i data-lucide="shopping-cart"></i>
                    </div>
                </div>
                <div class="kpi-value">${Number(metrics.today_sales).toFixed(2)} ${curr}</div>
                <div class="kpi-footer">
                    <span class="${isGrowthPositive ? 'trend-up' : 'trend-down'}">
                        ${isGrowthPositive ? '↑' : '↓'} ${Math.abs(metrics.sales_growth_percent)}%
                    </span>
                    <span style="color: var(--text-muted);">vs hier</span>
                </div>
            </div>

            <!-- 2. BÉNÉFICE ESTIMÉ -->
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Bénéfice Brut Estimé</span>
                    <div class="kpi-icon-box" style="background: #ECFDF5; color: #059669;">
                        <i data-lucide="trending-up"></i>
                    </div>
                </div>
                <div class="kpi-value">${Number(metrics.today_profit).toFixed(2)} ${curr}</div>
                <div class="kpi-footer">
                    <span style="color: var(--text-muted); font-size: 11px;">Marge brute sur articles vendus</span>
                </div>
            </div>

            <!-- 3. RUPTURES ET STOCK BAS -->
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Alertes Stock Bas</span>
                    <div class="kpi-icon-box" style="background: ${metrics.low_stock_count > 0 ? '#FEF2F2' : '#F8FAFC'}; color: ${metrics.low_stock_count > 0 ? '#DC2626' : '#94A3B8'};">
                        <i data-lucide="alert-triangle"></i>
                    </div>
                </div>
                <div class="kpi-value" style="color: ${metrics.low_stock_count > 0 ? '#DC2626' : 'var(--color-navy)'};">
                    ${metrics.low_stock_count}
                </div>
                <div class="kpi-footer">
                    <a href="#stock" style="font-size: 12px; font-weight: 600;">Voir les articles à réassortir →</a>
                </div>
            </div>

            <!-- 4. CRÉANCES CLIENTS -->
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Dettes Clients en cours</span>
                    <div class="kpi-icon-box">
                        <i data-lucide="user-minus"></i>
                    </div>
                </div>
                <div class="kpi-value">${Number(metrics.total_debts).toFixed(2)} ${curr}</div>
                <div class="kpi-footer">
                    <a href="#customers" style="font-size: 12px; font-weight: 600;">Consulter les créances →</a>
                </div>
            </div>
        </div>

        <!-- ACTIONS RAPIDES ET ACCÈS INSTANTANÉ -->
        <div class="c-card" style="padding: 24px; margin-top: 24px;">
            <h3 style="font-size: 16px; margin-bottom: 16px;">Accès Rapides</h3>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <button type="button" class="btn btn-primary" onclick="window.location.hash='#pos'">
                    <i data-lucide="shopping-cart"></i>
                    <span>Nouvelle Vente</span>
                </button>
                <button type="button" class="btn btn-outline" onclick="window.location.hash='#products'">
                    <i data-lucide="package-plus"></i>
                    <span>Ajouter un Article</span>
                </button>
                <button type="button" class="btn btn-outline" onclick="window.location.hash='#expenses'">
                    <i data-lucide="receipt"></i>
                    <span>Saisir une Dépense</span>
                </button>
                <button type="button" class="btn btn-outline" onclick="window.location.hash='#reports'">
                    <i data-lucide="bar-chart-3"></i>
                    <span>Consulter les Rapports</span>
                </button>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
}
