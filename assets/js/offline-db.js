/**
 * CVISUAL POS — offline-db.js
 * Gestionnaire IndexedDB robuste pour le mode 100% hors-ligne (Offline-First).
 * Permet d'encaisser, chercher des produits et stocker des ventes en attente de synchronisation.
 */

const DB_NAME = 'cvisual_pos_offline_v1';
const DB_VERSION = 1;

let dbInstance = null;

export function openOfflineDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            return resolve(dbInstance);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // 1. Produits
            if (!db.objectStoreNames.contains('products')) {
                const prodStore = db.createObjectStore('products', { keyPath: 'id' });
                prodStore.createIndex('category_id', 'category_id', { unique: false });
                prodStore.createIndex('barcode', 'barcode', { unique: false });
                prodStore.createIndex('sku', 'sku', { unique: false });
                prodStore.createIndex('name', 'name', { unique: false });
            }

            // 2. Catégories
            if (!db.objectStoreNames.contains('categories')) {
                db.createObjectStore('categories', { keyPath: 'id' });
            }

            // 3. Clients
            if (!db.objectStoreNames.contains('customers')) {
                const custStore = db.createObjectStore('customers', { keyPath: 'id' });
                custStore.createIndex('phone', 'phone', { unique: false });
                custStore.createIndex('name', 'name', { unique: false });
            }

            // 4. Paramètres de l'entreprise
            if (!db.objectStoreNames.contains('business_info')) {
                db.createObjectStore('business_info', { keyPath: 'id' });
            }

            // 5. File d'attente des ventes hors-ligne
            if (!db.objectStoreNames.contains('pending_sales')) {
                const salesStore = db.createObjectStore('pending_sales', { keyPath: 'id' });
                salesStore.createIndex('created_at', 'created_at', { unique: false });
            }

            // 6. File des mouvements de stock hors-ligne
            if (!db.objectStoreNames.contains('pending_stock_movements')) {
                db.createObjectStore('pending_stock_movements', { keyPath: 'id' });
            }

            // 7. File des dépenses hors-ligne
            if (!db.objectStoreNames.contains('pending_expenses')) {
                db.createObjectStore('pending_expenses', { keyPath: 'id' });
            }

            // 8. File d'attente WhatsApp
            if (!db.objectStoreNames.contains('whatsapp_queue')) {
                db.createObjectStore('whatsapp_queue', { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error('[Cvisual OfflineDB] Erreur ouverture IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

function getStore(storeName, mode = 'readonly') {
    return openOfflineDB().then((db) => {
        const tx = db.transaction(storeName, mode);
        return tx.objectStore(storeName);
    });
}

// ==========================================
// MÉTHODES PRODUITS
// ==========================================
export async function saveProductsLocally(products) {
    const db = await openOfflineDB();
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    for (const p of products) {
        store.put(p);
    }
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
    });
}

export async function getLocalProducts(searchTerm = '', categoryId = '') {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const request = store.getAll();

        request.onsuccess = () => {
            let list = request.result || [];
            if (categoryId) {
                list = list.filter(p => p.category_id === categoryId);
            }
            if (searchTerm) {
                const term = searchTerm.toLowerCase().trim();
                list = list.filter(p => 
                    (p.name && p.name.toLowerCase().includes(term)) ||
                    (p.barcode && p.barcode.toLowerCase().includes(term)) ||
                    (p.sku && p.sku.toLowerCase().includes(term))
                );
            }
            resolve(list);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function findLocalProductByBarcode(barcode) {
    if (!barcode) return null;
    const db = await openOfflineDB();
    return new Promise((resolve) => {
        const tx = db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const index = store.index('barcode');
        const request = index.get(barcode);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

export async function updateLocalProductStock(productId, deltaQty) {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
        const tx = db.transaction('products', 'readwrite');
        const store = tx.objectStore('products');
        const getReq = store.get(productId);

        getReq.onsuccess = () => {
            const prod = getReq.result;
            if (prod) {
                prod.current_stock = (Number(prod.current_stock) || 0) + Number(deltaQty);
                store.put(prod);
            }
            resolve(true);
        };
        getReq.onerror = () => resolve(false);
    });
}

// ==========================================
// MÉTHODES CATÉGORIES
// ==========================================
export async function saveCategoriesLocally(categories) {
    const db = await openOfflineDB();
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    for (const c of categories) {
        store.put(c);
    }
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
    });
}

export async function getLocalCategories() {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
        const tx = db.transaction('categories', 'readonly');
        const req = tx.objectStore('categories').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
}

// ==========================================
// MÉTHODES CLIENTS
// ==========================================
export async function saveCustomersLocally(customers) {
    const db = await openOfflineDB();
    const tx = db.transaction('customers', 'readwrite');
    const store = tx.objectStore('customers');
    for (const c of customers) {
        store.put(c);
    }
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
    });
}

export async function getLocalCustomers(query = '') {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
        const tx = db.transaction('customers', 'readonly');
        const req = tx.objectStore('customers').getAll();
        req.onsuccess = () => {
            let list = req.result || [];
            if (query) {
                const q = query.toLowerCase();
                list = list.filter(c => (c.name && c.name.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q)));
            }
            resolve(list);
        };
        req.onerror = () => resolve([]);
    });
}

// ==========================================
// MÉTHODES INFORMATIONS ENTREPRISE
// ==========================================
export async function saveBusinessInfoLocally(info) {
    const db = await openOfflineDB();
    const tx = db.transaction('business_info', 'readwrite');
    tx.objectStore('business_info').put(info);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
    });
}

export async function getLocalBusinessInfo() {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
        const tx = db.transaction('business_info', 'readonly');
        const req = tx.objectStore('business_info').getAll();
        req.onsuccess = () => resolve(req.result && req.result.length ? req.result[0] : null);
        req.onerror = () => resolve(null);
    });
}

// ==========================================
// FILE DE SYNCHRONISATION : VENTES HORS-LIGNE
// ==========================================
export async function queuePendingSale(saleRecord) {
    const db = await openOfflineDB();
    const tx = db.transaction('pending_sales', 'readwrite');
    tx.objectStore('pending_sales').put(saleRecord);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
    });
}

export async function getPendingSales() {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
        const tx = db.transaction('pending_sales', 'readonly');
        const req = tx.objectStore('pending_sales').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
}

export async function removePendingSale(id) {
    const db = await openOfflineDB();
    const tx = db.transaction('pending_sales', 'readwrite');
    tx.objectStore('pending_sales').delete(id);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
    });
}

// ==========================================
// FILE WHATSAPP HORS-LIGNE
// ==========================================
export async function queueWhatsAppMessageLocally(messageObj) {
    const db = await openOfflineDB();
    const tx = db.transaction('whatsapp_queue', 'readwrite');
    tx.objectStore('whatsapp_queue').put(messageObj);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
    });
}

export async function getPendingWhatsAppMessages() {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
        const tx = db.transaction('whatsapp_queue', 'readonly');
        const req = tx.objectStore('whatsapp_queue').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
}

export async function removePendingWhatsAppMessage(id) {
    const db = await openOfflineDB();
    const tx = db.transaction('whatsapp_queue', 'readwrite');
    tx.objectStore('whatsapp_queue').delete(id);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
    });
}

// ==========================================
// COMPTAGE TOTAL EN ATTENTE
// ==========================================
export async function getPendingTotalCount() {
    try {
        const sales = await getPendingSales();
        const wa = await getPendingWhatsAppMessages();
        return sales.length + wa.length;
    } catch {
        return 0;
    }
}
