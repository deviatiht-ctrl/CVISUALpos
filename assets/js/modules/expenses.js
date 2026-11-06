/**
 * CVISUAL POS — expenses.js
 * Gestion des dépenses opérationnelles, sorties de caisse et imputation comptable.
 */

import { db } from '../supabase.js';
import { toast } from '../toast.js';

let currentSession = null;
let expensesList = [];

export async function render(container, session) {
    currentSession = session;
    const biz = session.business;

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Dépenses & Frais Généraux</h1>
                <p class="page-subtitle">Suivi des décaissements, charges fixes, approvisionnements et frais d'exploitation.</p>
            </div>
            <button type="button" class="btn btn-primary" id="btn-new-expense">
                <i data-lucide="receipt"></i>
                <span>Enregistrer une Dépense</span>
            </button>
        </div>

        <!-- TOTAL DU MOIS ET STATISTIQUES -->
        <div class="kpi-grid" style="margin-bottom: 24px;">
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Total Dépenses (Ce mois)</span>
                    <div class="kpi-icon-box" style="background:#FEE2E2; color:#DC2626;">
                        <i data-lucide="arrow-down-right"></i>
                    </div>
                </div>
                <div class="kpi-value" id="kpi-total-expenses">0.00 ${biz.primary_currency}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Nombre d'opérations</span>
                    <div class="kpi-icon-box">
                        <i data-lucide="list"></i>
                    </div>
                </div>
                <div class="kpi-value" id="kpi-count-expenses">0</div>
            </div>
        </div>

        <div id="expenses-table-container">
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                <i data-lucide="loader" style="animation: spin 1s linear infinite; width: 24px; height: 24px;"></i>
                <div style="margin-top: 8px;">Chargement des dépenses...</div>
            </div>
        </div>
    `;

    await loadExpenses(biz.id);
    renderExpensesTable(biz);
    setupExpenseListeners(biz);
}

async function loadExpenses(businessId) {
    try {
        const { data, error } = await db.from('cvisual_expenses')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false });
        expensesList = data || [];
    } catch (e) {
        console.warn('Erreur chargement dépenses:', e);
    }
}

function renderExpensesTable(biz) {
    const container = document.getElementById('expenses-table-container');
    if (!container) return;

    const total = expensesList.reduce((acc, exp) => acc + Number(exp.amount), 0);
    const curr = biz.primary_currency || 'HTG';

    const kpiTot = document.getElementById('kpi-total-expenses');
    const kpiCnt = document.getElementById('kpi-count-expenses');
    if (kpiTot) kpiTot.textContent = `${total.toFixed(2)} ${curr}`;
    if (kpiCnt) kpiCnt.textContent = expensesList.length;

    if (expensesList.length === 0) {
        container.innerHTML = `
            <div class="c-card" style="padding: 48px 24px;">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="receipt"></i>
                    </div>
                    <div class="empty-state-title">Aucune dépense enregistrée</div>
                    <div class="empty-state-desc">Gardez le contrôle de votre rentabilité en consignant vos charges et frais.</div>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons({ root: container });
        return;
    }

    container.innerHTML = `
        <div class="table-responsive">
            <table class="c-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Motif / Description</th>
                        <th>Catégorie</th>
                        <th>Montant</th>
                        <th>Justificatif</th>
                    </tr>
                </thead>
                <tbody>
                    ${expensesList.map(exp => {
                        const dateFormatted = new Date(exp.created_at).toLocaleDateString('fr-FR', {
                            dateStyle: 'medium'
                        });

                        return `
                            <tr>
                                <td style="font-size: 13px; color: var(--text-muted);">${dateFormatted}</td>
                                <td>
                                    <strong style="color: var(--color-navy);">${exp.description}</strong>
                                </td>
                                <td>
                                    <span class="badge badge-info">${exp.category}</span>
                                </td>
                                <td style="font-weight: 700; color: var(--color-danger);">
                                    -${Number(exp.amount).toFixed(2)} ${exp.currency || curr}
                                </td>
                                <td>
                                    ${exp.receipt_url ? `
                                        <a href="${exp.receipt_url}" target="_blank" class="btn btn-outline btn-sm" style="padding: 2px 8px; font-size: 11px;">
                                            <i data-lucide="file-text" style="width: 12px; height: 12px;"></i> Reçu
                                        </a>
                                    ` : '<span style="color: #CBD5E1;">-</span>'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: container });
}

function setupExpenseListeners(biz) {
    const newBtn = document.getElementById('btn-new-expense');
    if (newBtn) newBtn.onclick = () => openExpenseModal(biz);
}

function openExpenseModal(biz) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 480px;">
            <div class="modal-header">
                <h3 class="modal-title">Enregistrer une Dépense</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-exp-modal">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Description / Objet de la dépense *</label>
                    <input type="text" id="m-exp-desc" class="form-control" placeholder="Ex: Carburant génératrice, Achat sacs plastique" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Catégorie de charge *</label>
                    <select id="m-exp-cat" class="form-control">
                        <option value="Énergie & Carburant">Énergie & Carburant</option>
                        <option value="Loyer & Local">Loyer & Local</option>
                        <option value="Salaires & Primes">Salaires & Primes</option>
                        <option value="Fournitures & Emballages">Fournitures & Emballages</option>
                        <option value="Transport & Livraisons">Transport & Livraisons</option>
                        <option value="Maintenance & Réparations">Maintenance & Réparations</option>
                        <option value="Divers & Imprévus">Divers & Imprévus</option>
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
                    <div class="form-group">
                        <label class="form-label">Montant décaissé *</label>
                        <input type="number" id="m-exp-amount" class="form-control" step="any" placeholder="0.00" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Devise</label>
                        <select id="m-exp-curr" class="form-control">
                            <option value="${biz.primary_currency}">${biz.primary_currency}</option>
                            <option value="${biz.secondary_currency}">${biz.secondary_currency}</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Lien / URL du reçu (Optionnel)</label>
                    <input type="text" id="m-exp-url" class="form-control" placeholder="https://...">
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-exp">Annuler</button>
                <button type="button" class="btn btn-primary" id="btn-save-exp">Valider le décaissement</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-exp-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-exp').onclick = () => overlay.remove();

    overlay.querySelector('#btn-save-exp').onclick = async () => {
        const desc = overlay.querySelector('#m-exp-desc').value.trim();
        const amount = parseFloat(overlay.querySelector('#m-exp-amount').value);

        if (!desc || isNaN(amount) || amount <= 0) {
            toast.warning('Champs invalides', 'Veuillez saisir une description et un montant valide.');
            return;
        }

        const payload = {
            business_id: biz.id,
            staff_id: currentSession.staff?.id || null,
            description: desc,
            category: overlay.querySelector('#m-exp-cat').value,
            amount: amount,
            currency: overlay.querySelector('#m-exp-curr').value,
            receipt_url: overlay.querySelector('#m-exp-url').value.trim() || null
        };

        try {
            await db.from('cvisual_expenses').insert([payload]);
            toast.success('Dépense enregistrée', `${amount} ${payload.currency} comptabilisés.`);
            overlay.remove();
            await loadExpenses(biz.id);
            renderExpensesTable(biz);
        } catch (err) {
            toast.error('Erreur', err.message);
        }
    };
}
