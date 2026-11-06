/**
 * CVISUAL POS — sync.js
 * Synchronisation avec tables et RPCs préfixées 'cvisual_'
 */

import { db } from './supabase.js';
import { 
    getPendingSales, 
    removePendingSale, 
    getPendingWhatsAppMessages, 
    removePendingWhatsAppMessage, 
    getPendingTotalCount,
    saveProductsLocally,
    saveCategoriesLocally,
    saveCustomersLocally
} from './offline-db.js';
import { toast } from './toast.js';

let isSyncing = false;
let isOnline = navigator.onLine;

export function getNetworkStatus() {
    return isOnline;
}

export async function updateSyncBadge() {
    const badge = document.getElementById('cvisual-sync-indicator');
    if (!badge) return;

    const count = await getPendingTotalCount();
    isOnline = navigator.onLine;

    if (!isOnline) {
        badge.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px; padding:6px 12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:999px; font-size:12px; font-weight:600; color:#DC2626;">
                <span style="width:8px; height:8px; border-radius:50%; background:#EF4444;"></span>
                <span>Hors-ligne ${count > 0 ? `(${count})` : ''}</span>
            </div>
        `;
    } else if (isSyncing) {
        badge.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px; padding:6px 12px; background:#FEF3C7; border:1px solid #FDE68A; border-radius:999px; font-size:12px; font-weight:600; color:#D97706;">
                <span style="width:8px; height:8px; border-radius:50%; background:#F59E0B; animation: pulse 1s infinite;"></span>
                <span>Synchronisation...</span>
            </div>
        `;
    } else if (count > 0) {
        badge.innerHTML = `
            <button id="btn-manual-sync" style="display:flex; align-items:center; gap:6px; padding:6px 12px; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:999px; font-size:12px; font-weight:600; color:#2563EB; cursor:pointer;">
                <i data-lucide="refresh-cw" style="width:13px; height:13px;"></i>
                <span>${count} en attente</span>
            </button>
        `;
        const syncBtn = document.getElementById('btn-manual-sync');
        if (syncBtn) {
            syncBtn.onclick = () => syncNow();
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: badge });
        }
    } else {
        badge.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px; padding:6px 12px; background:#ECFDF5; border:1px solid #A7F3D0; border-radius:999px; font-size:12px; font-weight:600; color:#059669;">
                <span style="width:8px; height:8px; border-radius:50%; background:#10B981;"></span>
                <span>En ligne</span>
            </div>
        `;
    }
}

export async function syncNow() {
    if (isSyncing) return;
    if (!navigator.onLine) {
        toast.warning('Hors-ligne', 'Connexion internet requise pour synchroniser.');
        updateSyncBadge();
        return;
    }

    isSyncing = true;
    updateSyncBadge();

    try {
        const pendingSales = await getPendingSales();
        let syncedCount = 0;

        for (const sale of pendingSales) {
            try {
                const { data, error } = await db.rpc('cvisual_process_sale', {
                    p_business_id: sale.business_id,
                    p_staff_id: sale.staff_id,
                    p_customer_id: sale.customer_id,
                    p_cash_session_id: sale.cash_session_id,
                    p_subtotal: sale.subtotal,
                    p_discount_amount: sale.discount_amount,
                    p_discount_percent: sale.discount_percent,
                    p_tax_amount: sale.tax_amount,
                    p_total_amount: sale.total_amount,
                    p_currency: sale.currency,
                    p_exchange_rate: sale.exchange_rate,
                    p_payment_method: sale.payment_method,
                    p_amount_received: sale.amount_received,
                    p_change_given: sale.change_given,
                    p_notes: sale.notes,
                    p_items: sale.items,
                    p_offline_created_at: sale.offline_created_at || sale.created_at,
                    p_custom_receipt_number: sale.receipt_number
                });

                if (!error && data && data.success) {
                    await removePendingSale(sale.id);
                    syncedCount++;
                } else {
                    console.error('[Cvisual Sync] Erreur synchronisation vente:', error);
                }
            } catch (err) {
                console.error('[Cvisual Sync] Exception vente:', err);
            }
        }

        // Messages WhatsApp en file
        const waQueue = await getPendingWhatsAppMessages();
        for (const msg of waQueue) {
            try {
                const { error } = await db.from('cvisual_whatsapp_messages').insert([{
                    business_id: msg.business_id,
                    sale_id: msg.sale_id,
                    phone_number: msg.phone_number,
                    message_type: msg.message_type || 'text',
                    content: msg.content,
                    status: 'queued'
                }]);
                if (!error) {
                    await removePendingWhatsAppMessage(msg.id);
                }
            } catch (e) {
                console.error('[Cvisual Sync] Exception WhatsApp queue:', e);
            }
        }

        await downloadServerDataToOffline();

        if (syncedCount > 0) {
            toast.success('Synchronisation terminée', `${syncedCount} vente(s) synchronisée(s).`);
        }
    } catch (globalError) {
        console.error('[Cvisual Sync] Erreur globale de synchronisation:', globalError);
    } finally {
        isSyncing = false;
        updateSyncBadge();
    }
}

export async function downloadServerDataToOffline() {
    if (!navigator.onLine || !db) return;

    try {
        const { data: { session } } = await db.auth.getSession();
        if (!session) return;

        const { data: biz } = await db.from('cvisual_businesses').select('*').limit(1).single();
        if (!biz) return;

        const { data: categories } = await db.from('cvisual_categories')
            .select('*')
            .eq('business_id', biz.id)
            .eq('is_active', true);
        if (categories) await saveCategoriesLocally(categories);

        const { data: products } = await db.from('cvisual_products')
            .select('*')
            .eq('business_id', biz.id)
            .eq('is_archived', false);
        if (products) await saveProductsLocally(products);

        const { data: customers } = await db.from('cvisual_customers')
            .select('*')
            .eq('business_id', biz.id);
        if (customers) await saveCustomersLocally(customers);

        console.log('[Cvisual Sync] Cache local IndexedDB mis à jour.');
    } catch (e) {
        console.warn('[Cvisual Sync] Impossible de télécharger les données serveur:', e);
    }
}

window.addEventListener('online', () => {
    isOnline = true;
    toast.info('Connexion rétablie', 'Synchronisation en cours...');
    syncNow();
});

window.addEventListener('offline', () => {
    isOnline = false;
    toast.warning('Mode hors-ligne activé', 'Ventes stockées localement.');
    updateSyncBadge();
});

setInterval(() => {
    if (navigator.onLine) {
        syncNow();
    }
}, 180000);
