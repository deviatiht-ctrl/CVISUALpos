/**
 * CVISUAL POS — catalogue-settings.js
 * Configuration et personnalisation de la vitrine / catalogue public en ligne.
 */

import { db } from '../supabase.js';
import { toast } from '../toast.js';

let currentSession = null;

export async function render(container, session) {
    currentSession = session;
    const biz = session.business;
    const catSettings = biz.catalogue_settings || {
        enabled: true,
        allow_orders: true,
        order_whatsapp: true,
        about_text: '',
        faq: []
    };

    const catalogueURL = `${window.location.origin}/catalogue.html?e=${biz.slug}`;

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Vitrine & Catalogue Web Public</h1>
                <p class="page-subtitle">Partagez votre catalogue en ligne pour permettre à vos clients de commander via WhatsApp.</p>
            </div>
            <div style="display: flex; gap: 8px;">
                <a href="${catalogueURL}" target="_blank" class="btn btn-outline btn-sm">
                    <i data-lucide="external-link"></i>
                    <span>Voir le catalogue en direct</span>
                </a>
                <button type="button" class="btn btn-primary btn-sm" id="btn-save-catalogue-settings">
                    <i data-lucide="save"></i>
                    <span>Enregistrer</span>
                </button>
            </div>
        </div>

        <!-- LIEN PUBLIC ET QR CODE -->
        <div class="c-card" style="margin-bottom: 24px; padding: 24px;">
            <div style="display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
                <div style="width: 110px; height: 110px; border-radius: 12px; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; background: #FFFFFF; flex-shrink: 0;">
                    <canvas id="catalogue-qr-preview" style="width: 100px; height: 100px;"></canvas>
                </div>
                <div style="flex: 1; min-width: 260px;">
                    <label class="form-label">Lien public de votre vitrine</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="cat-public-url" class="form-control" readonly value="${catalogueURL}" style="font-family: monospace; background: var(--bg-subtle);">
                        <button type="button" class="btn btn-outline" id="btn-copy-cat-url" title="Copier le lien">
                            <i data-lucide="copy"></i>
                        </button>
                    </div>
                    <span style="font-size: 12px; color: var(--text-muted); margin-top: 6px; display: block;">
                        Imprimez ce QR Code ou partagez ce lien sur vos réseaux sociaux (Instagram, WhatsApp, Facebook).
                    </span>
                </div>
            </div>
        </div>

        <!-- FORMULAIRE DE PERSONNALISATION -->
        <div class="c-card" style="padding: 24px;">
            <h3 style="font-size: 16px; margin-bottom: 20px;">Paramètres de visibilité et commandes</h3>

            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 10px; font-weight: 600; cursor: pointer;">
                    <input type="checkbox" id="cat-enabled" ${catSettings.enabled ? 'checked' : ''}>
                    <span>Activer la vitrine publique en ligne</span>
                </label>
            </div>

            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 10px; font-weight: 600; cursor: pointer;">
                    <input type="checkbox" id="cat-allow-orders" ${catSettings.allow_orders ? 'checked' : ''}>
                    <span>Permettre les commandes directes vers WhatsApp</span>
                </label>
            </div>

            <div class="form-group" style="margin-top: 20px;">
                <label class="form-label">Identifiant unique d'URL (Slug) *</label>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="color: var(--text-muted); font-size: 14px;">/catalogue.html?e=</span>
                    <input type="text" id="cat-slug" class="form-control" value="${biz.slug || ''}" placeholder="mon-commerce">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Image de couverture / Bannière (URL)</label>
                <input type="text" id="cat-cover-url" class="form-control" value="${biz.cover_url || ''}" placeholder="https://...">
            </div>

            <div class="form-group">
                <label class="form-label">Présentation de votre boutique (Texte "À propos")</label>
                <textarea id="cat-about" class="form-control" rows="3" placeholder="Présentez l'histoire de votre entreprise, vos valeurs et services...">${catSettings.about_text || ''}</textarea>
            </div>
        </div>
    `;

    // Générer le QR Code avec la librairie qrcode
    const canvas = document.getElementById('catalogue-qr-preview');
    if (canvas && window.QRCode) {
        window.QRCode.toCanvas(canvas, catalogueURL, { width: 100, margin: 1 });
    }

    // Copier l'URL
    const copyBtn = document.getElementById('btn-copy-cat-url');
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(catalogueURL);
            toast.success('Lien copié', 'Le lien public a été copié.');
        };
    }

    // Enregistrer les réglages
    const saveBtn = document.getElementById('btn-save-catalogue-settings');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            const newSlug = document.getElementById('cat-slug').value.trim();
            const coverUrl = document.getElementById('cat-cover-url').value.trim();
            const aboutText = document.getElementById('cat-about').value.trim();
            const enabled = document.getElementById('cat-enabled').checked;
            const allowOrders = document.getElementById('cat-allow-orders').checked;

            if (!newSlug) {
                toast.warning('Slug manquant', 'Veuillez saisir un slug.');
                return;
            }

            const updatedCatSettings = {
                ...catSettings,
                enabled,
                allow_orders: allowOrders,
                order_whatsapp: allowOrders,
                about_text: aboutText
            };

            try {
                await db.from('cvisual_businesses').update({
                    slug: newSlug,
                    cover_url: coverUrl || null,
                    catalogue_settings: updatedCatSettings
                }).eq('id', biz.id);

                session.business.slug = newSlug;
                session.business.cover_url = coverUrl;
                session.business.catalogue_settings = updatedCatSettings;

                toast.success('Réglages enregistrés', 'Votre vitrine en ligne a été mise à jour.');
            } catch (err) {
                toast.error('Erreur', err.message);
            }
        };
    }

    if (window.lucide) window.lucide.createIcons();
}
