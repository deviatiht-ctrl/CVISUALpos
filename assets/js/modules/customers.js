/**
 * CVISUAL POS — customers.js
 * Gestion des Clients, Crédits, Dettes, Relevés de compte et Points de fidélité.
 */

import { db } from '../supabase.js';
import { toast } from '../toast.js';

let currentSession = null;
let customersList = [];

export async function render(container, session) {
    currentSession = session;
    const biz = session.business;

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Clients & Crédits</h1>
                <p class="page-subtitle">Gestion de votre fichier clients, encours de crédit et historique des achats.</p>
            </div>
            <button type="button" class="btn btn-primary" id="btn-new-customer">
                <i data-lucide="user-plus"></i>
                <span>Nouveau Client</span>
            </button>
        </div>

        <div class="c-card" style="margin-bottom: 20px; padding: 16px;">
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <div class="search-input-wrapper" style="flex: 1; min-width: 240px;">
                    <i data-lucide="search"></i>
                    <input type="text" id="cust-search" class="form-control" placeholder="Rechercher par nom, téléphone ou WhatsApp...">
                </div>
                <select id="cust-filter-debt" class="form-control" style="width: auto;">
                    <option value="all">Tous les clients</option>
                    <option value="with_debt">Clients avec solde débiteur (> 0)</option>
                </select>
            </div>
        </div>

        <div id="customers-table-container">
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                <i data-lucide="loader" style="animation: spin 1s linear infinite; width: 24px; height: 24px;"></i>
                <div style="margin-top: 8px;">Chargement des clients...</div>
            </div>
        </div>
    `;

    await loadCustomers(biz.id);
    renderCustomersTable(biz);
    setupCustomerListeners(biz);
}

async function loadCustomers(businessId) {
    try {
        const { data, error } = await db.from('cvisual_customers')
            .select('*')
            .eq('business_id', businessId)
            .order('name');
        customersList = data || [];
    } catch (e) {
        console.warn('Erreur chargement clients:', e);
    }
}

function renderCustomersTable(biz) {
    const container = document.getElementById('customers-table-container');
    if (!container) return;

    const searchTerm = (document.getElementById('cust-search')?.value || '').toLowerCase().trim();
    const filterDebt = document.getElementById('cust-filter-debt')?.value || 'all';

    let list = [...customersList];

    if (filterDebt === 'with_debt') {
        list = list.filter(c => Number(c.current_debt) > 0);
    }

    if (searchTerm) {
        list = list.filter(c => 
            c.name.toLowerCase().includes(searchTerm) ||
            (c.phone && c.phone.includes(searchTerm)) ||
            (c.whatsapp && c.whatsapp.includes(searchTerm))
        );
    }

    if (list.length === 0) {
        container.innerHTML = `
            <div class="c-card" style="padding: 48px 24px;">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="users"></i>
                    </div>
                    <div class="empty-state-title">Aucun client trouvé</div>
                    <div class="empty-state-desc">Créez votre première fiche client pour suivre leurs commandes et crédits.</div>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons({ root: container });
        return;
    }

    const curr = biz.primary_currency || 'HTG';

    container.innerHTML = `
        <div class="table-responsive">
            <table class="c-table">
                <thead>
                    <tr>
                        <th>Nom & Prénom</th>
                        <th>Téléphone / WhatsApp</th>
                        <th>Adresse / Ville</th>
                        <th>Dette Actuelle</th>
                        <th>Limite Crédit</th>
                        <th>Fidélité</th>
                        <th style="text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map(c => `
                        <tr>
                            <td>
                                <strong style="color: var(--color-navy);">${c.name}</strong>
                                ${c.email ? `<div style="font-size: 11px; color: var(--text-muted);">${c.email}</div>` : ''}
                            </td>
                            <td>
                                <div>${c.phone || '-'}</div>
                                ${c.whatsapp ? `<div style="font-size: 11px; color: #16A34A;">WA: ${c.whatsapp}</div>` : ''}
                            </td>
                            <td style="font-size: 13px; color: var(--text-muted);">
                                ${c.address ? `${c.address}, ` : ''}${c.city || 'Haïti'}
                            </td>
                            <td>
                                <span class="badge ${Number(c.current_debt) > 0 ? 'badge-danger' : 'badge-success'}">
                                    ${Number(c.current_debt).toFixed(2)} ${curr}
                                </span>
                            </td>
                            <td style="font-size: 13px; color: var(--text-muted);">
                                ${Number(c.credit_limit).toFixed(2)} ${curr}
                            </td>
                            <td>
                                <span class="badge badge-info">${c.loyalty_points || 0} pts</span>
                            </td>
                            <td style="text-align: right;">
                                <div style="display: inline-flex; gap: 4px;">
                                    ${Number(c.current_debt) > 0 ? `
                                        <button type="button" class="btn btn-outline btn-sm btn-pay-debt" data-id="${c.id}" title="Encaisser remboursement" style="color: var(--color-success); border-color: #86EFAC;">
                                            <i data-lucide="hand-coins" style="width: 14px; height: 14px;"></i>
                                        </button>
                                    ` : ''}
                                    <button type="button" class="btn btn-outline btn-sm btn-edit-cust" data-id="${c.id}" title="Modifier">
                                        <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: container });
}

function setupCustomerListeners(biz) {
    const searchInput = document.getElementById('cust-search');
    const filterSelect = document.getElementById('cust-filter-debt');

    if (searchInput) searchInput.oninput = () => renderCustomersTable(biz);
    if (filterSelect) filterSelect.onchange = () => renderCustomersTable(biz);

    const newBtn = document.getElementById('btn-new-customer');
    if (newBtn) newBtn.onclick = () => openCustomerModal(null, biz);

    const tableContainer = document.getElementById('customers-table-container');
    tableContainer.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-cust');
        const payDebtBtn = e.target.closest('.btn-pay-debt');

        if (editBtn) {
            const id = editBtn.getAttribute('data-id');
            const cust = customersList.find(c => c.id === id);
            if (cust) openCustomerModal(cust, biz);
        } else if (payDebtBtn) {
            const id = payDebtBtn.getAttribute('data-id');
            const cust = customersList.find(c => c.id === id);
            if (cust) openPayDebtModal(cust, biz);
        }
    });
}

function openCustomerModal(customer, biz) {
    const isEdit = !!customer;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 520px;">
            <div class="modal-header">
                <h3 class="modal-title">${isEdit ? 'Modifier le client' : 'Nouveau Client'}</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-cust-modal">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Nom complet / Raison sociale *</label>
                    <input type="text" id="m-cust-name" class="form-control" required value="${customer?.name || ''}">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="form-group">
                        <label class="form-label">Téléphone</label>
                        <input type="tel" id="m-cust-phone" class="form-control" value="${customer?.phone || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">WhatsApp</label>
                        <input type="tel" id="m-cust-wa" class="form-control" value="${customer?.whatsapp || ''}">
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" id="m-cust-email" class="form-control" value="${customer?.email || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ville</label>
                        <input type="text" id="m-cust-city" class="form-control" value="${customer?.city || 'Port-au-Prince'}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Adresse physique</label>
                    <input type="text" id="m-cust-address" class="form-control" value="${customer?.address || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Limite de crédit autorisée (${biz.primary_currency})</label>
                    <input type="number" id="m-cust-limit" class="form-control" value="${customer?.credit_limit || 0}">
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-cust">Annuler</button>
                <button type="button" class="btn btn-primary" id="btn-save-cust">${isEdit ? 'Mettre à jour' : 'Enregistrer'}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-cust-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-cust').onclick = () => overlay.remove();

    overlay.querySelector('#btn-save-cust').onclick = async () => {
        const name = overlay.querySelector('#m-cust-name').value.trim();
        if (!name) {
            toast.warning('Nom manquant', 'Le nom du client est obligatoire.');
            return;
        }

        const payload = {
            business_id: biz.id,
            name: name,
            phone: overlay.querySelector('#m-cust-phone').value.trim() || null,
            whatsapp: overlay.querySelector('#m-cust-wa').value.trim() || null,
            email: overlay.querySelector('#m-cust-email').value.trim() || null,
            city: overlay.querySelector('#m-cust-city').value.trim() || null,
            address: overlay.querySelector('#m-cust-address').value.trim() || null,
            credit_limit: parseFloat(overlay.querySelector('#m-cust-limit').value) || 0
        };

        try {
            if (isEdit) {
                await db.from('cvisual_customers').update(payload).eq('id', customer.id);
                toast.success('Client modifié', `${name} mis à jour.`);
            } else {
                await db.from('cvisual_customers').insert([payload]);
                toast.success('Client ajouté', `${name} enregistré.`);
            }
            overlay.remove();
            await loadCustomers(biz.id);
            renderCustomersTable(biz);
        } catch (err) {
            toast.error('Erreur', err.message);
        }
    };
}

function openPayDebtModal(customer, biz) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 440px;">
            <div class="modal-header">
                <h3 class="modal-title">Remboursement Dette Client</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-debt-modal">✕</button>
            </div>
            <div class="modal-body">
                <div style="background: var(--bg-subtle); padding: 14px; border-radius: 12px; margin-bottom: 16px;">
                    <div>Client : <strong>${customer.name}</strong></div>
                    <div style="margin-top: 4px; font-size: 14px; color: var(--color-danger); font-weight: 700;">
                        Solde débiteur actuel : ${Number(customer.current_debt).toFixed(2)} ${biz.primary_currency}
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Montant remboursé (${biz.primary_currency}) *</label>
                    <input type="number" id="m-debt-amount" class="form-control" max="${customer.current_debt}" value="${customer.current_debt}" step="any">
                </div>

                <div class="form-group">
                    <label class="form-label">Moyen de paiement</label>
                    <select id="m-debt-method" class="form-control">
                        <option value="cash">Espèces</option>
                        <option value="moncash">MonCash</option>
                        <option value="natcash">NatCash</option>
                        <option value="card">Carte bancaire</option>
                        <option value="transfer">Virement</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-debt">Annuler</button>
                <button type="button" class="btn btn-primary" id="btn-save-debt">Encaisser le règlement</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-debt-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-debt').onclick = () => overlay.remove();

    overlay.querySelector('#btn-save-debt').onclick = async () => {
        const amount = parseFloat(overlay.querySelector('#m-debt-amount').value);
        const method = overlay.querySelector('#m-debt-method').value;

        if (!amount || amount <= 0) {
            toast.warning('Montant invalide', 'Saisissez un montant valide.');
            return;
        }

        try {
            const newDebt = Math.max(0, Number(customer.current_debt) - amount);
            await db.from('cvisual_customers').update({ current_debt: newDebt }).eq('id', customer.id);

            toast.success('Règlement enregistré', `${amount.toFixed(2)} ${biz.primary_currency} remboursés.`);
            overlay.remove();
            await loadCustomers(biz.id);
            renderCustomersTable(biz);
        } catch (err) {
            toast.error('Erreur', err.message);
        }
    };
}
