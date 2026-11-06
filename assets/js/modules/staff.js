/**
 * CVISUAL POS — staff.js
 * Gestion du Personnel, Rôles, Permissions fines et Codes d'accès caissiers sécurisés.
 */

import { db } from '../supabase.js';
import { toast } from '../toast.js';
import { sha256 } from '../auth.js';

let currentSession = null;
let staffList = [];

export async function render(container, session) {
    currentSession = session;
    const biz = session.business;

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Personnel & Droits d'Accès</h1>
                <p class="page-subtitle">Gestion des comptes caissiers, gérants et génération des codes d'accès sécurisés.</p>
            </div>
            <button type="button" class="btn btn-primary" id="btn-new-staff">
                <i data-lucide="user-plus"></i>
                <span>Ajouter un Employé</span>
            </button>
        </div>

        <div id="staff-table-container">
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                <i data-lucide="loader" style="animation: spin 1s linear infinite; width: 24px; height: 24px;"></i>
                <div style="margin-top: 8px;">Chargement de l'équipe...</div>
            </div>
        </div>
    `;

    await loadStaff(biz.id);
    renderStaffTable(biz);
    setupStaffListeners(biz);
}

async function loadStaff(businessId) {
    try {
        const { data, error } = await db.from('cvisual_staff')
            .select('*')
            .eq('business_id', businessId)
            .order('name');
        staffList = data || [];
    } catch (e) {
        console.warn('Erreur chargement personnel:', e);
    }
}

function renderStaffTable(biz) {
    const container = document.getElementById('staff-table-container');
    if (!container) return;

    if (staffList.length === 0) {
        container.innerHTML = `
            <div class="c-card" style="padding: 48px 24px;">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="users"></i>
                    </div>
                    <div class="empty-state-title">Aucun employé configuré</div>
                    <div class="empty-state-desc">Créez des codes d'accès pour permettre à vos caissiers d'encaisser les ventes.</div>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons({ root: container });
        return;
    }

    const roleBadges = {
        owner: '<span class="badge badge-info">Propriétaire</span>',
        manager: '<span class="badge badge-warning">Gérant</span>',
        cashier: '<span class="badge badge-success">Caissier</span>'
    };

    container.innerHTML = `
        <div class="table-responsive">
            <table class="c-table">
                <thead>
                    <tr>
                        <th>Nom de l'employé</th>
                        <th>Rôle</th>
                        <th>Contact</th>
                        <th>Code d'accès</th>
                        <th>Dernière connexion</th>
                        <th>Statut</th>
                        <th style="text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${staffList.map(s => {
                        const lastLogin = s.last_login_at 
                            ? new Date(s.last_login_at).toLocaleDateString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                            : 'Jamais';

                        return `
                            <tr>
                                <td>
                                    <strong style="color: var(--color-navy);">${s.name}</strong>
                                    ${s.email ? `<div style="font-size: 11px; color: var(--text-muted);">${s.email}</div>` : ''}
                                </td>
                                <td>${roleBadges[s.role] || s.role}</td>
                                <td>${s.phone || '-'}</td>
                                <td>
                                    <span style="font-family: monospace; background: var(--bg-muted); padding: 4px 8px; border-radius: 6px; font-size: 12px;">
                                        ${s.access_code_hint || '••••••'}
                                    </span>
                                </td>
                                <td style="font-size: 12.5px; color: var(--text-muted);">${lastLogin}</td>
                                <td>
                                    <span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}">
                                        ${s.status === 'active' ? 'Actif' : 'Inactif'}
                                    </span>
                                </td>
                                <td style="text-align: right;">
                                    <div style="display: inline-flex; gap: 4px;">
                                        <button type="button" class="btn btn-outline btn-sm btn-regen-code" data-id="${s.id}" title="Régénérer code d'accès">
                                            <i data-lucide="key" style="width: 14px; height: 14px;"></i>
                                        </button>
                                        <button type="button" class="btn btn-outline btn-sm btn-edit-staff" data-id="${s.id}" title="Permissions">
                                            <i data-lucide="shield" style="width: 14px; height: 14px;"></i>
                                        </button>
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

function setupStaffListeners(biz) {
    const newBtn = document.getElementById('btn-new-staff');
    if (newBtn) newBtn.onclick = () => openStaffModal(null, biz);

    const table = document.getElementById('staff-table-container');
    table.addEventListener('click', async (e) => {
        const regenBtn = e.target.closest('.btn-regen-code');
        const editBtn = e.target.closest('.btn-edit-staff');

        if (regenBtn) {
            const id = regenBtn.getAttribute('data-id');
            const member = staffList.find(s => s.id === id);
            if (member && confirm(`Régénérer un nouveau code d'accès pour "${member.name}" ?`)) {
                await regenerateAccessCode(member, biz);
            }
        } else if (editBtn) {
            const id = editBtn.getAttribute('data-id');
            const member = staffList.find(s => s.id === id);
            if (member) openStaffModal(member, biz);
        }
    });
}

function openStaffModal(staffMember, biz) {
    const isEdit = !!staffMember;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    const currentPerms = staffMember?.permissions || {
        can_discount: false,
        can_cancel_sale: false,
        can_view_reports: false,
        can_manage_stock: false,
        can_manage_staff: false,
        can_manage_cash: true
    };

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 520px;">
            <div class="modal-header">
                <h3 class="modal-title">${isEdit ? 'Modifier le collaborateur' : 'Nouvel Employé'}</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-staff-modal">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Nom et prénom *</label>
                    <input type="text" id="m-staff-name" class="form-control" required value="${staffMember?.name || ''}">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="form-group">
                        <label class="form-label">Rôle *</label>
                        <select id="m-staff-role" class="form-control">
                            <option value="cashier" ${staffMember?.role === 'cashier' ? 'selected' : ''}>Caissier</option>
                            <option value="manager" ${staffMember?.role === 'manager' ? 'selected' : ''}>Gérant</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Téléphone</label>
                        <input type="tel" id="m-staff-phone" class="form-control" value="${staffMember?.phone || ''}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Statut</label>
                    <select id="m-staff-status" class="form-control">
                        <option value="active" ${staffMember?.status !== 'inactive' ? 'selected' : ''}>Actif (Peut se connecter)</option>
                        <option value="inactive" ${staffMember?.status === 'inactive' ? 'selected' : ''}>Désactivé (Accès révoqué)</option>
                    </select>
                </div>

                <!-- PERMISSIONS FINES -->
                <div style="margin-top: 18px; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
                    <label class="form-label" style="margin-bottom: 10px;">Permissions accordées</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                            <input type="checkbox" id="perm-discount" ${currentPerms.can_discount ? 'checked' : ''}>
                            <span>Accorder des remises</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                            <input type="checkbox" id="perm-cancel" ${currentPerms.can_cancel_sale ? 'checked' : ''}>
                            <span>Annuler une vente</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                            <input type="checkbox" id="perm-reports" ${currentPerms.can_view_reports ? 'checked' : ''}>
                            <span>Voir les rapports</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                            <input type="checkbox" id="perm-stock" ${currentPerms.can_manage_stock ? 'checked' : ''}>
                            <span>Ajuster le stock</span>
                        </label>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-staff">Annuler</button>
                <button type="button" class="btn btn-primary" id="btn-save-staff">
                    ${isEdit ? 'Mettre à jour' : 'Créer et générer le code'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-staff-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-staff').onclick = () => overlay.remove();

    overlay.querySelector('#btn-save-staff').onclick = async () => {
        const name = overlay.querySelector('#m-staff-name').value.trim();
        if (!name) {
            toast.warning('Nom obligatoire', 'Saisissez le nom de l\'employé.');
            return;
        }

        const role = overlay.querySelector('#m-staff-role').value;
        const phone = overlay.querySelector('#m-staff-phone').value.trim();
        const status = overlay.querySelector('#m-staff-status').value;

        const perms = {
            can_discount: overlay.querySelector('#perm-discount').checked,
            can_cancel_sale: overlay.querySelector('#perm-cancel').checked,
            can_view_reports: overlay.querySelector('#perm-reports').checked,
            can_manage_stock: overlay.querySelector('#perm-stock').checked,
            can_manage_staff: false,
            can_manage_cash: true
        };

        try {
            if (isEdit) {
                await db.from('cvisual_staff').update({ name, role, phone, status, permissions: perms }).eq('id', staffMember.id);
                toast.success('Employé mis à jour', name);
                overlay.remove();
            } else {
                // Génération automatique d'un code à 6 chiffres
                const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
                const codeHash = await sha256(rawCode);
                const codeHint = `**${rawCode.slice(-4)}`;

                await db.from('cvisual_staff').insert([{
                    business_id: biz.id,
                    name,
                    role,
                    phone,
                    status,
                    permissions: perms,
                    access_code_hash: codeHash,
                    access_code_hint: codeHint
                }]);

                overlay.remove();
                displayNewCodeModal(name, rawCode);
            }

            await loadStaff(biz.id);
            renderStaffTable(biz);
        } catch (err) {
            toast.error('Erreur', err.message);
        }
    };
}

async function regenerateAccessCode(member, biz) {
    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await sha256(rawCode);
    const codeHint = `**${rawCode.slice(-4)}`;

    try {
        await db.from('cvisual_staff').update({
            access_code_hash: codeHash,
            access_code_hint: codeHint
        }).eq('id', member.id);

        await loadStaff(biz.id);
        renderStaffTable(biz);
        displayNewCodeModal(member.name, rawCode);
    } catch (e) {
        toast.error('Erreur génération', e.message);
    }
}

function displayNewCodeModal(staffName, rawCode) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 420px; text-align: center;">
            <div class="modal-body" style="padding: 32px 24px;">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: #FFF7ED; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
                    <i data-lucide="key" style="width: 28px; height: 28px; color: #EA580C;"></i>
                </div>
                <h3 style="font-family: var(--font-heading); font-size: 20px; margin-bottom: 8px;">Code d'accès généré</h3>
                <p style="font-size: 13.5px; color: var(--text-muted); margin-bottom: 20px;">
                    Notez ce code maintenant pour <strong>${staffName}</strong>. Pour des raisons de sécurité, il ne sera plus jamais affiché en clair.
                </p>

                <div style="background: var(--bg-muted); padding: 16px; border-radius: 12px; font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: var(--color-navy); margin-bottom: 20px; user-select: all;">
                    ${rawCode}
                </div>

                <button type="button" class="btn btn-primary" id="btn-copy-code" style="width: 100%;">
                    <i data-lucide="copy"></i> Copier et fermer
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons({ root: overlay });

    overlay.querySelector('#btn-copy-code').onclick = () => {
        navigator.clipboard.writeText(rawCode).catch(() => {});
        toast.success('Copié !', 'Le code a été copié dans le presse-papier.');
        overlay.remove();
    };
}
