/**
 * CVISUAL POS — cash-register.js
 * Gestion de la caisse enregistreuse :
 * Ouverture avec fond de caisse, suivi des encaissements par mode,
 * clôture de session avec réconciliation des écarts et impression du Rapport Z.
 */

import { db } from '../supabase.js';
import { toast } from '../toast.js';

let currentSessionData = null;
let activeCashSession = null;
let pastSessions = [];

export async function render(container, session) {
    currentSessionData = session;
    const biz = session.business;

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Journal & Sessions de Caisse</h1>
                <p class="page-subtitle">Ouverture de caisse, réconciliation des tiroirs-caisses et Rapports Z.</p>
            </div>
            <div id="cash-header-actions"></div>
        </div>

        <!-- ÉTAT DE LA CAISSE ACTIVE -->
        <div id="active-session-widget" style="margin-bottom: 24px;"></div>

        <!-- HISTORIQUE DES SESSIONS PRÉCÉDENTES -->
        <div class="c-card" style="padding: 16px; margin-bottom: 20px;">
            <div style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; color: var(--color-navy);">
                Historique des clôtures de caisse
            </div>
        </div>

        <div id="past-sessions-table">
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                <i data-lucide="loader" style="animation: spin 1s linear infinite; width: 24px; height: 24px;"></i>
                <div style="margin-top: 8px;">Chargement des sessions...</div>
            </div>
        </div>
    `;

    await loadSessionsData(biz.id);
    renderActiveSessionWidget(biz);
    renderPastSessionsTable(biz);
}

async function loadSessionsData(businessId) {
    try {
        const [openRes, pastRes] = await Promise.all([
            db.from('cvisual_cash_sessions')
                .select('*')
                .eq('business_id', businessId)
                .eq('status', 'open')
                .order('opened_at', { ascending: false })
                .maybeSingle(),
            db.from('cvisual_cash_sessions')
                .select('*, cvisual_staff(name)')
                .eq('business_id', businessId)
                .eq('status', 'closed')
                .order('closed_at', { ascending: false })
                .limit(30)
        ]);
        activeCashSession = openRes.data || null;
        pastSessions = pastRes.data || [];
    } catch (e) {
        console.warn('Erreur chargement caisse:', e);
    }
}

function renderActiveSessionWidget(biz) {
    const widget = document.getElementById('active-session-widget');
    const headerActions = document.getElementById('cash-header-actions');
    if (!widget) return;

    const curr = biz.primary_currency || 'HTG';

    if (!activeCashSession) {
        headerActions.innerHTML = `
            <button type="button" class="btn btn-primary" id="btn-open-session">
                <i data-lucide="unlock"></i>
                <span>Ouvrir une session de caisse</span>
            </button>
        `;
        widget.innerHTML = `
            <div class="c-card" style="padding: 32px 24px; text-align: left; background: #FFF7ED; border-color: rgba(249, 115, 22, 0.3);">
                <div style="display: flex; gap: 16px; align-items: flex-start;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: #FFEDD5; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i data-lucide="lock" style="width: 24px; height: 24px; color: #EA580C;"></i>
                    </div>
                    <div>
                        <div style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; color: #9A3412;">
                            Caisse actuellement fermée
                        </div>
                        <div style="font-size: 14px; color: #C2410C; margin-top: 4px; line-height: 1.5;">
                            Aucune session de caisse n'est ouverte. Vous devez définir un fond de caisse initial avant de pouvoir enregistrer les paiements au tiroir.
                        </div>
                        <button type="button" class="btn btn-primary btn-sm" id="btn-open-session-body" style="margin-top: 16px;">
                            <i data-lucide="plus-circle"></i> Saisir le fond de caisse et ouvrir
                        </button>
                    </div>
                </div>
            </div>
        `;

        const openBtn1 = document.getElementById('btn-open-session');
        const openBtn2 = document.getElementById('btn-open-session-body');
        const handleOpen = () => openStartSessionModal(biz);
        if (openBtn1) openBtn1.onclick = handleOpen;
        if (openBtn2) openBtn2.onclick = handleOpen;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    // Caisse Ouverte
    headerActions.innerHTML = `
        <button type="button" class="btn btn-danger" id="btn-close-session">
            <i data-lucide="lock"></i>
            <span>Clôturer la caisse (Rapport Z)</span>
        </button>
    `;

    const openedAt = new Date(activeCashSession.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const expected = Number(activeCashSession.opening_cash) + Number(activeCashSession.total_cash_sales) - Number(activeCashSession.total_expenses);

    widget.innerHTML = `
        <div class="c-card" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <span class="badge badge-success">Session Ouverte à ${openedAt}</span>
                    <h2 style="font-size: 20px; margin-top: 6px;">Tiroir-caisse en cours d'exploitation</h2>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Espèces Attendues</div>
                    <div style="font-family: var(--font-heading); font-size: 24px; font-weight: 800; color: var(--color-navy);">
                        ${expected.toFixed(2)} ${curr}
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;">
                <div style="padding: 12px; background: var(--bg-subtle); border-radius: 10px;">
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Fond Initial</div>
                    <div style="font-weight: 700; font-size: 15px; margin-top: 2px;">${Number(activeCashSession.opening_cash).toFixed(2)} ${curr}</div>
                </div>
                <div style="padding: 12px; background: var(--bg-subtle); border-radius: 10px;">
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Ventes Espèces</div>
                    <div style="font-weight: 700; font-size: 15px; color: var(--color-success); margin-top: 2px;">+${Number(activeCashSession.total_cash_sales).toFixed(2)} ${curr}</div>
                </div>
                <div style="padding: 12px; background: var(--bg-subtle); border-radius: 10px;">
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">MonCash / NatCash</div>
                    <div style="font-weight: 700; font-size: 15px; margin-top: 2px;">${Number(activeCashSession.total_mobile_sales).toFixed(2)} ${curr}</div>
                </div>
                <div style="padding: 12px; background: var(--bg-subtle); border-radius: 10px;">
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Ventes Carte</div>
                    <div style="font-weight: 700; font-size: 15px; margin-top: 2px;">${Number(activeCashSession.total_card_sales).toFixed(2)} ${curr}</div>
                </div>
                <div style="padding: 12px; background: var(--bg-subtle); border-radius: 10px;">
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Dépenses Tiroir</div>
                    <div style="font-weight: 700; font-size: 15px; color: var(--color-danger); margin-top: 2px;">-${Number(activeCashSession.total_expenses).toFixed(2)} ${curr}</div>
                </div>
            </div>
        </div>
    `;

    const closeBtn = document.getElementById('btn-close-session');
    if (closeBtn) closeBtn.onclick = () => openCloseSessionModal(biz, expected);
    if (window.lucide) window.lucide.createIcons();
}

function renderPastSessionsTable(biz) {
    const container = document.getElementById('past-sessions-table');
    if (!container) return;

    if (pastSessions.length === 0) {
        container.innerHTML = `
            <div class="c-card" style="padding: 48px 24px;">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="archive"></i>
                    </div>
                    <div class="empty-state-title">Aucune archive de caisse</div>
                    <div class="empty-state-desc">Vos rapports de fin de journée apparaîtront ici.</div>
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
                        <th>Période d'ouverture</th>
                        <th>Responsable</th>
                        <th>Total Ventes</th>
                        <th>Théorique Attendu</th>
                        <th>Compté Réel</th>
                        <th>Écart (Différence)</th>
                        <th style="text-align: right;">Rapport Z</th>
                    </tr>
                </thead>
                <tbody>
                    ${pastSessions.map(s => {
                        const opened = new Date(s.opened_at).toLocaleDateString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
                        const closed = s.closed_at ? new Date(s.closed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
                        const diff = Number(s.cash_difference);

                        return `
                            <tr>
                                <td>
                                    <div style="font-weight: 600; color: var(--color-navy);">${opened}</div>
                                    <div style="font-size: 11px; color: var(--text-muted);">Fermée à ${closed}</div>
                                </td>
                                <td>${s.cvisual_staff?.name || s.staff?.name || 'Gérant'}</td>
                                <td style="font-weight: 600;">${Number(s.total_sales).toFixed(2)} ${curr}</td>
                                <td>${Number(s.closing_cash_expected).toFixed(2)} ${curr}</td>
                                <td style="font-weight: 700;">${Number(s.closing_cash_actual).toFixed(2)} ${curr}</td>
                                <td>
                                    <span class="badge ${diff === 0 ? 'badge-success' : diff > 0 ? 'badge-info' : 'badge-danger'}">
                                        ${diff > 0 ? '+' : ''}${diff.toFixed(2)} ${curr}
                                    </span>
                                </td>
                                <td style="text-align: right;">
                                    <button type="button" class="btn btn-outline btn-sm btn-print-z" data-id="${s.id}">
                                        <i data-lucide="printer" style="width: 14px; height: 14px;"></i>
                                        <span>Rapport Z</span>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: container });

    // Écouteur impression Rapport Z
    container.querySelectorAll('.btn-print-z').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-id');
            const s = pastSessions.find(item => item.id === id);
            if (s) printReportZ(s, biz);
        };
    });
}

function openStartSessionModal(biz) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 440px;">
            <div class="modal-header">
                <h3 class="modal-title">Ouverture du Tiroir-Caisse</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-open-modal">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Fond de caisse initial (${biz.primary_currency}) *</label>
                    <input type="number" id="m-opening-cash" class="form-control" value="0.00" step="any" autofocus>
                    <span style="font-size: 12px; color: var(--text-muted); margin-top: 4px; display: block;">
                        Monnaie et coupures disponibles dans le tiroir au démarrage.
                    </span>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-open">Annuler</button>
                <button type="button" class="btn btn-primary" id="btn-confirm-open">Ouvrir la session</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-open-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-open').onclick = () => overlay.remove();

    overlay.querySelector('#btn-confirm-open').onclick = async () => {
        const openingCash = parseFloat(overlay.querySelector('#m-opening-cash').value) || 0;

        try {
            await db.from('cvisual_cash_sessions').insert([{
                business_id: biz.id,
                staff_id: currentSessionData.staff?.id || null,
                opening_cash: openingCash,
                closing_cash_expected: openingCash,
                status: 'open'
            }]);

            toast.success('Caisse ouverte', `Fond initial : ${openingCash} ${biz.primary_currency}`);
            overlay.remove();
            await loadSessionsData(biz.id);
            renderActiveSessionWidget(biz);
        } catch (err) {
            toast.error('Erreur', err.message);
        }
    };
}

function openCloseSessionModal(biz, expectedCash) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    const curr = biz.primary_currency || 'HTG';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 480px;">
            <div class="modal-header">
                <h3 class="modal-title">Clôture de Caisse & Réconciliation</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-close-modal">✕</button>
            </div>
            <div class="modal-body">
                <div style="background: var(--bg-subtle); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-muted);">Espèces théoriques attendues :</span>
                        <strong>${expectedCash.toFixed(2)} ${curr}</strong>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Montant réel compté dans le tiroir *</label>
                    <input type="number" id="m-closing-actual" class="form-control" step="any" placeholder="0.00" autofocus>
                </div>

                <div id="reconciliation-diff-box" style="padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; display: none;">
                    <span id="diff-label">Écart : </span>
                    <strong id="diff-val">0.00 ${curr}</strong>
                </div>

                <div class="form-group">
                    <label class="form-label">Notes de clôture / Remarques</label>
                    <textarea id="m-closing-notes" class="form-control" rows="2" placeholder="Ex: Erreur de monnaie de 20 HTG sur ticket #4"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-close">Annuler</button>
                <button type="button" class="btn btn-danger" id="btn-confirm-close">Valider et Imprimer Rapport Z</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const actualInput = overlay.querySelector('#m-closing-actual');
    const diffBox = overlay.querySelector('#reconciliation-diff-box');
    const diffVal = overlay.querySelector('#diff-val');

    actualInput.oninput = () => {
        const val = parseFloat(actualInput.value);
        if (!isNaN(val)) {
            const diff = val - expectedCash;
            diffBox.style.display = 'block';
            diffVal.textContent = `${diff > 0 ? '+' : ''}${diff.toFixed(2)} ${curr}`;
            if (diff === 0) {
                diffBox.style.background = '#ECFDF5';
                diffBox.style.color = '#059669';
            } else if (diff > 0) {
                diffBox.style.background = '#EFF6FF';
                diffBox.style.color = '#2563EB';
            } else {
                diffBox.style.background = '#FEF2F2';
                diffBox.style.color = '#DC2626';
            }
        } else {
            diffBox.style.display = 'none';
        }
    };

    overlay.querySelector('#btn-close-close-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-close').onclick = () => overlay.remove();

    overlay.querySelector('#btn-confirm-close').onclick = async () => {
        const actualCash = parseFloat(actualInput.value);
        if (isNaN(actualCash)) {
            toast.warning('Saisie manquante', 'Veuillez saisir le montant réel compté.');
            return;
        }

        const notes = overlay.querySelector('#m-closing-notes').value.trim();

        try {
            const { data, error } = await db.rpc('cvisual_close_cash_session', {
                p_session_id: activeCashSession.id,
                p_actual_cash: actualCash,
                p_notes: notes
            });

            if (error) throw error;

            toast.success('Session clôturée', 'Rapport Z généré.');
            overlay.remove();
            
            // Imprimer le rapport Z
            const updatedSession = { ...activeCashSession, closing_cash_actual: actualCash, closing_cash_expected: expectedCash, cash_difference: (actualCash - expectedCash), closed_at: new Date().toISOString(), notes };
            printReportZ(updatedSession, biz);

            await loadSessionsData(biz.id);
            renderActiveSessionWidget(biz);
            renderPastSessionsTable(biz);
        } catch (err) {
            toast.error('Erreur clôture', err.message);
        }
    };
}

function printReportZ(sessionObj, biz) {
    const curr = biz.primary_currency || 'HTG';
    const diff = Number(sessionObj.cash_difference || 0);

    const reportHTML = `
        <div style="font-family: monospace; max-width: 320px; margin: 0 auto; padding: 12px; font-size: 12px; line-height: 1.4;">
            <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
                <h2 style="font-size: 16px; margin: 0;">${biz.name}</h2>
                <div style="font-size: 11px;">RAPPORT Z — CLÔTURE DE CAISSE</div>
                <div style="font-size: 10px; margin-top: 4px;">Date : ${new Date().toLocaleString('fr-FR')}</div>
            </div>

            <div style="margin-bottom: 8px;">
                <div>Ouverture : ${new Date(sessionObj.opened_at).toLocaleTimeString('fr-FR')}</div>
                <div>Fermeture : ${new Date(sessionObj.closed_at || Date.now()).toLocaleTimeString('fr-FR')}</div>
                <div>Caissier : ${sessionObj.staff?.name || 'Gérant'}</div>
            </div>

            <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Fond de caisse :</span>
                    <strong>${Number(sessionObj.opening_cash).toFixed(2)} ${curr}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Ventes Espèces :</span>
                    <strong>+${Number(sessionObj.total_cash_sales).toFixed(2)} ${curr}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Ventes Mobiles :</span>
                    <strong>+${Number(sessionObj.total_mobile_sales).toFixed(2)} ${curr}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Ventes Cartes :</span>
                    <strong>+${Number(sessionObj.total_card_sales).toFixed(2)} ${curr}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Dépenses décaissées :</span>
                    <strong>-${Number(sessionObj.total_expenses).toFixed(2)} ${curr}</strong>
                </div>
            </div>

            <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>TOTAL VENTES :</span>
                    <strong>${Number(sessionObj.total_sales).toFixed(2)} ${curr}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Espèces Attendues :</span>
                    <strong>${Number(sessionObj.closing_cash_expected).toFixed(2)} ${curr}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Espèces Comptées :</span>
                    <strong>${Number(sessionObj.closing_cash_actual).toFixed(2)} ${curr}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 4px;">
                    <span>ÉCART CONSTATÉ :</span>
                    <span>${diff > 0 ? '+' : ''}${diff.toFixed(2)} ${curr}</span>
                </div>
            </div>

            ${sessionObj.notes ? `
                <div style="border-top: 1px dashed #000; padding-top: 6px; font-size: 11px;">
                    Notes : ${sessionObj.notes}
                </div>
            ` : ''}

            <div style="text-align: center; margin-top: 14px; font-size: 9px; text-transform: uppercase;">
                Designed by Cvisual
            </div>
        </div>
    `;

    const printWin = window.open('', '_blank', 'width=350,height=500');
    if (printWin) {
        printWin.document.write(`<html><head><title>Rapport Z</title></head><body>${reportHTML}</body></html>`);
        printWin.document.close();
        printWin.focus();
        printWin.print();
    }
}
