/**
 * CVISUAL POS — sales.js
 * Module Écran de Vente (Cœur du système POS)
 * Grille produits, scan code-barres, panier réactif, remises, paiements multiples,
 * mise en attente (Hold/Resume), mode hors-ligne instantané et impression de ticket.
 */

import { db } from '../supabase.js';
import { getLocalProducts, getLocalCategories, getLocalCustomers, queuePendingSale } from '../offline-db.js';
import { toast } from '../toast.js';
import { printReceipt, openReceiptPreviewModal } from './receipt.js';
import { openSendReceiptModal, sendReceiptWhatsApp } from './whatsapp.js';
import { updateSyncBadge } from '../sync.js';

let currentSession = null;
let currentProducts = [];
let currentCategories = [];
let currentCustomers = [];
let cart = [];
let activeCategoryId = '';
let activeSearchTerm = '';
let heldSales = JSON.parse(localStorage.getItem('CVISUAL_HELD_SALES') || '[]');
let activeCustomer = null;
let discountPercent = 0;

export async function render(container, session) {
    currentSession = session;
    const biz = session.business;

    // Charger les produits et catégories (depuis IndexedDB ou Supabase)
    await loadCatalogData(biz.id);

    container.innerHTML = `
        <div class="page-header" style="margin-bottom: 16px;">
            <div>
                <h1 class="page-title">Point de Vente</h1>
                <p class="page-subtitle">${biz.name} • Session Caissier : <strong>${session.staff?.name || 'Gérant'}</strong></p>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-held-sales">
                    <i data-lucide="archive"></i>
                    <span>En attente (<span id="held-count">${heldSales.length}</span>)</span>
                </button>
                <button type="button" class="btn btn-outline btn-sm" id="btn-toggle-fullscreen" title="Plein écran">
                    <i data-lucide="maximize"></i>
                </button>
            </div>
        </div>

        <div class="pos-layout">
            <!-- SECTION CATALOGUE ET RECHERCHE -->
            <div class="pos-catalog-section">
                <div class="pos-search-bar">
                    <div class="search-input-wrapper">
                        <i data-lucide="search"></i>
                        <input type="text" id="pos-search-input" class="form-control" placeholder="Rechercher par nom, SKU ou code-barres (F2)..." autofocus autocomplete="off">
                    </div>
                    <button type="button" class="btn btn-outline" id="btn-scan-barcode" title="Scanner un code-barres">
                        <i data-lucide="scan-barcode"></i>
                        <span class="desktop-only">Scan</span>
                    </button>
                </div>

                <!-- CATÉGORIES -->
                <div class="category-pills" id="pos-category-pills">
                    <button type="button" class="category-pill active" data-cat-id="">
                        <i data-lucide="layout-grid"></i>
                        <span>Tous</span>
                    </button>
                    <button type="button" class="category-pill" data-cat-id="favorites">
                        <i data-lucide="star"></i>
                        <span>Favoris</span>
                    </button>
                    ${currentCategories.map(c => `
                        <button type="button" class="category-pill" data-cat-id="${c.id}">
                            <span>${c.name}</span>
                        </button>
                    `).join('')}
                </div>

                <!-- GRILLE PRODUITS -->
                <div class="products-grid" id="pos-products-grid">
                    ${renderProductsGridHTML(currentProducts)}
                </div>
            </div>

            <!-- PANIER LATÉRAL -->
            <div class="pos-cart-panel">
                <div class="cart-header">
                    <div class="cart-title">
                        <i data-lucide="shopping-cart"></i>
                        <span>Panier</span>
                        <span class="badge badge-info" id="cart-items-count">${cart.length}</span>
                    </div>
                    <button type="button" class="btn btn-outline btn-sm" id="btn-clear-cart" style="padding:4px 8px;" title="Vider">
                        <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                    </button>
                </div>

                <!-- SÉLECTION DU CLIENT -->
                <div class="cart-client-select">
                    <i data-lucide="user" style="width:16px; height:16px; color:#64748B;"></i>
                    <select id="cart-customer-select" class="form-control" style="height:36px; font-size:13px; border-radius:999px;">
                        <option value="">Client au comptoir (Anonyme)</option>
                        ${currentCustomers.map(cust => `
                            <option value="${cust.id}">${cust.name} ${cust.phone ? `(${cust.phone})` : ''}</option>
                        `).join('')}
                    </select>
                </div>

                <!-- LISTE DES ARTICLES DANS LE PANIER -->
                <div class="cart-items-list" id="pos-cart-items">
                    ${renderCartItemsHTML()}
                </div>

                <!-- SOUS-TOTAUX ET BOUTON PAIEMENT -->
                <div class="cart-summary-section">
                    <div class="summary-row">
                        <span>Sous-total</span>
                        <span id="cart-subtotal">0.00 ${biz.primary_currency}</span>
                    </div>
                    <div class="summary-row" style="cursor:pointer;" id="row-apply-discount">
                        <span style="color:var(--color-primary); display:flex; align-items:center; gap:4px;">
                            <i data-lucide="percent" style="width:13px; height:13px;"></i>
                            Remise (${discountPercent}%)
                        </span>
                        <span id="cart-discount" style="color:var(--color-primary);">-0.00 ${biz.primary_currency}</span>
                    </div>
                    ${Number(biz.default_tax_rate) > 0 ? `
                        <div class="summary-row">
                            <span>Taxe (${biz.default_tax_rate}%)</span>
                            <span id="cart-tax">0.00 ${biz.primary_currency}</span>
                        </div>
                    ` : ''}
                    <div class="summary-row total-row">
                        <span>Net à payer</span>
                        <span id="cart-total">0.00 ${biz.primary_currency}</span>
                    </div>

                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn btn-outline btn-sm" id="btn-hold-cart" style="flex:1;">
                            <i data-lucide="pause-circle"></i>
                            Attente (F9)
                        </button>
                        <button type="button" class="btn-checkout" id="btn-pos-pay" style="flex:2;">
                            <i data-lucide="check-circle-2"></i>
                            Payer (F4)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Attacher les écouteurs d'événements
    setupEventListeners(container, biz);
}

/**
 * Charge les produits, catégories et clients
 */
async function loadCatalogData(businessId) {
    try {
        if (navigator.onLine && db) {
            const [prodsRes, catsRes, custsRes] = await Promise.all([
                db.from('cvisual_products').select('*').eq('business_id', businessId).eq('is_archived', false),
                db.from('cvisual_categories').select('*').eq('business_id', businessId).eq('is_active', true).order('sort_order'),
                db.from('cvisual_customers').select('*').eq('business_id', businessId).order('name')
            ]);

            currentProducts = prodsRes.data || [];
            currentCategories = catsRes.data || [];
            currentCustomers = custsRes.data || [];
        } else {
            currentProducts = await getLocalProducts();
            currentCategories = await getLocalCategories();
            currentCustomers = await getLocalCustomers();
        }
    } catch (e) {
        console.warn('Erreur chargement catalogue en ligne, repli IndexedDB:', e);
        currentProducts = await getLocalProducts();
        currentCategories = await getLocalCategories();
        currentCustomers = await getLocalCustomers();
    }
}

/**
 * Rendu HTML de la grille de produits
 */
function renderProductsGridHTML(products) {
    let filtered = products;

    if (activeCategoryId === 'favorites') {
        filtered = filtered.filter(p => p.is_favorite);
    } else if (activeCategoryId) {
        filtered = filtered.filter(p => p.category_id === activeCategoryId);
    }

    if (activeSearchTerm) {
        const term = activeSearchTerm.toLowerCase();
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(term) ||
            (p.barcode && p.barcode.toLowerCase().includes(term)) ||
            (p.sku && p.sku.toLowerCase().includes(term))
        );
    }

    if (filtered.length === 0) {
        return `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">
                    <i data-lucide="package-search"></i>
                </div>
                <div class="empty-state-title">Aucun article trouvé</div>
                <div class="empty-state-desc">Modifiez vos critères de recherche ou sélectionnez une autre catégorie.</div>
            </div>
        `;
    }

    return filtered.map(p => `
        <div class="product-pos-card" data-product-id="${p.id}">
            <div class="product-card-image">
                ${p.image_url ? `
                    <img src="${p.image_url}" alt="${p.name}" loading="lazy" />
                ` : `
                    <i data-lucide="package" style="width:36px; height:36px; color:#CBD5E1;"></i>
                `}
            </div>
            <div class="product-card-name">${p.name}</div>
            <div class="product-card-footer">
                <span class="product-card-price">${Number(p.sale_price).toFixed(2)}</span>
                <span class="product-card-stock ${p.current_stock <= p.min_stock_alert ? 'low' : ''}">
                    ${p.current_stock} en stock
                </span>
            </div>
        </div>
    `).join('');
}

/**
 * Rendu des lignes du panier
 */
function renderCartItemsHTML() {
    if (cart.length === 0) {
        return `
            <div class="empty-state" style="padding:32px 16px; margin:auto;">
                <div class="empty-state-icon" style="margin: 0 auto 12px auto;">
                    <i data-lucide="shopping-bag"></i>
                </div>
                <div style="font-size:13px; color:#94A3B8; text-align:center;">Panier vide. Cliquez sur un article pour l'ajouter.</div>
            </div>
        `;
    }

    return cart.map((item, idx) => `
        <div class="cart-item-row" data-cart-index="${idx}">
            <div class="cart-item-details">
                <div class="cart-item-name">${item.product.name}</div>
                <div class="cart-item-unit-price">${Number(item.product.sale_price).toFixed(2)} / unité</div>
            </div>
            <div class="cart-item-qty-control">
                <button type="button" class="qty-btn btn-qty-dec" data-idx="${idx}">-</button>
                <span class="qty-val">${item.qty}</span>
                <button type="button" class="qty-btn btn-qty-inc" data-idx="${idx}">+</button>
            </div>
            <div class="cart-item-total">
                ${(item.qty * Number(item.product.sale_price)).toFixed(2)}
            </div>
        </div>
    `).join('');
}

/**
 * Recalcule et actualise les totaux du panier
 */
function updateCartTotals(biz) {
    const subtotal = cart.reduce((acc, i) => acc + (i.qty * Number(i.product.sale_price)), 0);
    const discountVal = (subtotal * discountPercent) / 100;
    const taxRate = Number(biz.default_tax_rate) || 0;
    const taxVal = ((subtotal - discountVal) * taxRate) / 100;
    const total = subtotal - discountVal + taxVal;

    const subEl = document.getElementById('cart-subtotal');
    const discEl = document.getElementById('cart-discount');
    const taxEl = document.getElementById('cart-tax');
    const totEl = document.getElementById('cart-total');
    const countEl = document.getElementById('cart-items-count');

    const curr = biz.primary_currency || 'HTG';

    if (subEl) subEl.textContent = `${subtotal.toFixed(2)} ${curr}`;
    if (discEl) discEl.textContent = `-${discountVal.toFixed(2)} ${curr}`;
    if (taxEl) taxEl.textContent = `+${taxVal.toFixed(2)} ${curr}`;
    if (totEl) totEl.textContent = `${total.toFixed(2)} ${curr}`;
    if (countEl) countEl.textContent = cart.reduce((acc, i) => acc + i.qty, 0);

    return { subtotal, discountVal, taxVal, total };
}

/**
 * Ajout d'un produit au panier
 */
function addToCart(product, qty = 1) {
    const existing = cart.find(i => i.product.id === product.id);
    if (existing) {
        existing.qty += qty;
    } else {
        cart.push({ product, qty });
    }
    const cartContainer = document.getElementById('pos-cart-items');
    if (cartContainer) cartContainer.innerHTML = renderCartItemsHTML();
    updateCartTotals(currentSession.business);
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Attache les écouteurs de la vue Vente
 */
function setupEventListeners(container, biz) {
    // 1. Clic sur produit pour ajouter au panier
    const grid = container.querySelector('#pos-products-grid');
    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.product-pos-card');
        if (card) {
            const prodId = card.getAttribute('data-product-id');
            const prod = currentProducts.find(p => p.id === prodId);
            if (prod) addToCart(prod, 1);
        }
    });

    // 2. Recherche en temps réel
    const searchInput = container.querySelector('#pos-search-input');
    searchInput.addEventListener('input', (e) => {
        activeSearchTerm = e.target.value;
        grid.innerHTML = renderProductsGridHTML(currentProducts);
        if (window.lucide) window.lucide.createIcons({ root: grid });
    });

    // Scan direct par appui sur la touche Enter dans la barre de recherche
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = searchInput.value.trim();
            const matched = currentProducts.find(p => p.barcode === val || p.sku === val);
            if (matched) {
                addToCart(matched, 1);
                searchInput.value = '';
                activeSearchTerm = '';
                grid.innerHTML = renderProductsGridHTML(currentProducts);
                if (window.lucide) window.lucide.createIcons({ root: grid });
                toast.success('Article scanné', matched.name);
            }
        }
    });

    // 3. Filtrage par Catégorie
    const pills = container.querySelectorAll('.category-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeCategoryId = pill.getAttribute('data-cat-id');
            grid.innerHTML = renderProductsGridHTML(currentProducts);
            if (window.lucide) window.lucide.createIcons({ root: grid });
        });
    });

    // 4. Incrément / Décrément quantité Panier
    const cartContainer = container.querySelector('#pos-cart-items');
    cartContainer.addEventListener('click', (e) => {
        const incBtn = e.target.closest('.btn-qty-inc');
        const decBtn = e.target.closest('.btn-qty-dec');
        if (incBtn) {
            const idx = parseInt(incBtn.getAttribute('data-idx'));
            cart[idx].qty += 1;
            cartContainer.innerHTML = renderCartItemsHTML();
            updateCartTotals(biz);
        } else if (decBtn) {
            const idx = parseInt(decBtn.getAttribute('data-idx'));
            if (cart[idx].qty > 1) {
                cart[idx].qty -= 1;
            } else {
                cart.splice(idx, 1);
            }
            cartContainer.innerHTML = renderCartItemsHTML();
            updateCartTotals(biz);
        }
    });

    // 5. Vider panier
    container.querySelector('#btn-clear-cart').onclick = () => {
        if (cart.length > 0) {
            cart = [];
            cartContainer.innerHTML = renderCartItemsHTML();
            updateCartTotals(biz);
            if (window.lucide) window.lucide.createIcons();
        }
    };

    // 6. Application d'une remise globale
    container.querySelector('#row-apply-discount').onclick = () => {
        const input = prompt('Saisir le pourcentage de remise globale (%):', discountPercent);
        if (input !== null) {
            const val = parseFloat(input);
            if (!isNaN(val) && val >= 0 && val <= 100) {
                discountPercent = val;
                updateCartTotals(biz);
            }
        }
    };

    // 7. Mise en attente de commande (Hold)
    container.querySelector('#btn-hold-cart').onclick = () => {
        if (cart.length === 0) {
            toast.warning('Panier vide', 'Rien à mettre en attente.');
            return;
        }
        heldSales.push({
            id: 'hold_' + Date.now(),
            cart: [...cart],
            customer_id: container.querySelector('#cart-customer-select').value,
            date: new Date().toLocaleTimeString()
        });
        localStorage.setItem('CVISUAL_HELD_SALES', JSON.stringify(heldSales));
        cart = [];
        cartContainer.innerHTML = renderCartItemsHTML();
        updateCartTotals(biz);
        container.querySelector('#held-count').textContent = heldSales.length;
        toast.info('Commande suspendue', 'Vente placée en attente.');
    };

    // 8. Reprendre commande en attente
    container.querySelector('#btn-held-sales').onclick = () => {
        if (heldSales.length === 0) {
            toast.info('Aucune commande', 'Aucune vente n\'est actuellement en attente.');
            return;
        }
        const last = heldSales.pop();
        cart = last.cart;
        localStorage.setItem('CVISUAL_HELD_SALES', JSON.stringify(heldSales));
        cartContainer.innerHTML = renderCartItemsHTML();
        updateCartTotals(biz);
        container.querySelector('#held-count').textContent = heldSales.length;
        if (last.customer_id) {
            container.querySelector('#cart-customer-select').value = last.customer_id;
        }
        toast.success('Reprise', 'Commande réintégrée dans le panier.');
    };

    // 9. Plein écran
    container.querySelector('#btn-toggle-fullscreen').onclick = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    // 10. Bouton Payer -> Ouvre la modale de règlement
    container.querySelector('#btn-pos-pay').onclick = () => {
        if (cart.length === 0) {
            toast.warning('Panier vide', 'Ajoutez des articles avant d\'encaisser.');
            return;
        }
        openPaymentModal(biz);
    };

    // Raccourcis clavier (F2, F4, F9)
    window.onkeydown = (e) => {
        if (e.key === 'F2') {
            e.preventDefault();
            searchInput.focus();
        } else if (e.key === 'F4') {
            e.preventDefault();
            if (cart.length > 0) openPaymentModal(biz);
        } else if (e.key === 'F9') {
            e.preventDefault();
            container.querySelector('#btn-hold-cart').click();
        }
    };
}

/**
 * Modale de Règlement et Paiement
 */
function openPaymentModal(biz) {
    const existing = document.getElementById('cvisual-payment-modal');
    if (existing) existing.remove();

    const { subtotal, discountVal, taxVal, total } = updateCartTotals(biz);
    const customerSelect = document.getElementById('cart-customer-select');
    const selectedCustomerId = customerSelect ? customerSelect.value : null;
    const selectedCustomer = currentCustomers.find(c => c.id === selectedCustomerId);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'cvisual-payment-modal';

    let currentMethod = 'cash';
    let amountReceived = total;

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 500px;">
            <div class="modal-header">
                <h3 class="modal-title">Encaisser la vente</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-pay-modal">✕</button>
            </div>
            <div class="modal-body">
                <div style="background:var(--bg-subtle); border-radius:12px; padding:16px; margin-bottom:18px; text-align:center;">
                    <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Net à régler</div>
                    <div style="font-family:var(--font-heading); font-size:28px; font-weight:800; color:var(--color-navy); margin-top:4px;">
                        ${total.toFixed(2)} ${biz.primary_currency}
                    </div>
                </div>

                <div class="payment-methods-grid">
                    <button type="button" class="payment-method-btn active" data-method="cash">
                        <i data-lucide="banknote"></i>
                        <span>Espèces</span>
                    </button>
                    <button type="button" class="payment-method-btn" data-method="moncash">
                        <i data-lucide="smartphone"></i>
                        <span>MonCash</span>
                    </button>
                    <button type="button" class="payment-method-btn" data-method="natcash">
                        <i data-lucide="phone"></i>
                        <span>NatCash</span>
                    </button>
                    <button type="button" class="payment-method-btn" data-method="card">
                        <i data-lucide="credit-card"></i>
                        <span>Carte</span>
                    </button>
                    <button type="button" class="payment-method-btn" data-method="transfer">
                        <i data-lucide="arrow-left-right"></i>
                        <span>Virement</span>
                    </button>
                    <button type="button" class="payment-method-btn" data-method="credit">
                        <i data-lucide="user-x"></i>
                        <span>À crédit</span>
                    </button>
                </div>

                <!-- ZONE CALCUL ESPÈCES -->
                <div id="cash-calculator-box">
                    <div class="form-group">
                        <label class="form-label">Montant remis par le client</label>
                        <input type="number" id="pay-amount-received" class="form-control" value="${total.toFixed(2)}" step="any">
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; margin-top:8px;">
                        <span style="font-size:14px; font-weight:600; color:var(--text-muted);">Monnaie à rendre :</span>
                        <strong id="pay-change-returned" style="font-size:18px; color:var(--color-success); font-family:var(--font-heading);">0.00 ${biz.primary_currency}</strong>
                    </div>
                </div>

                ${selectedCustomer ? `
                    <div style="margin-top:12px; font-size:12px; color:var(--text-muted);">
                        Vente attribuée à : <strong>${selectedCustomer.name}</strong>
                    </div>
                ` : ''}
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-payment">Annuler</button>
                <button type="button" class="btn btn-primary" id="btn-confirm-payment" style="flex:1;">
                    <i data-lucide="check"></i>
                    Valider le règlement
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons({ root: overlay });

    // Gestion sélection mode de paiement
    const methodBtns = overlay.querySelectorAll('.payment-method-btn');
    const cashBox = overlay.querySelector('#cash-calculator-box');
    const amountInput = overlay.querySelector('#pay-amount-received');
    const changeLabel = overlay.querySelector('#pay-change-returned');

    methodBtns.forEach(btn => {
        btn.onclick = () => {
            methodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMethod = btn.getAttribute('data-method');
            if (currentMethod === 'cash') {
                cashBox.style.display = 'block';
            } else {
                cashBox.style.display = 'none';
            }
        };
    });

    amountInput.oninput = () => {
        const val = parseFloat(amountInput.value) || 0;
        const diff = val - total;
        changeLabel.textContent = `${(diff > 0 ? diff : 0).toFixed(2)} ${biz.primary_currency}`;
    };

    overlay.querySelector('#btn-close-pay-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-payment').onclick = () => overlay.remove();

    // Confirmation finale de la vente
    overlay.querySelector('#btn-confirm-payment').onclick = async () => {
        overlay.remove();
        await finalizeSale(biz, currentMethod, parseFloat(amountInput.value) || total, selectedCustomer);
    };
}

/**
 * Enregistrement transactionnel de la vente (Online ou Offline)
 */
async function finalizeSale(biz, paymentMethod, amountReceived, customer) {
    const { subtotal, discountVal, taxVal, total } = updateCartTotals(biz);
    const changeGiven = amountReceived > total ? (amountReceived - total) : 0;

    const saleId = 'sale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const receiptNumber = 'REC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);

    const saleItems = cart.map(i => ({
        product_id: i.product.id,
        name: i.product.name,
        qty: i.qty,
        unit_price: Number(i.product.sale_price),
        unit_cost: Number(i.product.cost_price || 0),
        discount: 0,
        tax: 0,
        total: i.qty * Number(i.product.sale_price)
    }));

    const saleRecord = {
        id: saleId,
        business_id: biz.id,
        staff_id: currentSession.staff?.id || null,
        customer_id: customer?.id || null,
        customer_name: customer?.name || null,
        customer_phone: customer?.phone || null,
        subtotal: subtotal,
        discount_amount: discountVal,
        discount_percent: discountPercent,
        tax_amount: taxVal,
        total_amount: total,
        currency: biz.primary_currency || 'HTG',
        exchange_rate: biz.exchange_rate || 1,
        payment_method: paymentMethod,
        amount_received: amountReceived,
        change_given: changeGiven,
        notes: '',
        items: saleItems,
        receipt_number: receiptNumber,
        created_at: new Date().toISOString()
    };

    let saleSaved = false;

    // Tentative en ligne via RPC cvisual_process_sale
    if (navigator.onLine && db) {
        try {
            const { data, error } = await db.rpc('cvisual_process_sale', {
                p_business_id: biz.id,
                p_staff_id: currentSession.staff?.id || null,
                p_customer_id: customer?.id || null,
                p_cash_session_id: null,
                p_subtotal: subtotal,
                p_discount_amount: discountVal,
                p_discount_percent: discountPercent,
                p_tax_amount: taxVal,
                p_total_amount: total,
                p_currency: biz.primary_currency,
                p_exchange_rate: biz.exchange_rate,
                p_payment_method: paymentMethod,
                p_amount_received: amountReceived,
                p_change_given: changeGiven,
                p_notes: '',
                p_items: saleItems,
                p_offline_created_at: null,
                p_custom_receipt_number: receiptNumber
            });

            if (!error && data && data.success) {
                saleSaved = true;
                saleRecord.receipt_number = data.receipt_number;
            }
        } catch (e) {
            console.warn('Échec RPC vente en ligne, enregistrement en local:', e);
        }
    }

    // Si hors-ligne ou si le serveur échoue, mise en file d'attente locale
    if (!saleSaved) {
        await queuePendingSale(saleRecord);
        updateSyncBadge();
    }

    // Réinitialisation du panier
    cart = [];
    discountPercent = 0;
    const cartContainer = document.getElementById('pos-cart-items');
    if (cartContainer) cartContainer.innerHTML = renderCartItemsHTML();
    updateCartTotals(biz);

    // Écran de Succès
    openSaleSuccessModal(saleRecord, biz);
}

/**
 * Modale de Vente Réussie (Imprimer, WhatsApp, Nouvelle Vente)
 */
function openSaleSuccessModal(sale, biz) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'sale-success-modal';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 440px; text-align:center;">
            <div class="modal-body" style="padding:32px 24px;">
                <div style="width:64px; height:64px; border-radius:50%; background:#ECFDF5; border:2px solid #A7F3D0; display:flex; align-items:center; justify-content:center; margin:0 auto 16px auto;">
                    <i data-lucide="check" style="width:32px; height:32px; color:#10B981;"></i>
                </div>
                <h2 style="font-family:var(--font-heading); font-size:22px; color:var(--color-navy); margin-bottom:6px;">Vente Enregistrée !</h2>
                <div style="font-size:14px; color:var(--text-muted); margin-bottom:20px;">
                    Reçu <strong>#${sale.receipt_number}</strong> • Total : <strong>${Number(sale.total_amount).toFixed(2)} ${sale.currency}</strong>
                </div>

                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button type="button" class="btn btn-primary" id="btn-success-print" style="height:48px;">
                        <i data-lucide="printer"></i>
                        Imprimer le ticket
                    </button>
                    <button type="button" class="btn btn-outline" id="btn-success-wa" style="height:48px; border-color:#25D366; color:#15803D;">
                        <i data-lucide="message-square" style="color:#25D366;"></i>
                        Envoyer par WhatsApp
                    </button>
                    <button type="button" class="btn btn-outline" id="btn-success-new" style="height:48px;">
                        <i data-lucide="plus"></i>
                        Nouvelle vente
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons({ root: overlay });

    overlay.querySelector('#btn-success-print').onclick = () => {
        printReceipt(sale, biz);
    };

    overlay.querySelector('#btn-success-wa').onclick = () => {
        openSendReceiptModal(sale, biz);
    };

    overlay.querySelector('#btn-success-new').onclick = () => {
        overlay.remove();
        const searchInput = document.getElementById('pos-search-input');
        if (searchInput) searchInput.focus();
    };
}
