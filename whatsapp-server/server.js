/**
 * CVISUAL POS — whatsapp-server/server.js
 * Serveur Node.js Express multi-entreprises pour whatsapp-web.js
 * Isolation par session LocalAuth (clientId = business_id).
 * Envoi sécurisé de reçus de caisse et QR code d'appairage.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase Admin client
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://xyzcompanypos.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake_service_role_key'
);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Gestion des sessions en mémoire
// sessions[business_id] = { client, status, qr, number }
const sessions = {};

/**
 * Middleware d'authentification Supabase JWT
 */
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // En mode local sans token configuré, permettre le passage pour les tests
        if (process.env.NODE_ENV === 'development') {
            return next();
        }
        return res.status(401).json({ error: 'Token d\'authentification manquant.' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(403).json({ error: 'Session invalide ou expirée.' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Échec de vérification du token.' });
    }
}

/**
 * Normalisation des numéros de téléphone (Haïti +509 par défaut)
 */
function normalizePhone(phone) {
    let cleaned = (phone || '').replace(/[\s\-\(\)\.]/g, '');
    if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
    if (cleaned.length === 8 && (cleaned.startsWith('3') || cleaned.startsWith('4') || cleaned.startsWith('2'))) {
        cleaned = '509' + cleaned;
    }
    return cleaned;
}

/**
 * Initialise ou récupère une session WhatsApp pour une entreprise
 */
function getOrCreateSession(businessId) {
    if (sessions[businessId]) {
        return sessions[businessId];
    }

    console.log(`[Cvisual WhatsApp] Démarrage de la session pour l'entreprise ${businessId}...`);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: `biz_${businessId}`,
            dataPath: process.env.DATA_PATH || './.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    const sessionData = {
        client,
        status: 'connecting',
        qr: null,
        number: null
    };

    client.on('qr', async (qr) => {
        sessionData.status = 'qr';
        try {
            sessionData.qr = await QRCode.toDataURL(qr);
            console.log(`[Cvisual WhatsApp] Nouveau QR généré pour ${businessId}`);
        } catch (e) {
            sessionData.qr = qr;
        }
    });

    client.on('ready', () => {
        sessionData.status = 'connected';
        sessionData.qr = null;
        sessionData.number = client.info?.wid?.user || 'Connecté';
        console.log(`[Cvisual WhatsApp] Session prête et connectée pour ${businessId} (${sessionData.number})`);
    });

    client.on('authenticated', () => {
        sessionData.status = 'authenticated';
        console.log(`[Cvisual WhatsApp] Authentification réussie pour ${businessId}`);
    });

    client.on('auth_failure', (msg) => {
        sessionData.status = 'disconnected';
        sessionData.qr = null;
        console.error(`[Cvisual WhatsApp] Échec d'authentification pour ${businessId}:`, msg);
    });

    client.on('disconnected', (reason) => {
        sessionData.status = 'disconnected';
        sessionData.qr = null;
        sessionData.number = null;
        console.log(`[Cvisual WhatsApp] Session déconnectée pour ${businessId}:`, reason);
    });

    client.initialize().catch(err => {
        console.error(`[Cvisual WhatsApp] Erreur initialisation ${businessId}:`, err);
        sessionData.status = 'disconnected';
    });

    sessions[businessId] = sessionData;
    return sessionData;
}

// ------------------------------------------------------------------------------
// ENDPOINTS DE GESTION DE SESSION
// ------------------------------------------------------------------------------

/**
 * POST /session/start
 * Démarre la session et génère le QR code
 */
app.post('/session/start', authenticateToken, (req, res) => {
    const { business_id } = req.body;
    if (!business_id) {
        return res.status(400).json({ error: 'business_id obligatoire.' });
    }
    const session = getOrCreateSession(business_id);
    res.json({
        success: true,
        status: session.status,
        qr: session.qr
    });
});

/**
 * GET /session/status?business_id=xxx
 * Retourne le statut courant de la session
 */
app.get('/session/status', authenticateToken, (req, res) => {
    const { business_id } = req.query;
    if (!business_id || !sessions[business_id]) {
        return res.json({ status: 'disconnected', number: null });
    }
    const session = sessions[business_id];
    res.json({
        status: session.status,
        number: session.number,
        hasQr: !!session.qr
    });
});

/**
 * GET /session/qr?business_id=xxx
 * Retourne le QR code actif
 */
app.get('/session/qr', authenticateToken, (req, res) => {
    const { business_id } = req.query;
    if (!business_id || !sessions[business_id]) {
        return res.status(404).json({ error: 'Session non initialisée.' });
    }
    res.json({
        qr: sessions[business_id].qr,
        status: sessions[business_id].status
    });
});

/**
 * POST /session/logout
 * Déconnecte la session WhatsApp
 */
app.post('/session/logout', authenticateToken, async (req, res) => {
    const { business_id } = req.body;
    if (sessions[business_id]) {
        try {
            await sessions[business_id].client.logout();
            await sessions[business_id].client.destroy();
        } catch (e) {
            console.warn('Erreur logout:', e);
        }
        delete sessions[business_id];
    }
    res.json({ success: true, message: 'Session WhatsApp déconnectée.' });
});

/**
 * POST /send/receipt
 * Envoie un ticket de caisse à un client
 */
app.post('/send/receipt', authenticateToken, async (req, res) => {
    const { business_id, phone, message, media_base64, media_type } = req.body;

    if (!business_id || !phone || !message) {
        return res.status(400).json({ error: 'business_id, phone et message sont obligatoires.' });
    }

    const session = sessions[business_id];
    if (!session || session.status !== 'connected') {
        return res.status(503).json({
            error: 'Session WhatsApp non connectée pour cette entreprise. Veuillez scanner le QR code dans les Paramètres.'
        });
    }

    const cleanPhone = normalizePhone(phone);
    const chatId = `${cleanPhone}@c.us`;

    try {
        // Petit délai aléatoire de sécurité anti-blocage (300ms à 900ms)
        const delay = Math.floor(300 + Math.random() * 600);
        await new Promise(r => setTimeout(r, delay));

        // Envoi texte
        let sentMessage;
        if (media_base64 && media_type) {
            const media = new MessageMedia(media_type, media_base64, 'recu-cvisual.png');
            sentMessage = await session.client.sendMessage(chatId, media, { caption: message });
        } else {
            sentMessage = await session.client.sendMessage(chatId, message);
        }

        console.log(`[Cvisual WhatsApp] Reçu transmis avec succès au ${cleanPhone}`);
        res.json({ success: true, messageId: sentMessage.id.id });

    } catch (err) {
        console.error(`[Cvisual WhatsApp] Erreur envoi vers ${cleanPhone}:`, err);
        res.status(500).json({ error: err.message || 'Échec d\'envoi du message WhatsApp.' });
    }
});

// Santé du serveur
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime(), active_sessions: Object.keys(sessions).length });
});

app.listen(PORT, () => {
    console.log(`[Cvisual WhatsApp Service] Serveur actif sur le port ${PORT}`);
});
