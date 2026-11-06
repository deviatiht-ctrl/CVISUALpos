/**
 * CVISUAL POS — receipt.js
 * Générateur de reçus multi-formats (58mm, 80mm, A5, A4)
 * Support QR Code, impression thermique haute lisibilité, aperçu modale et export
 */

export function generateReceiptHTML(sale, business, options = {}) {
    const biz = business || {};
    const settings = biz.receipt_settings || {
        format: '80mm',
        show_logo: true,
        show_qr: true,
        qr_type: 'catalogue',
        header_text: '',
        footer_text: 'Merci pour votre fidélité !',
        show_socials: true,
        show_images: false
    };

    const format = options.format || settings.format || '80mm';
    const items = sale.items || sale.sale_items || [];
    const payments = sale.payments || [];
    const dateFormatted = new Date(sale.created_at || Date.now()).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    const qrData = options.qrData || (settings.qr_type === 'catalogue' 
        ? `${window.location.origin}/catalogue.html?e=${biz.slug || ''}`
        : `${window.location.origin}/app.html#receipt?id=${sale.id || ''}`);

    let itemsRowsHTML = '';
    items.forEach(item => {
        const name = item.product_name || item.name || 'Article';
        const qty = Number(item.quantity || item.qty || 1);
        const unitPrice = Number(item.unit_price || 0).toFixed(2);
        const total = Number(item.total_price || item.total || (qty * unitPrice)).toFixed(2);

        itemsRowsHTML += `
            <tr>
                <td style="padding: 4px 0;">
                    <div class="receipt-item-name">${name}</div>
                    <div class="receipt-item-sub">${qty} x ${unitPrice} ${sale.currency || 'HTG'}</div>
                </td>
                <td class="text-right" style="padding: 4px 0; font-weight: 700;">
                    ${total} ${sale.currency || 'HTG'}
                </td>
            </tr>
        `;
    });

    return `
        <div class="receipt-wrapper receipt-format-${format}" id="receipt-print-area">
            <!-- EN-TÊTE -->
            <div class="receipt-header">
                ${settings.show_logo && biz.logo_url ? `
                    <img src="${biz.logo_url}" alt="Logo" class="receipt-logo" />
                ` : ''}
                <div class="receipt-biz-name">${biz.name || 'CVISUAL POS'}</div>
                ${biz.slogan ? `<div class="receipt-biz-slogan">${biz.slogan}</div>` : ''}
                <div class="receipt-biz-contact">
                    ${biz.address ? `<div>${biz.address}, ${biz.city || ''}</div>` : ''}
                    ${biz.phone ? `<div>Tél : ${biz.phone}</div>` : ''}
                    ${biz.tax_id ? `<div>NIF : ${biz.tax_id}</div>` : ''}
                </div>
                ${settings.header_text ? `<div style="margin-top:6px; font-weight:600; font-size:11px;">${settings.header_text}</div>` : ''}
            </div>

            <!-- INFOS VENTE -->
            <div class="receipt-meta">
                <div class="receipt-meta-row">
                    <span>Reçu # :</span>
                    <strong style="font-family:monospace;">${sale.receipt_number || 'PROVISOIRE'}</strong>
                </div>
                <div class="receipt-meta-row">
                    <span>Date :</span>
                    <span>${dateFormatted}</span>
                </div>
                ${sale.customer_name ? `
                    <div class="receipt-meta-row">
                        <span>Client :</span>
                        <span>${sale.customer_name}</span>
                    </div>
                ` : ''}
            </div>

            <!-- ARTICLES -->
            <table class="receipt-table">
                <thead>
                    <tr>
                        <th>Désignation</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRowsHTML}
                </tbody>
            </table>

            <!-- TOTAUX -->
            <div class="receipt-totals">
                <div class="receipt-total-row">
                    <span>Sous-total :</span>
                    <span>${Number(sale.subtotal || sale.total_amount).toFixed(2)} ${sale.currency || 'HTG'}</span>
                </div>
                ${Number(sale.discount_amount) > 0 ? `
                    <div class="receipt-total-row" style="color:#000;">
                        <span>Remise :</span>
                        <span>-${Number(sale.discount_amount).toFixed(2)} ${sale.currency || 'HTG'}</span>
                    </div>
                ` : ''}
                ${Number(sale.tax_amount) > 0 ? `
                    <div class="receipt-total-row">
                        <span>Taxe :</span>
                        <span>+${Number(sale.tax_amount).toFixed(2)} ${sale.currency || 'HTG'}</span>
                    </div>
                ` : ''}
                <div class="receipt-total-row grand-total">
                    <span>TOTAL :</span>
                    <span>${Number(sale.total_amount).toFixed(2)} ${sale.currency || 'HTG'}</span>
                </div>
                ${sale.amount_received ? `
                    <div class="receipt-total-row">
                        <span>Montant Reçu :</span>
                        <span>${Number(sale.amount_received).toFixed(2)} ${sale.currency || 'HTG'}</span>
                    </div>
                    <div class="receipt-total-row">
                        <span>Monnaie Rendue :</span>
                        <span>${Number(sale.change_given || 0).toFixed(2)} ${sale.currency || 'HTG'}</span>
                    </div>
                ` : ''}
            </div>

            <!-- PIED DE PAGE & QR CODE -->
            <div class="receipt-footer">
                ${settings.show_qr ? `
                    <div class="receipt-qr-box">
                        <canvas id="receipt-qr-canvas" class="receipt-qr-img"></canvas>
                        <span style="font-size:9.5px; margin-top:2px; color:#333;">Scannez pour voir le catalogue</span>
                    </div>
                ` : ''}

                <div style="font-size:11px; margin: 6px 0; font-weight:600;">
                    ${settings.footer_text || 'Merci de votre visite !'}
                </div>

                ${settings.show_socials ? `
                    <div class="receipt-socials">
                        ${biz.whatsapp ? `<span class="receipt-social-item">WA: ${biz.whatsapp}</span>` : ''}
                        ${biz.instagram ? `<span class="receipt-social-item">IG: @${biz.instagram}</span>` : ''}
                    </div>
                ` : ''}

                <div class="receipt-cvisual-signature">
                    Designed by Cvisual
                </div>
            </div>
        </div>
    `;
}

/**
 * Lance l'impression système du reçu
 */
export async function printReceipt(sale, business, options = {}) {
    const html = generateReceiptHTML(sale, business, options);
    
    // Création d'un conteneur d'impression invisible ou iframe
    let iframe = document.getElementById('cvisual-print-iframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'cvisual-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Reçu ${sale.receipt_number || ''}</title>
            <link rel="stylesheet" href="assets/css/receipt.css">
            <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
        </head>
        <body>
            ${html}
            <script>
                window.onload = function() {
                    const canvas = document.getElementById('receipt-qr-canvas');
                    if (canvas && window.QRCode) {
                        QRCode.toCanvas(canvas, "${options.qrData || window.location.origin}", { width: 90, margin: 1 }, function() {
                            window.focus();
                            window.print();
                        });
                    } else {
                        window.focus();
                        window.print();
                    }
                };
            <\/script>
        </body>
        </html>
    `);
    doc.close();
}

/**
 * Affiche la modale d'aperçu du reçu
 */
export function openReceiptPreviewModal(sale, business) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'receipt-preview-modal';

    const html = generateReceiptHTML(sale, business);

    overlay.innerHTML = `
        <div class="modal-dialog" style="max-width: 440px;">
            <div class="modal-header">
                <h3 class="modal-title">Aperçu du Reçu</h3>
                <button type="button" class="btn btn-outline btn-sm" id="btn-close-receipt-preview">Fermer</button>
            </div>
            <div class="modal-body" style="background:#F8FAFC; padding:16px; overflow-y:auto; max-height:70vh;">
                ${html}
            </div>
            <div class="modal-footer" style="justify-content:space-between;">
                <button type="button" class="btn btn-outline" id="btn-preview-send-wa">
                    <i data-lucide="send"></i> WhatsApp
                </button>
                <button type="button" class="btn btn-primary" id="btn-preview-print">
                    <i data-lucide="printer"></i> Imprimer
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Rendu QR Code
    const canvas = overlay.querySelector('#receipt-qr-canvas');
    if (canvas && window.QRCode) {
        const qrUrl = `${window.location.origin}/catalogue.html?e=${business?.slug || ''}`;
        window.QRCode.toCanvas(canvas, qrUrl, { width: 90, margin: 1 });
    }

    if (window.lucide) window.lucide.createIcons({ root: overlay });

    const closeBtn = overlay.querySelector('#btn-close-receipt-preview');
    closeBtn.onclick = () => overlay.remove();

    const printBtn = overlay.querySelector('#btn-preview-print');
    printBtn.onclick = () => {
        printReceipt(sale, business);
    };

    const waBtn = overlay.querySelector('#btn-preview-send-wa');
    waBtn.onclick = () => {
        import('./whatsapp.js').then(m => m.openSendReceiptModal(sale, business));
    };
}
