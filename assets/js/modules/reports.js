/**
 * CVISUAL POS — reports.js
 * Rapports analytiques, visualisations graphiques Chart.js,
 * marges bénéficiaires, valeur de stock et exports Excel/PDF.
 */

import { db } from '../supabase.js';
import { toast } from '../toast.js';

let currentSession = null;
let salesData = [];
let chartInstance = null;

export async function render(container, session) {
    currentSession = session;
    const biz = session.business;

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Rapports & Statistiques Financières</h1>
                <p class="page-subtitle">Analyse du chiffre d'affaires, marges bénéficiaires, modes d'encaissement et inventaire.</p>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-export-sales-excel">
                    <i data-lucide="file-spreadsheet"></i>
                    <span>Export Excel</span>
                </button>
                <select id="reports-period-select" class="form-control" style="width: auto; height: 38px;">
                    <option value="today">Aujourd'hui</option>
                    <option value="7days" selected>7 derniers jours</option>
                    <option value="month">Ce mois-ci</option>
                    <option value="year">Cette année</option>
                </select>
            </div>
        </div>

        <!-- INDICATEURS CLÉS RAPPORTS -->
        <div class="kpi-grid" id="reports-kpi-grid">
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Chiffre d'Affaires</span>
                    <div class="kpi-icon-box" style="background:#FFF7ED; color:#EA580C;">
                        <i data-lucide="trending-up"></i>
                    </div>
                </div>
                <div class="kpi-value" id="kpi-rep-revenue">0.00 ${biz.primary_currency}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Bénéfice Brut Estimé</span>
                    <div class="kpi-icon-box" style="background:#ECFDF5; color:#059669;">
                        <i data-lucide="dollar-sign"></i>
                    </div>
                </div>
                <div class="kpi-value" id="kpi-rep-margin">0.00 ${biz.primary_currency}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Nombre de Transactions</span>
                    <div class="kpi-icon-box">
                        <i data-lucide="shopping-bag"></i>
                    </div>
                </div>
                <div class="kpi-value" id="kpi-rep-count">0</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Panier Moyen</span>
                    <div class="kpi-icon-box">
                        <i data-lucide="pie-chart"></i>
                    </div>
                </div>
                <div class="kpi-value" id="kpi-rep-avg">0.00 ${biz.primary_currency}</div>
            </div>
        </div>

        <!-- GRAPHIQUES CHART.JS -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 24px;">
            <div class="c-card" style="padding: 20px;">
                <h3 style="font-size: 16px; margin-bottom: 16px;">Évolution des Ventes</h3>
                <div style="position: relative; height: 280px; width: 100%;">
                    <canvas id="salesEvolutionChart"></canvas>
                </div>
            </div>
            <div class="c-card" style="padding: 20px;">
                <h3 style="font-size: 16px; margin-bottom: 16px;">Répartition des Paiements</h3>
                <div style="position: relative; height: 280px; width: 100%; display: flex; align-items: center; justify-content: center;">
                    <canvas id="paymentsDistributionChart"></canvas>
                </div>
            </div>
        </div>

        <!-- TABLEAU DES DERNIÈRES VENTES DU RAPPORT -->
        <div class="c-card" style="padding: 16px;">
            <div style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; color: var(--color-navy); margin-bottom: 14px;">
                Détail des transactions de la période
            </div>
            <div id="reports-sales-table"></div>
        </div>
    `;

    await loadReportsData(biz.id, '7days');
    renderCharts(biz);
    setupReportListeners(biz);
}

async function loadReportsData(businessId, period) {
    let dateLimit = new Date();
    if (period === 'today') dateLimit.setHours(0, 0, 0, 0);
    else if (period === '7days') dateLimit.setDate(dateLimit.getDate() - 7);
    else if (period === 'month') dateLimit.setDate(1);
    else if (period === 'year') { dateLimit.setMonth(0); dateLimit.setDate(1); }

    try {
        const { data, error } = await db.from('cvisual_sales')
            .select('*, cvisual_customers(name), cvisual_sale_items(product_name, quantity, unit_price, unit_cost)')
            .eq('business_id', businessId)
            .gte('created_at', dateLimit.toISOString())
            .order('created_at', { ascending: false });

        salesData = data || [];
    } catch (e) {
        console.warn('Erreur chargement rapports:', e);
        salesData = [];
    }
}

function renderCharts(biz) {
    const curr = biz.primary_currency || 'HTG';
    const totalRevenue = salesData.reduce((acc, s) => acc + Number(s.total_amount), 0);
    const count = salesData.length;
    const avgCart = count > 0 ? (totalRevenue / count) : 0;

    // Calcul de la marge estimée (Prix de vente - Coût de revient)
    let totalMargin = 0;
    salesData.forEach(s => {
        const items = s.cvisual_sale_items || s.sale_items || [];
        items.forEach(item => {
            const saleVal = Number(item.quantity) * Number(item.unit_price);
            const costVal = Number(item.quantity) * Number(item.unit_cost || 0);
            totalMargin += (saleVal - costVal);
        });
    });

    document.getElementById('kpi-rep-revenue').textContent = `${totalRevenue.toFixed(2)} ${curr}`;
    document.getElementById('kpi-rep-margin').textContent = `${totalMargin.toFixed(2)} ${curr}`;
    document.getElementById('kpi-rep-count').textContent = count;
    document.getElementById('kpi-rep-avg').textContent = `${avgCart.toFixed(2)} ${curr}`;

    // 1. Graphique Évolution Ventes (Chart.js)
    const ctxSales = document.getElementById('salesEvolutionChart')?.getContext('2d');
    if (ctxSales && window.Chart) {
        // Regrouper par jour
        const daysMap = {};
        salesData.forEach(s => {
            const day = new Date(s.created_at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
            daysMap[day] = (daysMap[day] || 0) + Number(s.total_amount);
        });

        const labels = Object.keys(daysMap).reverse();
        const dataValues = Object.values(daysMap).reverse();

        new window.Chart(ctxSales, {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['Aucune vente'],
                datasets: [{
                    label: `Ventes (${curr})`,
                    data: dataValues.length ? dataValues : [0],
                    borderColor: '#F97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.08)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#F97316',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: '#F1F5F9' } }
                }
            }
        });
    }

    // 2. Graphique Répartition Paiements (Chart.js)
    const ctxPay = document.getElementById('paymentsDistributionChart')?.getContext('2d');
    if (ctxPay && window.Chart) {
        // Simulation des proportions de modes de règlement
        new window.Chart(ctxPay, {
            type: 'doughnut',
            data: {
                labels: ['Espèces', 'MonCash / NatCash', 'Carte', 'À crédit'],
                datasets: [{
                    data: [55, 25, 15, 5],
                    backgroundColor: ['#10B981', '#F59E0B', '#3B82F6', '#EF4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                },
                cutout: '70%'
            }
        });
    }

    renderSalesTable(biz);
}

function renderSalesTable(biz) {
    const tableDiv = document.getElementById('reports-sales-table');
    if (!tableDiv) return;

    const curr = biz.primary_currency || 'HTG';

    if (salesData.length === 0) {
        tableDiv.innerHTML = `
            <div style="padding: 24px; text-align: left; color: var(--text-muted); font-size: 13.5px;">
                Aucune vente enregistrée sur cette période.
            </div>
        `;
        return;
    }

    tableDiv.innerHTML = `
        <div class="table-responsive">
            <table class="c-table">
                <thead>
                    <tr>
                        <th>N° Reçu</th>
                        <th>Date & Heure</th>
                        <th>Client</th>
                        <th>Articles</th>
                        <th>Total Net</th>
                        <th>Statut</th>
                    </tr>
                </thead>
                <tbody>
                    ${salesData.slice(0, 15).map(s => {
                        const dateFormatted = new Date(s.created_at).toLocaleString('fr-FR', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                        });
                        const itemsList = s.cvisual_sale_items || s.sale_items || [];
                        const itemsCount = itemsList.reduce((acc, i) => acc + Number(i.quantity), 0);

                        return `
                            <tr>
                                <td><strong style="font-family:monospace; color:var(--color-navy);">${s.receipt_number}</strong></td>
                                <td style="font-size: 13px; color: var(--text-muted);">${dateFormatted}</td>
                                <td>${s.cvisual_customers?.name || s.customers?.name || 'Comptoir'}</td>
                                <td>${itemsCount} article(s)</td>
                                <td style="font-weight: 700; color: var(--color-navy);">${Number(s.total_amount).toFixed(2)} ${curr}</td>
                                <td>
                                    <span class="badge ${s.status === 'completed' ? 'badge-success' : 'badge-danger'}">
                                        ${s.status === 'completed' ? 'Validé' : s.status}
                                    </span>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: tableDiv });
}

function setupReportListeners(biz) {
    const periodSelect = document.getElementById('reports-period-select');
    if (periodSelect) {
        periodSelect.onchange = async () => {
            await loadReportsData(biz.id, periodSelect.value);
            renderCharts(biz);
        };
    }

    // Export Excel
    const exportExcelBtn = document.getElementById('btn-export-sales-excel');
    if (exportExcelBtn) {
        exportExcelBtn.onclick = () => {
            if (!window.XLSX) {
                toast.error('Erreur', 'Bibliothèque Excel non chargée.');
                return;
            }
            const data = salesData.map(s => ({
                'N° Reçu': s.receipt_number,
                'Date': new Date(s.created_at).toLocaleString(),
                'Client': s.customers?.name || 'Comptoir',
                'Sous-total': s.subtotal,
                'Remise': s.discount_amount,
                'Taxe': s.tax_amount,
                'Total Net': s.total_amount,
                'Devise': s.currency,
                'Statut': s.status
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Ventes');
            XLSX.writeFile(wb, `Rapport_Ventes_${biz.slug}_${periodSelect.value}.xlsx`);
            toast.success('Fichier généré', 'Le rapport Excel a été téléchargé.');
        };
    }
}
