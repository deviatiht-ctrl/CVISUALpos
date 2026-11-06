# Cvisual POS — WhatsApp Micro-Service (`whatsapp-server/`)

Ce service Node.js indépendant permet à chaque entreprise inscrite sur **Cvisual POS** d'associer son numéro WhatsApp officiel pour transmettre automatiquement les reçus de caisse aux clients au moment de la vente.

---

## 1. Prérequis & Architecture

- **Node.js** >= 18.x
- **Chromium / Google Chrome** (requis par `whatsapp-web.js` / Puppeteer)
- Persistance de disque pour le dossier `.wwebjs_auth` (sessions LocalAuth)

---

## 2. Variables d'Environnement (`.env`)

Créez un fichier `.env` à la racine de `whatsapp-server/` :

```env
PORT=3001
NODE_ENV=production
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role_secrete
DATA_PATH=./.wwebjs_auth
```

---

## 3. Lancement Local

```bash
cd whatsapp-server
npm install
npm run dev
```

Le serveur sera accessible sur `http://localhost:3001`.

---

## 4. Déploiement en Production

### Option A : Déploiement sur Railway

1. Créez un nouveau projet sur [Railway](https://railway.app).
2. Liez le dossier `whatsapp-server/`.
3. Ajoutez un **Persistent Volume** monté sur `/app/.wwebjs_auth` pour ne pas perdre les sessions lors des redémarrages.
4. Dans **Variables**, renseignez :
   - `PORT=3001`
   - `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false`
   - `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`
5. Railway installe automatiquement les dépendances Linux nécessaires à Chromium via Nixpacks.

### Option B : Déploiement sur Render

1. Créez un **Web Service** sur [Render](https://render.com).
2. Environnement : `Node`.
3. Build Command : `npm install`.
4. Start Command : `npm start`.
5. Ajoutez un **Disk** persistant monté sur `/opt/render/project/src/.wwebjs_auth`.

### Option C : Déploiement sur VPS Ubuntu / Debian

Installez les dépendances Chromium requises par Puppeteer :

```bash
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils
```

Lancez le serveur via PM2 pour le maintenir actif 24h/24 :

```bash
npm install -g pm2
pm2 start server.js --name "cvisual-wa"
pm2 save
pm2 startup
```

---

## 5. Endpoints de l'API

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/session/start` | Démarre l'écouteur et génère le QR code |
| `GET` | `/session/status` | Statut courant (`disconnected`, `qr`, `connecting`, `connected`) |
| `GET` | `/session/qr` | QR code au format Data URL (base64 image) |
| `POST` | `/session/logout` | Déconnecte l'appareil WhatsApp |
| `POST` | `/send/receipt` | Envoie le reçu au client via WhatsApp |
| `GET` | `/health` | Diagnostic santé et sessions actives |
