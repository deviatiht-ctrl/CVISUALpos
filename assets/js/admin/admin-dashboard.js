/**
 * CVISUAL POS — admin-dashboard.js
 * Tableau de bord plateforme pour le Super-Administrateur Cvisual.
 * Métriques globales de la plateforme, répartition par statut et par type de commerce.
 */

import { db } from '../supabase.js';

export async function renderAdminDashboard(container) {
    container.innerHTML = `
        <div class="kpi-grid" style="margin-bottom: 24px;">
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Demandes en Attente</span>
                    <div class="kpi-icon-box" style="background: #FEF3C7; color: #D97706;">
                        <i data-lucide="clock"></i>
                    </div>
                </div>
                <div class="kpi-value" id="admin-kpi-pending" style="color: #D97706;">0</div>
                <div class="kpi-footer">
                    <span style="font-size: 12px; color: var(--text-muted);">À valider pour activation</span>
                </div>
            </div>

            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Entreprises Actives</span>
                    <div class="kpi-icon-box" style="background: #ECFDF5; color: #059669;">
                        <i data-lucide="store"></i>
                    </div>
                </div>
                <div class="kpi-value" id="admin-kpi-approved" style="color: #059669;">0</div>
                <div class="kpi-footer">
                    <span style="font-size: 12px; color: var(--text-muted);">Comptes approuvés</span>
                </div>
            </div>

            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Comptes Suspendus</span>
                    <div class="kpi-icon-box" style="background: #FEF2F2; color: #DC2626;">
                        <i data-lucide="shield-alert"></i>
                    </div>
                </div>
                <div class="kpi-value" id="admin-kpi-suspended" style="color: #DC2626;">0</div>
                <div class="kpi-footer">
                    <span style="font-size: 12px; color: var(--text-muted);">Accès restreints</span>
                </div>
            </div>

            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Total Plateforme</span>
                    <div class="kpi-icon-box">
                        <i data-lucide="layers"></i>
                    </div>
                </div>
                <div class="kpi-value" id="admin-kpi-total">0</div>
                <div class="kpi-footer">
                    <span style="font-size: 12px; color: var(--text-muted);">Établissements enregistrés</span>
                </div>
            </div>
        </div>

        <div class="c-card" style="padding: 24px;">
            <h3 style="font-size: 16px; margin-bottom: 16px;">Nouvelles Inscriptions (Dernières semaines)</h3>
            <div style="height: 260px; width: 100%;">
                <canvas id="adminRegistrationsChart"></canvas>
            </div>
        </div>
    `;

    try {
        const { data: businesses } = await db.from('cvisual_businesses').select('*');
        const list = businesses || [];

        const pending = list.filter(b => b.status === 'pending').length;
        const approved = list.filter(b => b.status === 'approved').length;
        const suspended = list.filter(b => b.status === 'suspended').length;
        const total = list.length;

        document.getElementById('admin-kpi-pending').textContent = pending;
        document.getElementById('admin-kpi-approved').textContent = approved;
        document.getElementById('admin-kpi-suspended').textContent = suspended;
        document.getElementById('admin-kpi-total').textContent = total;

        // Graphique Chart.js
        const ctx = document.getElementById('adminRegistrationsChart')?.getContext('2d');
        if (ctx && window.Chart) {
            new window.Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Semaine 1', 'Semaine 2', 'Semaine 3', 'Semaine en cours'],
                    datasets: [{
                        label: 'Inscriptions',
                        data: [4, 7, 12, total],
                        backgroundColor: '#F97316',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    } catch (e) {
        console.warn('Erreur chargement dashboard admin:', e);
    }

    if (window.lucide) window.lucide.createIcons({ root: container });
}
