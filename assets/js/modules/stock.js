/**
 * CVISUAL POS — stock.js
 * Gestion de l'inventaire et des mouvements de stock :
 * Entrées, sorties, ajustements, pertes, inventaire physique et alertes réassort.
 */

import { db } from '../supabase.js';
import { toast } from '../toast.js';

let currentSession = null;
let stockMovements = [];
let lowStockProducts = [];

export async function render(container, session) {
    currentSession = session;
    const biz = session.business;

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Gestion des Stocks</h1>
                <p class="page-subtitle">Suivi des entrées, sorties, inventaires physiques et alertes réapprovisionnement.</p>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-physical-inventory">
                    <i data-lucide="clipboard-check"></i>
                    <span>Inventaire Physique</span>
                </button>
                <button type="button" class="btn btn-primary" id="btn-new-movement">
                    <i data-lucide="arrow-up-down"></i>
                    <span>Nouveau Mouvement</span>
                </button>
            </div>
        </div>

        <!-- ALERTE STOCK BAS SI PRODUITS CONCERNÉS -->
        <div id="low-stock-alert-box" style="margin-bottom: 24px;"></div>

        <!-- ONGLETS HISTORIQUE DES MOUVEMENTS -->
        <div class="c-card" style="padding: 16px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; color: var(--color-navy);">
                    Derniers mouvements enregistrés
                </div>
                <div style="display: flex; gap: 8px;">
                    <select id="filter-movement-type" class="form-control" style="width: auto; height: 38px;">
                        <option value="">Tous les types</option>
                        <option value="in">Entrées (+)</option>
                        <option value="out">Sorties (-)</option>
                        <option value="adjustment">Ajustements</option>
                        <option value="loss">Pertes / Casses</option>
                        <option value="sale">Ventes en caisse</option>
                    </select>
                </div>
            </div>
        </div>

        <div id="stock-movements-table">
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                <i data-lucide="loader" style="animation: spin 1s linear infinite; width: 24px; height: 24px;"></i>
                <div style="margin-top: 8px;">Chargement de l'historique...</div>
            </div>
        </div>
    `;

    await loadStockData(biz.id);
    renderLowStockBox(biz);
    renderMovementsTable();
    setupStockListeners(biz);
}

async function loadStockData(businessId) {
    try {
        if (navigator.onLine && db) {
            const [movRes, lowRes] = await Promise.all([
                db.from('cvisual_stock_movements')
                    .select('*, cvisual_products(name, unit)')
                    .eq('business_id', businessId)
                    .order('created_at', { ascending: false })
                    .limit(50),
                db.from('cvisual_products')
                    .select('*')
                    .eq('business_id', businessId)
                    .eq('is_archived', false)
                    .filter('current_stock', 'lte', 'min_stock_alert')
            ]);
            stockMovements = movRes.data || [];
            lowStockProducts = (lowRes.data || []).filter(p => Number(p.current_stock) <= Number(p.min_stock_alert));
        }
    } catch (e) {
        console.warn('Erreur chargement stock:', e);
    }
}

function renderLowStockBox(biz) {
    const box = document.getElementById('low-stock-alert-box');
    if (!box) return;

    if (lowStockProducts.length === 0) {
        box.innerHTML = '';
        return;
    }

    box.innerHTML = `
        <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: var(--radius-lg); padding: 18px 20px; display: flex; align-items: flex-start; gap: 14px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: #FEF3C7; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i data-lucide="alert-triangle" style="width: 20px; height: 20px; color: #D97706;"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 14px; color: #92400E;">
                    ${lowStockProducts.length} article(s) sous le seuil d'alerte
                </div>
                <div style="font-size: 13px; color: #B45309; margin-top: 4px;">
                    Certains de vos produits nécessitent un réapprovisionnement urgent :
                    <strong>${lowStockProducts.slice(0, 3).map(p => `${p.name} (${p.current_stock})`).join(', ')}</strong>
                    ${lowStockProducts.length > 3 ? ` et ${lowStockProducts.length - 3} autres...` : ''}
                </div>
            </div>
        </div>
    `;
    if (window.lucide) window.lucide.createIcons({ root: box });
}

function renderMovementsTable() {
    const container = document.getElementById('stock-movements-table');
    if (!container) return;

    const filterType = document.getElementById('filter-movement-type')?.value || '';
    let list = stockMovements;

    if (filterType) {
        list = list.filter(m => m.type === filterType);
    }

    if (list.length === 0) {
        container.innerHTML = `
            <div class="c-card" style="padding: 48px 24px;">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="boxes"></i>
                    </div>
                    <div class="empty-state-title">Aucun mouvement de stock</div>
                    <div class="empty-state-desc">Les entrées de marchandises et les ventes en caisse apparaîtront ici.</div>
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
                        <th>Date & Heure</th>
                        <th>Article</th>
                        <th>Type d'opération</th>
                        <th>Quantité</th>
                        <th>Stock Résultant</th>
                        <th>Motif / Réf</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map(m => {
                        const isPositive = Number(m.quantity) > 0;
                        const dateFormatted = new Date(m.created_at).toLocaleString('fr-FR', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                        });

                        const typeLabels = {
                            in: 'Entrée (+) Réception',
                            out: 'Sortie (-)',
                            adjustment: 'Ajustement Inventaire',
                            loss: 'Perte / Casse / Vol',
                            return: 'Retour client',
                            sale: 'Vente en caisse',
                            purchase: 'Bon de réception'
                        };

                        return `
                            <tr>
                                <td style="font-size: 13px; color: var(--text-muted);">${dateFormatted}</td>
                                <td>
                                    <strong style="color: var(--color-navy);">${m.cvisual_products?.name || m.products?.name || 'Article'}</strong>
                                </td>
                                <td>
                                    <span class="badge ${isPositive ? 'badge-success' : 'badge-danger'}">
                                        ${typeLabels[m.type] || m.type}
                                    </span>
                                </td>
                                <td style="font-weight: 700; color: ${isPositive ? 'var(--color-success)' : 'var(--color-danger)'};">
                                    ${isPositive ? '+' : ''}${m.quantity} ${m.cvisual_products?.unit || m.products?.unit || ''}
                                </td>
                                <td style="font-weight: 600; color: var(--color-navy);">
                                    ${m.new_stock !== null ? m.new_stock : '-'}
                                </td>
                                <td style="font-size: 13px; color: var(--text-muted);">
                                    ${m.reason || '-'}
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

function setupStockListeners(biz) {
    const filterSelect = document.getElementById('filter-movement-type');
    if (filterSelect) filterSelect.onchange = () => renderMovementsTable();

    // Nouveau Mouvement
    const newBtn = document.getElementById('btn-new-movement');
    if (newBtn) newBtn.onclick = () => openStockMovementModal(biz);

    // Inventaire Physique
    const invBtn = document.getElementById('btn-physical-inventory');
    if (invBtn) invBtn.onclick = () => openPhysicalInventoryModal(biz);
}

/**
 * Modale de saisie de mouvement de stock
 */
async function openStockMovementModal(biz) {
    // Récupérer les produits pour le select
    const { data: prods } = await db.from('cvisual_products').select('id, name, current_stock, unit').eq('business_id', biz.id).eq('is_archived', false).order('name');
    if (!prods || prods.length === 0) {
        toast.warning('Catalogue vide', 'Créez d\'abord des produits pour gérer les mouvements.');
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 520px;">
            <div class="modal-header">
                <h3 class="modal-title">Nouveau Mouvement de Stock</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-mov-modal">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Sélectionner l'article *</label>
                    <select id="m-mov-prod" class="form-control">
                        ${prods.map(p => `
                            <option value="${p.id}" data-stock="${p.current_stock}">
                                ${p.name} (Stock actuel : ${p.current_stock} ${p.unit})
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Type d'opération *</label>
                    <select id="m-mov-type" class="form-control">
                        <option value="in">Entrée de stock (Réassort fournisseur)</option>
                        <option value="out">Sortie manuelle de stock</option>
                        <option value="adjustment">Ajustement d'inventaire</option>
                        <option value="loss">Perte, Casse ou Vol</option>
                        <option value="return">Retour marchandise</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Quantité *</label>
                    <input type="number" id="m-mov-qty" class="form-control" step="any" min="0.01" placeholder="Ex: 10">
                </div>

                <div class="form-group">
                    <label class="form-label">Motif ou Référence de facture</label>
                    <input type="text" id="m-mov-reason" class="form-control" placeholder="Ex: Facture Fournisseur #492">
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-mov">Annuler</button>
                <button type="button" class="btn btn-primary" id="btn-save-mov">Valider le mouvement</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-mov-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-mov').onclick = () => overlay.remove();

    overlay.querySelector('#btn-save-mov').onclick = async () => {
        const prodId = overlay.querySelector('#m-mov-prod').value;
        const type = overlay.querySelector('#m-mov-type').value;
        const qty = parseFloat(overlay.querySelector('#m-mov-qty').value);
        const reason = overlay.querySelector('#m-mov-reason').value.trim();

        if (!qty || isNaN(qty) || qty <= 0) {
            toast.warning('Quantité invalide', 'Veuillez saisir une quantité supérieure à 0.');
            return;
        }

        const selectedProd = prods.find(p => p.id === prodId);
        const currentStock = Number(selectedProd?.current_stock) || 0;
        let delta = qty;

        if (['out', 'loss'].includes(type)) {
            delta = -qty;
        }

        const newStock = currentStock + delta;

        try {
            // Mettre à jour le produit
            await db.from('cvisual_products').update({ current_stock: newStock }).eq('id', prodId);

            // Insérer dans cvisual_stock_movements
            await db.from('cvisual_stock_movements').insert([{
                business_id: biz.id,
                product_id: prodId,
                staff_id: currentSession.staff?.id || null,
                type: type,
                quantity: delta,
                previous_stock: currentStock,
                new_stock: newStock,
                reason: reason || 'Mouvement manuel'
            }]);

            toast.success('Stock mis à jour', `Nouveau stock pour ${selectedProd.name} : ${newStock}`);
            overlay.remove();
            await loadStockData(biz.id);
            renderLowStockBox(biz);
            renderMovementsTable();
        } catch (err) {
            toast.error('Erreur', err.message);
        }
    };
}

/**
 * Modale d'Inventaire Physique
 */
async function openPhysicalInventoryModal(biz) {
    const { data: prods } = await db.from('cvisual_products').select('id, name, current_stock, unit').eq('business_id', biz.id).eq('is_archived', false).order('name');
    if (!prods) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 680px;">
            <div class="modal-header">
                <h3 class="modal-title">Inventaire Physique des Stocks</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-inv-modal">✕</button>
            </div>
            <div class="modal-body" style="max-height: 65vh; overflow-y: auto;">
                <p style="font-size: 13.5px; color: var(--text-muted); margin-bottom: 16px;">
                    Saisissez les quantités réelles constatées lors du comptage physique. Les ajustements seront générés automatiquement.
                </p>
                <div class="table-responsive">
                    <table class="c-table">
                        <thead>
                            <tr>
                                <th>Article</th>
                                <th>Stock Théorique</th>
                                <th>Comptage Réel</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${prods.map(p => `
                                <tr>
                                    <td><strong>${p.name}</strong></td>
                                    <td>${p.current_stock} ${p.unit}</td>
                                    <td>
                                        <input type="number" class="form-control inv-real-input" data-id="${p.id}" data-prev="${p.current_stock}" value="${p.current_stock}" style="width: 110px; height: 36px;">
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-inv">Annuler</button>
                <button type="button" class="btn btn-primary" id="btn-save-inv">Valider l'inventaire</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-inv-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-inv').onclick = () => overlay.remove();

    overlay.querySelector('#btn-save-inv').onclick = async () => {
        const inputs = overlay.querySelectorAll('.inv-real-input');
        let adjustedCount = 0;

        for (const input of inputs) {
            const prodId = input.getAttribute('data-id');
            const prevStock = parseFloat(input.getAttribute('data-prev'));
            const realStock = parseFloat(input.value);

            if (!isNaN(realStock) && realStock !== prevStock) {
                const diff = realStock - prevStock;
                await db.from('cvisual_products').update({ current_stock: realStock }).eq('id', prodId);
                await db.from('cvisual_stock_movements').insert([{
                    business_id: biz.id,
                    product_id: prodId,
                    type: 'adjustment',
                    quantity: diff,
                    previous_stock: prevStock,
                    new_stock: realStock,
                    reason: 'Inventaire physique régulier'
                }]);
                adjustedCount++;
            }
        }

        toast.success('Inventaire validé', `${adjustedCount} article(s) ajusté(s).`);
        overlay.remove();
        await loadStockData(biz.id);
        renderLowStockBox(biz);
        renderMovementsTable();
    };
}
