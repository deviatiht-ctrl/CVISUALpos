/**
 * CVISUAL POS — suppliers.js
 * Gestion des Fournisseurs et Commandes d'achats (Purchase Orders).
 */

import { db } from '../supabase.js';
import { toast } from '../toast.js';

let currentSession = null;
let suppliersList = [];

export async function render(container, session) {
    currentSession = session;
    const biz = session.business;

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Fournisseurs & Réapprovisionnements</h1>
                <p class="page-subtitle">Gestion de vos partenaires commerciaux, commandes de stock et contacts.</p>
            </div>
            <button type="button" class="btn btn-primary" id="btn-new-supplier">
                <i data-lucide="truck"></i>
                <span>Nouveau Fournisseur</span>
            </button>
        </div>

        <div class="c-card" style="margin-bottom: 20px; padding: 16px;">
            <div class="search-input-wrapper">
                <i data-lucide="search"></i>
                <input type="text" id="sup-search" class="form-control" placeholder="Rechercher par nom de fournisseur, contact ou email...">
            </div>
        </div>

        <div id="suppliers-table-container">
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                <i data-lucide="loader" style="animation: spin 1s linear infinite; width: 24px; height: 24px;"></i>
                <div style="margin-top: 8px;">Chargement des fournisseurs...</div>
            </div>
        </div>
    `;

    await loadSuppliers(biz.id);
    renderSuppliersTable();
    setupSupplierListeners(biz);
}

async function loadSuppliers(businessId) {
    try {
        const { data, error } = await db.from('cvisual_suppliers')
            .select('*')
            .eq('business_id', businessId)
            .order('name');
        suppliersList = data || [];
    } catch (e) {
        console.warn('Erreur chargement fournisseurs:', e);
    }
}

function renderSuppliersTable() {
    const container = document.getElementById('suppliers-table-container');
    if (!container) return;

    const searchTerm = (document.getElementById('sup-search')?.value || '').toLowerCase().trim();
    let list = suppliersList;

    if (searchTerm) {
        list = list.filter(s => 
            s.name.toLowerCase().includes(searchTerm) ||
            (s.contact_name && s.contact_name.toLowerCase().includes(searchTerm)) ||
            (s.phone && s.phone.includes(searchTerm))
        );
    }

    if (list.length === 0) {
        container.innerHTML = `
            <div class="c-card" style="padding: 48px 24px;">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="truck"></i>
                    </div>
                    <div class="empty-state-title">Aucun fournisseur enregistré</div>
                    <div class="empty-state-desc">Ajoutez vos fournisseurs habituels pour faciliter vos bons d'achats.</div>
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
                        <th>Fournisseur / Entreprise</th>
                        <th>Contact référent</th>
                        <th>Téléphone / Email</th>
                        <th>Adresse</th>
                        <th>Notes</th>
                        <th style="text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map(s => `
                        <tr>
                            <td>
                                <strong style="color: var(--color-navy);">${s.name}</strong>
                            </td>
                            <td>${s.contact_name || '-'}</td>
                            <td>
                                <div>${s.phone || '-'}</div>
                                ${s.email ? `<div style="font-size: 11px; color: var(--text-muted);">${s.email}</div>` : ''}
                            </td>
                            <td style="font-size: 13px; color: var(--text-muted);">${s.address || '-'}</td>
                            <td style="font-size: 13px; color: var(--text-muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${s.notes || '-'}
                            </td>
                            <td style="text-align: right;">
                                <button type="button" class="btn btn-outline btn-sm btn-edit-sup" data-id="${s.id}">
                                    <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: container });
}

function setupSupplierListeners(biz) {
    const searchInput = document.getElementById('sup-search');
    if (searchInput) searchInput.oninput = () => renderSuppliersTable();

    const newBtn = document.getElementById('btn-new-supplier');
    if (newBtn) newBtn.onclick = () => openSupplierModal(null, biz);

    const tableContainer = document.getElementById('suppliers-table-container');
    tableContainer.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-sup');
        if (editBtn) {
            const id = editBtn.getAttribute('data-id');
            const sup = suppliersList.find(s => s.id === id);
            if (sup) openSupplierModal(sup, biz);
        }
    });
}

function openSupplierModal(supplier, biz) {
    const isEdit = !!supplier;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 500px;">
            <div class="modal-header">
                <h3 class="modal-title">${isEdit ? 'Modifier le fournisseur' : 'Nouveau Fournisseur'}</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-sup-modal">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Nom du fournisseur *</label>
                    <input type="text" id="m-sup-name" class="form-control" required value="${supplier?.name || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Personne de contact</label>
                    <input type="text" id="m-sup-contact" class="form-control" value="${supplier?.contact_name || ''}">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="form-group">
                        <label class="form-label">Téléphone</label>
                        <input type="tel" id="m-sup-phone" class="form-control" value="${supplier?.phone || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" id="m-sup-email" class="form-control" value="${supplier?.email || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Adresse de livraison / Dépôt</label>
                    <input type="text" id="m-sup-address" class="form-control" value="${supplier?.address || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Notes et conditions de paiement</label>
                    <textarea id="m-sup-notes" class="form-control" rows="2">${supplier?.notes || ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-sup">Annuler</button>
                <button type="button" class="btn btn-primary" id="btn-save-sup">${isEdit ? 'Mettre à jour' : 'Enregistrer'}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-sup-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-sup').onclick = () => overlay.remove();

    overlay.querySelector('#btn-save-sup').onclick = async () => {
        const name = overlay.querySelector('#m-sup-name').value.trim();
        if (!name) {
            toast.warning('Nom manquant', 'Le nom du fournisseur est obligatoire.');
            return;
        }

        const payload = {
            business_id: biz.id,
            name: name,
            contact_name: overlay.querySelector('#m-sup-contact').value.trim() || null,
            phone: overlay.querySelector('#m-sup-phone').value.trim() || null,
            email: overlay.querySelector('#m-sup-email').value.trim() || null,
            address: overlay.querySelector('#m-sup-address').value.trim() || null,
            notes: overlay.querySelector('#m-sup-notes').value.trim() || null
        };

        try {
            if (isEdit) {
                await db.from('cvisual_suppliers').update(payload).eq('id', supplier.id);
                toast.success('Fournisseur modifié', `${name} mis à jour.`);
            } else {
                await db.from('cvisual_suppliers').insert([payload]);
                toast.success('Fournisseur ajouté', `${name} enregistré.`);
            }
            overlay.remove();
            await loadSuppliers(biz.id);
            renderSuppliersTable();
        } catch (err) {
            toast.error('Erreur', err.message);
        }
    };
}
