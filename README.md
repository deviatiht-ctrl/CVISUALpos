# Cvisual POS — Système de gestion et point de vente multi-entreprises

Système de caisse et de gestion commerciale SaaS complet, multi-entreprises et utilisable hors ligne (offline-first PWA), conçu pour répondre aux besoins opérationnels des commerces modernes : salons de beauté, boutiques, supermarchés, quincailleries, restaurants et pharmacies.

---

## 🚀 Fonctionnalités Clés

- **Multi-entreprises (SaaS)** : Isolation stricte de chaque entreprise (`cvisual_businesses`) avec RLS PostgreSQL.
- **Fonctionnement Hors-Ligne (Offline-First)** :
  - IndexedDB local pour les ventes, produits, clients et sessions.
  - File d'attente de synchronisation bidirectionnelle automatique à la reconnexion.
  - PWA installable sur Desktop, Android et iOS via `manifest.json` et `service-worker.js`.
- **Interface Caisse (POS)** :
  - Vente rapide, support tactile, recherche instantanée, lecteur code-barres.
  - Modes de paiement multiples : Espèces (HTG / USD avec taux de change configurable), MonCash, NatCash, Carte bancaire, Crédit client.
  - Impression de reçus thermiques multi-formats (80mm, 58mm, A4) et export image/PDF.
  - Envoi automatique ou manuel de reçus via WhatsApp.
- **Gestion Complète** :
  - Catalogue produits avec variantes, stocks, seuils d'alerte et mouvements d'inventaire.
  - Fichier clients avec suivi des soldes, limites de crédit et points de fidélité.
  - Gestion des fournisseurs et commandes d'achat.
  - Journal de caisse avec suivi des ouvertures, fermetures et écarts de caisse.
  - Dépenses de fonctionnement catégorisées.
  - Rapports analytiques avec graphiques interactifs (Chart.js) et exports Excel (SheetJS).
- **Catalogue Public en Ligne** :
  - Vitrine e-commerce accessible via `/catalogue.html?e=slug`.
  - Commande directe transmise sur WhatsApp avec panier pré-rempli.
- **Console Super-Admin** :
  - Modération des entreprises (`pending`, `approved`, `suspended`, `rejected`).
  - Tableaux de bord de métriques globales et audit logs.

---

## 🛠 Stack Technique

- **Frontend** : HTML5, CSS3 pur (grille 4px, typographies DM Sans & Syne), JavaScript ES Modules vanilla.
- **Backend & Base de données** : Supabase (PostgreSQL, Row Level Security, Auth, Storage, Edge Functions).
- **Microservice WhatsApp** : Node.js + Express + `whatsapp-web.js` (dans `whatsapp-server/`).
- **Librairies & CDNs** :
  - Supabase JS v2
  - Lucide Icons (zéro emoji)
  - Chart.js 4.4
  - SheetJS (xlsx)
  - QRCode.js
  - html2canvas

---

## 📂 Structure du Projet

```text
cvisual-pos/
├── index.html                  # Landing publique, connexion & onboarding stepper
├── app.html                    # Application POS (shell unique SPA, routing hash)
├── admin.html                  # Console Super-Administrateur Cvisual
├── catalogue.html              # Vitrine catalogue public en ligne
├── manifest.json               # Manifest PWA
├── service-worker.js           # Cache et offline support
├── assets/
│   ├── css/                    # Architecture CSS modulaire
│   └── js/                     # Moteur JavaScript (auth, sync, db, router, modules)
├── whatsapp-server/            # Microservice Node.js pour WhatsApp Web
└── sql/                        # Scripts SQL ordonnés avec préfixe 'cvisual_'
    ├── 01_schema.sql
    ├── 02_rls.sql
    ├── 03_storage.sql
    ├── 04_admin.sql
    ├── 05_functions.sql
    ├── 06_seed.sql
    └── 07_seed_studio_beaute.sql
```

---

## ⚙️ Déploiement & Configuration

### 1. Base de données Supabase
Exécutez dans l'ordre les scripts du dossier `sql/` dans le **SQL Editor** de votre projet Supabase :
1. `01_schema.sql` (Tables et déclencheurs)
2. `02_rls.sql` (Politiques de sécurité)
3. `03_storage.sql` (Buckets et règles de stockage)
4. `04_admin.sql` (Gestion superadmin)
5. `05_functions.sql` (Fonctions métier atomiques)
6. `06_seed.sql` ou `07_seed_studio_beaute.sql` (Données initiales)

### 2. Configuration Frontend
Renseignez votre `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans `assets/js/supabase.js`.

### 3. Microservice WhatsApp (Optionnel)
```bash
cd whatsapp-server
npm install
npm start
```

---

## 🔒 Sécurité et Isolation
Toutes les tables, index, déclencheurs et fonctions utilisent le préfixe strict `cvisual_`, garantissant une coexistence sans conflit sur un projet Supabase partagé ou préexistant.

---

*Designed by Cvisual*
