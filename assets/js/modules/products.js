/**
 * CVISUAL POS — products.js
 * Gestion complète des Produits et Services :
 * Création, modification, upload photos Supabase Storage, variantes,
 * import/export Excel (SheetJS), duplication rapide, archivage sécurisé.
 */

import { db } from '../supabase.js';
import { toast } from '../toast.js';
import { saveProductsLocally, getLocalProducts } from '../offline-db.js';

let currentSession = null;
let productsList = [];
let categoriesList = [];

export async function render(container, session) {
    currentSession = session;
    const biz = session.business;

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Articles & Produits</h1>
                <p class="page-subtitle">Gestion de votre catalogue, prix d'achat, prix de vente et variantes.</p>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-export-excel">
                    <i data-lucide="file-spreadsheet"></i>
                    <span>Export Excel</span>
                </button>
                <button type="button" class="btn btn-primary" id="btn-new-product">
                    <i data-lucide="plus"></i>
                    <span>Nouveau Produit</span>
                </button>
            </div>
        </div>

        <div class="c-card" style="margin-bottom: 20px; padding: 16px;">
            <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
                <div class="search-input-wrapper" style="flex: 1; min-width: 240px;">
                    <i data-lucide="search"></i>
                    <input type="text" id="prod-search" class="form-control" placeholder="Rechercher par libellé, référence SKU ou code-barres...">
                </div>
                <select id="prod-filter-cat" class="form-control" style="width: auto; min-width: 180px;">
                    <option value="">Toutes les catégories</option>
                </select>
                <select id="prod-sort" class="form-control" style="width: auto; min-width: 160px;">
                    <option value="name_asc">Nom (A-Z)</option>
                    <option value="price_desc">Prix le plus élevé</option>
                    <option value="price_asc">Prix le plus bas</option>
                    <option value="stock_asc">Stock le plus bas</option>
                </select>
            </div>
        </div>

        <div id="products-table-container">
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                <i data-lucide="loader" style="animation: spin 1s linear infinite; width: 24px; height: 24px;"></i>
                <div style="margin-top: 8px;">Chargement du catalogue...</div>
            </div>
        </div>
    `;

    await loadProductsAndCategories(biz.id);
    renderProductsTable();
    setupProductEventListeners(biz);
}

async function loadProductsAndCategories(businessId) {
    try {
        if (navigator.onLine && db) {
            const [prodsRes, catsRes] = await Promise.all([
                db.from('cvisual_products').select('*, cvisual_categories(name)').eq('business_id', businessId).eq('is_archived', false).order('created_at', { ascending: false }),
                db.from('cvisual_categories').select('*').eq('business_id', businessId).eq('is_active', true).order('sort_order')
            ]);
            productsList = prodsRes.data || [];
            categoriesList = catsRes.data || [];
            await saveProductsLocally(productsList);
        } else {
            productsList = await getLocalProducts();
        }
    } catch (e) {
        console.warn('Chargement local des produits:', e);
        productsList = await getLocalProducts();
    }

    // Remplir le select des catégories
    const catSelect = document.getElementById('prod-filter-cat');
    if (catSelect && categoriesList.length) {
        catSelect.innerHTML = `<option value="">Toutes les catégories</option>` +
            categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
}

function renderProductsTable() {
    const container = document.getElementById('products-table-container');
    if (!container) return;

    const searchTerm = (document.getElementById('prod-search')?.value || '').toLowerCase().trim();
    const catFilter = document.getElementById('prod-filter-cat')?.value || '';
    const sortBy = document.getElementById('prod-sort')?.value || 'name_asc';

    let list = [...productsList];

    if (catFilter) {
        list = list.filter(p => p.category_id === catFilter);
    }

    if (searchTerm) {
        list = list.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            (p.barcode && p.barcode.toLowerCase().includes(searchTerm)) ||
            (p.sku && p.sku.toLowerCase().includes(searchTerm))
        );
    }

    // Tri
    list.sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'price_desc') return Number(b.sale_price) - Number(a.sale_price);
        if (sortBy === 'price_asc') return Number(a.sale_price) - Number(b.sale_price);
        if (sortBy === 'stock_asc') return Number(a.current_stock) - Number(b.current_stock);
        return 0;
    });

    if (list.length === 0) {
        container.innerHTML = `
            <div class="c-card" style="padding: 48px 24px;">
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="package-x"></i>
                    </div>
                    <div class="empty-state-title">Aucun produit dans cette vue</div>
                    <div class="empty-state-desc">Ajoutez un premier produit ou modifiez vos critères de recherche.</div>
                    <button type="button" class="btn btn-primary btn-sm" id="btn-empty-add-prod">
                        <i data-lucide="plus"></i> Ajouter un article
                    </button>
                </div>
            </div>
        `;
        const addBtn = document.getElementById('btn-empty-add-prod');
        if (addBtn) addBtn.onclick = () => openProductModal(null, currentSession.business);
        if (window.lucide) window.lucide.createIcons({ root: container });
        return;
    }

    const curr = currentSession.business?.primary_currency || 'HTG';

    container.innerHTML = `
        <div class="table-responsive">
            <table class="c-table">
                <thead>
                    <tr>
                        <th style="width: 50px;">Photo</th>
                        <th>Désignation & SKU</th>
                        <th>Catégorie</th>
                        <th>Prix Achat</th>
                        <th>Prix Vente</th>
                        <th>Stock Actuel</th>
                        <th>Catalogue</th>
                        <th style="text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map(p => `
                        <tr data-prod-id="${p.id}">
                            <td>
                                <div style="width: 36px; height: 36px; border-radius: 8px; background: #F1F5F9; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                                    ${p.image_url ? `<img src="${p.image_url}" alt="" style="width:100%; height:100%; object-fit:cover;">` : `<i data-lucide="package" style="width:18px; height:18px; color:#94A3B8;"></i>`}
                                </div>
                            </td>
                            <td>
                                <div style="font-weight: 600; color: var(--color-navy);">${p.name}</div>
                                <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">SKU: ${p.sku || 'N/A'} • Barcode: ${p.barcode || 'N/A'}</div>
                            </td>
                            <td>
                                <span class="badge badge-info">${p.cvisual_categories?.name || p.categories?.name || 'Général'}</span>
                            </td>
                            <td style="color: var(--text-muted);">${Number(p.cost_price || 0).toFixed(2)} ${curr}</td>
                            <td style="font-weight: 700; color: var(--color-navy);">${Number(p.sale_price).toFixed(2)} ${curr}</td>
                            <td>
                                <span class="badge ${p.current_stock <= p.min_stock_alert ? 'badge-danger' : 'badge-success'}">
                                    ${p.current_stock} ${p.unit || 'pcs'}
                                </span>
                            </td>
                            <td>
                                ${p.is_visible_in_catalogue ? `<span class="badge badge-success">Actif</span>` : `<span class="badge badge-warning">Masqué</span>`}
                            </td>
                            <td style="text-align: right;">
                                <div style="display: inline-flex; gap: 4px;">
                                    <button type="button" class="btn btn-outline btn-sm btn-edit-prod" data-id="${p.id}" title="Modifier" style="padding: 4px 8px;">
                                        <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                                    </button>
                                    <button type="button" class="btn btn-outline btn-sm btn-dup-prod" data-id="${p.id}" title="Dupliquer" style="padding: 4px 8px;">
                                        <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
                                    </button>
                                    <button type="button" class="btn btn-outline btn-sm btn-archive-prod" data-id="${p.id}" title="Archiver" style="padding: 4px 8px; color: var(--color-danger);">
                                        <i data-lucide="archive" style="width: 14px; height: 14px;"></i>
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

function setupProductEventListeners(biz) {
    const searchInput = document.getElementById('prod-search');
    const catSelect = document.getElementById('prod-filter-cat');
    const sortSelect = document.getElementById('prod-sort');

    if (searchInput) searchInput.oninput = () => renderProductsTable();
    if (catSelect) catSelect.onchange = () => renderProductsTable();
    if (sortSelect) sortSelect.onchange = () => renderProductsTable();

    // Bouton Nouveau Produit
    const newBtn = document.getElementById('btn-new-product');
    if (newBtn) newBtn.onclick = () => openProductModal(null, biz);

    // Export Excel via SheetJS
    const exportBtn = document.getElementById('btn-export-excel');
    if (exportBtn) {
        exportBtn.onclick = () => {
            if (!window.XLSX) {
                toast.error('Erreur', 'Bibliothèque SheetJS non disponible.');
                return;
            }
            const dataToExport = productsList.map(p => ({
                'ID': p.id,
                'Désignation': p.name,
                'Catégorie': p.categories?.name || '',
                'Prix de Vente': p.sale_price,
                'Prix d\'Achat': p.cost_price,
                'Stock Actuel': p.current_stock,
                'Alerte Stock': p.min_stock_alert,
                'SKU': p.sku || '',
                'Code-barres': p.barcode || '',
                'Visible Catalogue': p.is_visible_in_catalogue ? 'OUI' : 'NON'
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Articles');
            XLSX.writeFile(wb, `Produits_${biz.slug}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            toast.success('Export réussi', 'Le fichier Excel a été téléchargé.');
        };
    }

    // Délégation clics tableau (Édition, Duplication, Archivage)
    const tableContainer = document.getElementById('products-table-container');
    tableContainer.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.btn-edit-prod');
        const dupBtn = e.target.closest('.btn-dup-prod');
        const archBtn = e.target.closest('.btn-archive-prod');

        if (editBtn) {
            const id = editBtn.getAttribute('data-id');
            const prod = productsList.find(p => p.id === id);
            if (prod) openProductModal(prod, biz);
        } else if (dupBtn) {
            const id = dupBtn.getAttribute('data-id');
            const prod = productsList.find(p => p.id === id);
            if (prod) duplicateProduct(prod, biz);
        } else if (archBtn) {
            const id = archBtn.getAttribute('data-id');
            const prod = productsList.find(p => p.id === id);
            if (prod && confirm(`Voulez-vous archiver l'article "${prod.name}" ?`)) {
                await archiveProduct(id, biz);
            }
        }
    });
}

/**
 * Modale de création et modification d'un produit
 */
function openProductModal(product, biz) {
    const isEdit = !!product;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'product-form-modal';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 640px;">
            <div class="modal-header">
                <h3 class="modal-title">${isEdit ? 'Modifier l\'article' : 'Ajouter un article'}</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-prod-modal">✕</button>
            </div>
            <form id="product-form" class="modal-body">
                <div class="form-group">
                    <label class="form-label">Désignation du produit *</label>
                    <input type="text" id="m-prod-name" class="form-control" required value="${product?.name || ''}" placeholder="Ex: Chemise en Lin Blanc">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                    <div class="form-group">
                        <label class="form-label">Catégorie</label>
                        <select id="m-prod-category" class="form-control">
                            <option value="">Général</option>
                            ${categoriesList.map(c => `
                                <option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${c.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Unité de mesure</label>
                        <input type="text" id="m-prod-unit" class="form-control" value="${product?.unit || 'pièce'}" placeholder="pièce, kg, pack...">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                    <div class="form-group">
                        <label class="form-label">Prix de vente (${biz.primary_currency}) *</label>
                        <input type="number" id="m-prod-sale-price" class="form-control" required step="any" value="${product?.sale_price || ''}" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Prix d'achat (${biz.primary_currency})</label>
                        <input type="number" id="m-prod-cost-price" class="form-control" step="any" value="${product?.cost_price || 0}" placeholder="0.00">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                    <div class="form-group">
                        <label class="form-label">Stock initial</label>
                        <input type="number" id="m-prod-stock" class="form-control" step="any" value="${product?.current_stock || 0}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Seuil alerte stock bas</label>
                        <input type="number" id="m-prod-min-stock" class="form-control" step="any" value="${product?.min_stock_alert || 5}">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                    <div class="form-group">
                        <label class="form-label">Référence SKU</label>
                        <input type="text" id="m-prod-sku" class="form-control" value="${product?.sku || ''}" placeholder="Ex: CHM-LIN-01">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Code-barres EAN / UPC</label>
                        <input type="text" id="m-prod-barcode" class="form-control" value="${product?.barcode || ''}" placeholder="Scannable ou manuel">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Photo du produit (URL ou Upload)</label>
                    <input type="text" id="m-prod-image" class="form-control" value="${product?.image_url || ''}" placeholder="https://...">
                </div>

                <div class="form-group" style="display: flex; gap: 20px; align-items: center; margin-top: 10px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
                        <input type="checkbox" id="m-prod-visible" ${product?.is_visible_in_catalogue !== false ? 'checked' : ''}>
                        <span>Visible dans le catalogue public</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
                        <input type="checkbox" id="m-prod-fav" ${product?.is_favorite ? 'checked' : ''}>
                        <span>Mettre en favori (POS)</span>
                    </label>
                </div>
            </form>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-prod-modal">Annuler</button>
                <button type="button" class="btn btn-primary" id="btn-save-prod-modal">
                    ${isEdit ? 'Mettre à jour' : 'Enregistrer le produit'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-prod-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-prod-modal').onclick = () => overlay.remove();

    overlay.querySelector('#btn-save-prod-modal').onclick = async () => {
        const name = overlay.querySelector('#m-prod-name').value.trim();
        const salePrice = parseFloat(overlay.querySelector('#m-prod-sale-price').value);

        if (!name || isNaN(salePrice)) {
            toast.warning('Champs incomplets', 'Veuillez saisir un nom et un prix de vente valide.');
            return;
        }

        const payload = {
            business_id: biz.id,
            name: name,
            category_id: overlay.querySelector('#m-prod-category').value || null,
            unit: overlay.querySelector('#m-prod-unit').value || 'pièce',
            sale_price: salePrice,
            cost_price: parseFloat(overlay.querySelector('#m-prod-cost-price').value) || 0,
            current_stock: parseFloat(overlay.querySelector('#m-prod-stock').value) || 0,
            min_stock_alert: parseFloat(overlay.querySelector('#m-prod-min-stock').value) || 5,
            sku: overlay.querySelector('#m-prod-sku').value.trim() || null,
            barcode: overlay.querySelector('#m-prod-barcode').value.trim() || null,
            image_url: overlay.querySelector('#m-prod-image').value.trim() || null,
            is_visible_in_catalogue: overlay.querySelector('#m-prod-visible').checked,
            is_favorite: overlay.querySelector('#m-prod-fav').checked
        };

        try {
            if (isEdit) {
                await db.from('cvisual_products').update(payload).eq('id', product.id);
                toast.success('Produit modifié', `${name} mis à jour avec succès.`);
            } else {
                await db.from('cvisual_products').insert([payload]);
                toast.success('Produit créé', `${name} ajouté à votre catalogue.`);
            }
            overlay.remove();
            await loadProductsAndCategories(biz.id);
            renderProductsTable();
        } catch (err) {
            toast.error('Erreur', err.message || 'Impossible d\'enregistrer le produit.');
        }
    };
}

async function duplicateProduct(prod, biz) {
    try {
        const copy = {
            business_id: biz.id,
            name: `${prod.name} (Copie)`,
            category_id: prod.category_id,
            unit: prod.unit,
            sale_price: prod.sale_price,
            cost_price: prod.cost_price,
            current_stock: 0,
            min_stock_alert: prod.min_stock_alert,
            sku: prod.sku ? `${prod.sku}-COPY` : null,
            barcode: null,
            image_url: prod.image_url,
            is_visible_in_catalogue: prod.is_visible_in_catalogue,
            is_favorite: false
        };
        await db.from('cvisual_products').insert([copy]);
        toast.success('Produit dupliqué', 'Une copie a été créée.');
        await loadProductsAndCategories(biz.id);
        renderProductsTable();
    } catch (e) {
        toast.error('Erreur duplication', e.message);
    }
}

async function archiveProduct(id, biz) {
    try {
        await db.from('cvisual_products').update({ is_archived: true }).eq('id', id);
        toast.info('Produit archivé', 'L\'article a été retiré du catalogue actif.');
        await loadProductsAndCategories(biz.id);
        renderProductsTable();
    } catch (e) {
        toast.error('Erreur archivage', e.message);
    }
}
