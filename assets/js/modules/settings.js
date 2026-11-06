/**
 * CVISUAL POS — settings.js
 * Paramètres généraux de l'entreprise, profil, devises, impression et intégration WhatsApp.
 */

import { db } from '../supabase.js';
import { toast } from '../toast.js';
import { setLang, getLang } from '../i18n.js';
import { openReceiptPreviewModal } from './receipt.js';

let currentSession = null;

export async function render(container, session) {
    currentSession = session;
    const biz = session.business;

    const receiptSet = biz.receipt_settings || {
        format: '80mm',
        show_logo: true,
        show_qr: true,
        header_text: '',
        footer_text: 'Merci pour votre fidélité !',
        show_socials: true
    };

    const waSet = biz.whatsapp_settings || {
        auto_send: false,
        template: "Bonjour {client}, voici votre reçu #{numero_recu} d'un montant de {total} chez {entreprise}. Merci de votre visite !"
    };

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Configuration & Paramètres</h1>
                <p class="page-subtitle">Profil commercial, devises, modèles d'impression thermique et service WhatsApp.</p>
            </div>
            <button type="button" class="btn btn-primary" id="btn-save-all-settings">
                <i data-lucide="save"></i>
                <span>Enregistrer les modifications</span>
            </button>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
            <!-- COLONNE GAUCHE : REGLAGES GLOBAUX -->
            <div style="display: flex; flex-direction: column; gap: 24px;">
                <!-- 1. IDENTITÉ ENTREPRISE -->
                <div class="c-card" style="padding: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 18px; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="store" style="color: var(--color-primary);"></i>
                        Identité de l'Établissement
                    </h3>
                    <div class="form-group">
                        <label class="form-label">Nom commercial *</label>
                        <input type="text" id="set-biz-name" class="form-control" value="${biz.name || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Slogan</label>
                        <input type="text" id="set-biz-slogan" class="form-control" value="${biz.slogan || ''}" placeholder="Ex: La qualité au meilleur prix">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                        <div class="form-group">
                            <label class="form-label">Téléphone</label>
                            <input type="tel" id="set-biz-phone" class="form-control" value="${biz.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">WhatsApp commercial</label>
                            <input type="tel" id="set-biz-wa" class="form-control" value="${biz.whatsapp || ''}">
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px;">
                        <div class="form-group">
                            <label class="form-label">Adresse physique</label>
                            <input type="text" id="set-biz-address" class="form-control" value="${biz.address || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ville</label>
                            <input type="text" id="set-biz-city" class="form-control" value="${biz.city || 'Pétion-Ville'}">
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                        <div class="form-group">
                            <label class="form-label">NIF / Identifiant fiscal</label>
                            <input type="text" id="set-biz-taxid" class="form-control" value="${biz.tax_id || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Logo (URL ou lien Supabase Storage)</label>
                            <input type="text" id="set-biz-logo" class="form-control" value="${biz.logo_url || ''}">
                        </div>
                    </div>
                </div>

                <!-- 2. DEVISES ET FISCALITÉ -->
                <div class="c-card" style="padding: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 18px; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="coins" style="color: var(--color-primary);"></i>
                        Devises & Fiscalité
                    </h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;">
                        <div class="form-group">
                            <label class="form-label">Devise Principale</label>
                            <select id="set-primary-curr" class="form-control">
                                <option value="HTG" ${biz.primary_currency === 'HTG' ? 'selected' : ''}>Gourde Haïtienne (HTG)</option>
                                <option value="USD" ${biz.primary_currency === 'USD' ? 'selected' : ''}>Dollar US (USD)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Devise Secondaire</label>
                            <select id="set-sec-curr" class="form-control">
                                <option value="USD" ${biz.secondary_currency === 'USD' ? 'selected' : ''}>Dollar US (USD)</option>
                                <option value="HTG" ${biz.secondary_currency === 'HTG' ? 'selected' : ''}>Gourde Haïtienne (HTG)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Taux de change (1 USD = X HTG)</label>
                            <input type="number" id="set-exchange-rate" class="form-control" step="any" value="${biz.exchange_rate || 132.50}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Taux de taxe par défaut (%)</label>
                        <input type="number" id="set-tax-rate" class="form-control" step="any" value="${biz.default_tax_rate || 0}">
                    </div>
                </div>

                <!-- 3. CONFIGURATION DES REÇUS ET IMPRESSION -->
                <div class="c-card" style="padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
                        <h3 style="font-size: 16px; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="printer" style="color: var(--color-primary);"></i>
                            Format du Reçu & Impression
                        </h3>
                        <button type="button" class="btn btn-outline btn-sm" id="btn-test-preview-receipt">
                            <i data-lucide="eye"></i>
                            <span>Aperçu en direct</span>
                        </button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                        <div class="form-group">
                            <label class="form-label">Format de papier prédéfini</label>
                            <select id="set-receipt-format" class="form-control">
                                <option value="80mm" ${receiptSet.format === '80mm' ? 'selected' : ''}>Thermique 80mm (Recommandé)</option>
                                <option value="58mm" ${receiptSet.format === '58mm' ? 'selected' : ''}>Thermique 58mm (Étroit)</option>
                                <option value="a5" ${receiptSet.format === 'a5' ? 'selected' : ''}>Format A5 (Facturette)</option>
                                <option value="a4" ${receiptSet.format === 'a4' ? 'selected' : ''}>Format A4 (Pleine page)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">QR Code sur le ticket</label>
                            <select id="set-receipt-qr" class="form-control">
                                <option value="catalogue" ${receiptSet.qr_type === 'catalogue' ? 'selected' : ''}>Lien vers le Catalogue Web</option>
                                <option value="receipt" ${receiptSet.qr_type === 'receipt' ? 'selected' : ''}>Reçu numérique en ligne</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Message d'accueil (En-tête)</label>
                        <input type="text" id="set-receipt-header" class="form-control" value="${receiptSet.header_text || ''}" placeholder="Ex: Bienvenue dans notre établissement">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Message de remerciement (Pied de ticket)</label>
                        <input type="text" id="set-receipt-footer" class="form-control" value="${receiptSet.footer_text || 'Merci pour votre fidélité !'}">
                    </div>
                </div>
            </div>

            <!-- COLONNE DROITE : LANGUE & WHATSAPP -->
            <div style="display: flex; flex-direction: column; gap: 24px;">
                <!-- LANGUE DE L'APPLICATION -->
                <div class="c-card" style="padding: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="globe" style="color: var(--color-primary);"></i>
                        Langue de l'interface
                    </h3>
                    <select id="set-lang-select" class="form-control">
                        <option value="fr" ${getLang() === 'fr' ? 'selected' : ''}>Français</option>
                        <option value="ht" ${getLang() === 'ht' ? 'selected' : ''}>Kreyòl Ayisyen</option>
                        <option value="en" ${getLang() === 'en' ? 'selected' : ''}>English</option>
                    </select>
                </div>

                <!-- INTÉGRATION SERVICE WHATSAPP -->
                <div class="c-card" style="padding: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="message-square" style="color: #25D366;"></i>
                        Intégration WhatsApp
                    </h3>
                    <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 14px; margin-bottom: 16px;">
                        <div style="font-weight: 600; font-size: 13.5px; color: #166534;">Statut de connexion</div>
                        <div style="font-size: 12.5px; color: #15803D; margin-top: 4px;">Service prêt et configurable pour l'envoi de reçus automatiques.</div>
                    </div>

                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer;">
                            <input type="checkbox" id="set-wa-autosend" ${waSet.auto_send ? 'checked' : ''}>
                            <span>Envoyer automatiquement le ticket par WhatsApp</span>
                        </label>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Modèle de message WhatsApp</label>
                        <textarea id="set-wa-template" class="form-control" rows="4">${waSet.template || ''}</textarea>
                        <span style="font-size: 11px; color: var(--text-muted); margin-top: 4px; display: block;">
                            Variables disponibles : {client}, {entreprise}, {total}, {numero_recu}, {date}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Événement aperçu reçu en direct
    const previewBtn = document.getElementById('btn-test-preview-receipt');
    if (previewBtn) {
        previewBtn.onclick = () => {
            const sampleSale = {
                id: 'demo',
                receipt_number: 'REC-202611-0042',
                customer_name: 'Client Démonstration',
                subtotal: 10500,
                discount_amount: 500,
                tax_amount: 1000,
                total_amount: 11000,
                currency: biz.primary_currency || 'HTG',
                created_at: new Date().toISOString(),
                items: [
                    { name: 'Article Démo A', qty: 2, unit_price: 3500, total_price: 7000 },
                    { name: 'Article Démo B', qty: 1, unit_price: 3500, total_price: 3500 }
                ]
            };
            openReceiptPreviewModal(sampleSale, biz);
        };
    }

    // Événement changement de langue
    const langSelect = document.getElementById('set-lang-select');
    if (langSelect) {
        langSelect.onchange = () => {
            setLang(langSelect.value);
            toast.success('Langue modifiée', 'Interface mise à jour.');
        };
    }

    // Enregistrer tous les réglages
    const saveAllBtn = document.getElementById('btn-save-all-settings');
    if (saveAllBtn) {
        saveAllBtn.onclick = async () => {
            const name = document.getElementById('set-biz-name').value.trim();
            if (!name) {
                toast.warning('Nom obligatoire', 'Renseignez le nom de votre établissement.');
                return;
            }

            const updatedReceipt = {
                format: document.getElementById('set-receipt-format').value,
                qr_type: document.getElementById('set-receipt-qr').value,
                show_logo: true,
                show_qr: true,
                header_text: document.getElementById('set-receipt-header').value.trim(),
                footer_text: document.getElementById('set-receipt-footer').value.trim(),
                show_socials: true
            };

            const updatedWA = {
                auto_send: document.getElementById('set-wa-autosend').checked,
                template: document.getElementById('set-wa-template').value.trim()
            };

            const payload = {
                name: name,
                slogan: document.getElementById('set-biz-slogan').value.trim() || null,
                phone: document.getElementById('set-biz-phone').value.trim() || null,
                whatsapp: document.getElementById('set-biz-wa').value.trim() || null,
                address: document.getElementById('set-biz-address').value.trim() || null,
                city: document.getElementById('set-biz-city').value.trim() || null,
                tax_id: document.getElementById('set-biz-taxid').value.trim() || null,
                logo_url: document.getElementById('set-biz-logo').value.trim() || null,
                primary_currency: document.getElementById('set-primary-curr').value,
                secondary_currency: document.getElementById('set-sec-curr').value,
                exchange_rate: parseFloat(document.getElementById('set-exchange-rate').value) || 132.50,
                default_tax_rate: parseFloat(document.getElementById('set-tax-rate').value) || 0,
                receipt_settings: updatedReceipt,
                whatsapp_settings: updatedWA
            };

            try {
                await db.from('cvisual_businesses').update(payload).eq('id', biz.id);
                Object.assign(session.business, payload);
                toast.success('Modifications enregistrées', 'Vos paramètres ont été sauvegardés.');
            } catch (err) {
                toast.error('Erreur', err.message);
            }
        };
    }

    if (window.lucide) window.lucide.createIcons();
}
