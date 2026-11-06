/**
 * CVISUAL POS — admin-businesses.js
 * Gestion et modération des entreprises par le Super-Administrateur :
 * Validation, rejet avec motif, suspension, réactivation et consultation détaillée.
 */

import { db } from '../supabase.js';
import { toast } from '../toast.js';

let allBusinesses = [];
let activeTab = 'pending';

export async function renderAdminBusinesses(container) {
    container.innerHTML = `
        <div class="admin-nav-tabs">
            <button type="button" class="admin-tab active" data-tab="pending">
                Demandes en Attente (<span id="count-tab-pending">0</span>)
            </button>
            <button type="button" class="admin-tab" data-tab="approved">
                Approuvées (<span id="count-tab-approved">0</span>)
            </button>
            <button type="button" class="admin-tab" data-tab="suspended">
                Suspendues (<span id="count-tab-suspended">0</span>)
            </button>
            <button type="button" class="admin-tab" data-tab="all">
                Toutes les entreprises
            </button>
        </div>

        <div id="admin-biz-table-container">
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                <i data-lucide="loader" style="animation: spin 1s linear infinite; width: 24px; height: 24px;"></i>
                <div style="margin-top: 8px;">Chargement des établissements...</div>
            </div>
        </div>
    `;

    await loadBusinesses();
    renderTable();
    setupListeners();
}

async function loadBusinesses() {
    try {
        const { data, error } = await db.from('cvisual_businesses')
            .select('*')
            .order('created_at', { ascending: false });
        allBusinesses = data || [];

        // Mettre à jour les compteurs
        const pendingCount = allBusinesses.filter(b => b.status === 'pending').length;
        const approvedCount = allBusinesses.filter(b => b.status === 'approved').length;
        const suspendedCount = allBusinesses.filter(b => b.status === 'suspended').length;

        const pEl = document.getElementById('count-tab-pending');
        const aEl = document.getElementById('count-tab-approved');
        const sEl = document.getElementById('count-tab-suspended');
        if (pEl) pEl.textContent = pendingCount;
        if (aEl) aEl.textContent = approvedCount;
        if (sEl) sEl.textContent = suspendedCount;
    } catch (e) {
        console.warn('Erreur chargement entreprises admin:', e);
    }
}

function renderTable() {
    const container = document.getElementById('admin-biz-table-container');
    if (!container) return;

    let list = allBusinesses;
    if (activeTab !== 'all') {
        list = list.filter(b => b.status === activeTab);
    }

    if (list.length === 0) {
        container.innerHTML = `
            <div class="c-card" style="padding: 48px 24px;">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="check-circle"></i>
                    </div>
                    <div class="empty-state-title">Aucune demande dans cette section</div>
                    <div class="empty-state-desc">Toutes les demandes de cette catégorie ont été traitées.</div>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons({ root: container });
        return;
    }

    const statusBadges = {
        pending: '<span class="badge badge-warning">En Attente</span>',
        approved: '<span class="badge badge-success">Approuvé</span>',
        rejected: '<span class="badge badge-danger">Rejeté</span>',
        suspended: '<span class="badge badge-danger">Suspendu</span>'
    };

    container.innerHTML = `
        <div class="table-responsive">
            <table class="c-table">
                <thead>
                    <tr>
                        <th>Entreprise</th>
                        <th>Type d'activité</th>
                        <th>Contact / Ville</th>
                        <th>Date d'inscription</th>
                        <th>Statut</th>
                        <th style="text-align: right;">Actions Administrateur</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map(b => {
                        const dateFormatted = new Date(b.created_at).toLocaleDateString('fr-FR', {
                            dateStyle: 'medium'
                        });

                        return `
                            <tr>
                                <td>
                                    <div style="font-weight: 700; color: var(--color-navy); font-size: 15px;">${b.name}</div>
                                    <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">/${b.slug}</div>
                                </td>
                                <td><span class="badge badge-info">${b.type}</span></td>
                                <td>
                                    <div>${b.phone || '-'}</div>
                                    <div style="font-size: 11px; color: var(--text-muted);">${b.city || 'Haïti'}</div>
                                </td>
                                <td style="font-size: 13px; color: var(--text-muted);">${dateFormatted}</td>
                                <td>${statusBadges[b.status] || b.status}</td>
                                <td style="text-align: right;">
                                    <div style="display: inline-flex; gap: 6px;">
                                        <button type="button" class="btn btn-outline btn-sm btn-inspect-biz" data-id="${b.id}" title="Fiche complète">
                                            <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
                                            <span>Examiner</span>
                                        </button>
                                        ${b.status === 'pending' ? `
                                            <button type="button" class="btn btn-primary btn-sm btn-approve-biz" data-id="${b.id}" style="background: #10B981;">
                                                <i data-lucide="check" style="width: 14px; height: 14px;"></i>
                                                <span>Approuver</span>
                                            </button>
                                            <button type="button" class="btn btn-outline btn-sm btn-reject-biz" data-id="${b.id}" style="color: #DC2626; border-color: #FECACA;">
                                                <i data-lucide="x" style="width: 14px; height: 14px;"></i>
                                                <span>Rejeter</span>
                                            </button>
                                        ` : ''}
                                        ${b.status === 'approved' ? `
                                            <button type="button" class="btn btn-outline btn-sm btn-suspend-biz" data-id="${b.id}" style="color: #D97706;">
                                                <i data-lucide="pause-circle" style="width: 14px; height: 14px;"></i>
                                                <span>Suspendre</span>
                                            </button>
                                        ` : ''}
                                        ${b.status === 'suspended' ? `
                                            <button type="button" class="btn btn-primary btn-sm btn-approve-biz" data-id="${b.id}">
                                                <i data-lucide="play-circle" style="width: 14px; height: 14px;"></i>
                                                <span>Réactiver</span>
                                            </button>
                                        ` : ''}
                                    </div>
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

function setupListeners() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.getAttribute('data-tab');
            renderTable();
        };
    });

    const table = document.getElementById('admin-biz-table-container');
    table.addEventListener('click', async (e) => {
        const inspectBtn = e.target.closest('.btn-inspect-biz');
        const approveBtn = e.target.closest('.btn-approve-biz');
        const rejectBtn = e.target.closest('.btn-reject-biz');
        const suspendBtn = e.target.closest('.btn-suspend-biz');

        if (inspectBtn) {
            const id = inspectBtn.getAttribute('data-id');
            const biz = allBusinesses.find(b => b.id === id);
            if (biz) openInspectModal(biz);
        } else if (approveBtn) {
            const id = approveBtn.getAttribute('data-id');
            await updateBusinessStatus(id, 'approved');
        } else if (rejectBtn) {
            const id = rejectBtn.getAttribute('data-id');
            openRejectReasonModal(id);
        } else if (suspendBtn) {
            const id = suspendBtn.getAttribute('data-id');
            if (confirm('Suspendre l\'accès de cet établissement au système POS ?')) {
                await updateBusinessStatus(id, 'suspended');
            }
        }
    });
}

async function updateBusinessStatus(businessId, status, rejectionReason = null) {
    try {
        const payload = { status, rejection_reason: rejectionReason };
        await db.from('cvisual_businesses').update(payload).eq('id', businessId);

        // Audit log
        await db.from('cvisual_audit_logs').insert([{
            business_id: businessId,
            action: `BUSINESS_STATUS_${status.toUpperCase()}`,
            entity_type: 'businesses',
            entity_id: businessId,
            new_data: payload
        }]);

        toast.success('Statut mis à jour', `Entreprise passée au statut : ${status}`);
        await loadBusinesses();
        renderTable();
    } catch (err) {
        toast.error('Erreur mise à jour', err.message);
    }
}

function openRejectReasonModal(businessId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 440px;">
            <div class="modal-header">
                <h3 class="modal-title">Motif du Rejet</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-rej-modal">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Indiquez la raison du refus (affichée au commerçant) *</label>
                    <textarea id="m-reject-reason" class="form-control" rows="3" placeholder="Ex: Numéro NIF invalide, informations de contact invérifiables..." required></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-rej">Annuler</button>
                <button type="button" class="btn btn-danger" id="btn-confirm-rej">Confirmer le rejet</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-rej-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-rej').onclick = () => overlay.remove();

    overlay.querySelector('#btn-confirm-rej').onclick = async () => {
        const reason = overlay.querySelector('#m-reject-reason').value.trim();
        if (!reason) {
            toast.warning('Motif requis', 'Veuillez saisir un motif explicite.');
            return;
        }
        overlay.remove();
        await updateBusinessStatus(businessId, 'rejected', reason);
    };
}

function openInspectModal(biz) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 600px;">
            <div class="modal-header">
                <h3 class="modal-title">Fiche Entreprise : ${biz.name}</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-inspect">✕</button>
            </div>
            <div class="modal-body">
                <div class="info-grid">
                    <div class="info-field">
                        <span class="info-field-label">Nom</span>
                        <span class="info-field-value">${biz.name}</span>
                    </div>
                    <div class="info-field">
                        <span class="info-field-label">Type</span>
                        <span class="info-field-value">${biz.type}</span>
                    </div>
                    <div class="info-field">
                        <span class="info-field-label">Slug Public</span>
                        <span class="info-field-value">/catalogue.html?e=${biz.slug}</span>
                    </div>
                    <div class="info-field">
                        <span class="info-field-label">Téléphone</span>
                        <span class="info-field-value">${biz.phone || 'Non renseigné'}</span>
                    </div>
                    <div class="info-field">
                        <span class="info-field-label">WhatsApp</span>
                        <span class="info-field-value">${biz.whatsapp || 'Non renseigné'}</span>
                    </div>
                    <div class="info-field">
                        <span class="info-field-label">Adresse & Ville</span>
                        <span class="info-field-value">${biz.address || ''}, ${biz.city || 'Haïti'}</span>
                    </div>
                    <div class="info-field">
                        <span class="info-field-label">NIF / Tax ID</span>
                        <span class="info-field-value">${biz.tax_id || 'Non renseigné'}</span>
                    </div>
                    <div class="info-field">
                        <span class="info-field-label">Devises</span>
                        <span class="info-field-value">${biz.primary_currency} / ${biz.secondary_currency} (Taux: ${biz.exchange_rate})</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" id="btn-done-inspect">Fermer</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-inspect').onclick = () => overlay.remove();
    overlay.querySelector('#btn-done-inspect').onclick = () => overlay.remove();
}
