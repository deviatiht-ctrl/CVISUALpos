/**
 * CVISUAL POS — whatsapp.js
 * Client WhatsApp connecté au micro-service whatsapp-server/
 * Normalisation Haïti (+509), envoi direct de reçus et gestion de la file d'attente hors-ligne.
 */

import { db } from '../supabase.js';
import { toast } from '../toast.js';
import { queueWhatsAppMessageLocally } from '../offline-db.js';

// URL du service WhatsApp configurée dans localStorage ou défaut local
const WA_SERVER_URL = localStorage.getItem('CVISUAL_WA_SERVER_URL') || 'http://localhost:3001';

/**
 * Normalise un numéro de téléphone (Par défaut indicatif Haïti +509)
 */
export function normalizePhoneNumber(rawNumber) {
    if (!rawNumber) return '';
    let cleaned = rawNumber.replace(/[\s\-\(\)\.]/g, '');
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }
    // Si format local haïtien à 8 chiffres (ex: 37012345 ou 44112233)
    if (cleaned.length === 8 && (cleaned.startsWith('3') || cleaned.startsWith('4') || cleaned.startsWith('2'))) {
        cleaned = '509' + cleaned;
    }
    return cleaned;
}

/**
 * Envoie un reçu de vente via WhatsApp
 */
export async function sendReceiptWhatsApp(sale, business, targetPhone = null) {
    const biz = business || {};
    const phone = normalizePhoneNumber(targetPhone || sale.customer_phone || sale.phone);

    if (!phone) {
        toast.warning('Numéro manquant', 'Veuillez saisir un numéro de téléphone valide.');
        return false;
    }

    const template = biz.whatsapp_settings?.template || 
        "Bonjour {client}, voici votre reçu #{numero_recu} d'un montant de {total} chez {entreprise}. Merci pour votre achat !";

    const clientName = sale.customer_name || 'Cher client';
    const totalFormatted = `${Number(sale.total_amount).toFixed(2)} ${sale.currency || 'HTG'}`;
    const dateFormatted = new Date(sale.created_at || Date.now()).toLocaleDateString('fr-FR');

    const messageText = template
        .replace('{client}', clientName)
        .replace('{numero_recu}', sale.receipt_number || '')
        .replace('{total}', totalFormatted)
        .replace('{entreprise}', biz.name || 'Notre boutique')
        .replace('{date}', dateFormatted);

    // 1. Si nous sommes hors-ligne, mise en file d'attente locale
    if (!navigator.onLine) {
        await queueWhatsAppMessageLocally({
            id: 'wa_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            business_id: biz.id,
            sale_id: sale.id,
            phone_number: phone,
            content: messageText,
            created_at: new Date().toISOString()
        });
        toast.info('Message mis en attente', 'Sera envoyé automatiquement dès le retour d\'internet.');
        return true;
    }

    // 2. Envoi via le micro-service WhatsApp
    try {
        const { data: { session } } = await db.auth.getSession();
        const jwt = session?.access_token || '';

        const response = await fetch(`${WA_SERVER_URL}/send/receipt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`
            },
            body: JSON.stringify({
                business_id: biz.id,
                phone: phone,
                message: messageText,
                receipt_number: sale.receipt_number,
                total: totalFormatted
            })
        });

        const result = await response.json();
        if (response.ok && result.success) {
            toast.success('Reçu envoyé', `Le message a été transmis au ${phone} via WhatsApp.`);
            return true;
        } else {
            throw new Error(result.error || 'Le service WhatsApp est indisponible ou non connecté.');
        }
    } catch (err) {
        console.warn('[Cvisual WhatsApp] Erreur transmission serveur, enregistrement dans la table:', err);
        // Sauvegarde de secours dans la base Supabase cvisual_whatsapp_messages
        await db.from('cvisual_whatsapp_messages').insert([{
            business_id: biz.id,
            sale_id: sale.id,
            phone_number: phone,
            content: messageText,
            status: 'queued'
        }]);
        toast.warning('WhatsApp en attente', 'Le reçu a été placé en file d\'envoi sur le serveur.');
        return false;
    }
}

/**
 * Modale de saisie du numéro pour envoi rapide de reçu
 */
export function openSendReceiptModal(sale, business) {
    const existing = document.getElementById('cvisual-wa-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'cvisual-wa-modal';

    const defaultPhone = sale.customer_phone || '';

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 400px;">
            <div class="modal-header">
                <h3 class="modal-title" style="display:flex; align-items:center; gap:8px;">
                    <i data-lucide="message-square" style="color:#25D366;"></i>
                    Envoyer le reçu WhatsApp
                </h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-wa-modal">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Numéro WhatsApp du client</label>
                    <input type="tel" id="wa-modal-phone" class="form-control" placeholder="+509 3700 0000" value="${defaultPhone}">
                    <span style="font-size:12px; color:#64748B; margin-top:4px; display:block;">
                        Indicatif Haïti +509 appliqué automatiquement.
                    </span>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="btn-cancel-wa">Annuler</button>
                <button type="button" class="btn btn-primary" id="btn-confirm-wa" style="background:#25D366;">
                    Envoyer maintenant
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons({ root: overlay });

    const phoneInput = overlay.querySelector('#wa-modal-phone');
    phoneInput.focus();

    overlay.querySelector('#btn-close-wa-modal').onclick = () => overlay.remove();
    overlay.querySelector('#btn-cancel-wa').onclick = () => overlay.remove();

    overlay.querySelector('#btn-confirm-wa').onclick = async () => {
        const phone = phoneInput.value.trim();
        if (!phone) {
            toast.error('Erreur', 'Veuillez renseigner un numéro.');
            return;
        }
        overlay.remove();
        await sendReceiptWhatsApp(sale, business, phone);
    };
}
