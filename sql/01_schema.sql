-- ==============================================================================
-- CVISUAL POS — 01_schema.sql
-- Structure de données avec préfixe strict 'cvisual_' pour isolation totale
-- Compatible avec un projet Supabase existant sans conflit de tables
-- ==============================================================================

-- Extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fonction trigger pour mise à jour automatique du champ updated_at
CREATE OR REPLACE FUNCTION cvisual_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. TABLE : cvisual_admin_users (Super-administrateurs plateforme Cvisual)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'superadmin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. TABLE : cvisual_business_type_presets (Types de commerce & configurations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_business_type_presets (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    active_modules TEXT[] NOT NULL DEFAULT ARRAY['sales', 'products', 'stock', 'customers', 'cash-register', 'reports', 'settings'],
    terminology JSONB NOT NULL DEFAULT '{}'::JSONB,
    default_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. TABLE : cvisual_businesses (Entreprises / Boutiques inscrites)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'other',
    slogan TEXT,
    description TEXT,
    logo_url TEXT,
    cover_url TEXT,
    brand_color TEXT NOT NULL DEFAULT '#F97316',
    phone TEXT,
    whatsapp TEXT,
    address TEXT,
    city TEXT,
    country TEXT NOT NULL DEFAULT 'Haïti',
    tax_id TEXT,
    website TEXT,
    instagram TEXT,
    facebook TEXT,
    tiktok TEXT,
    primary_currency TEXT NOT NULL DEFAULT 'HTG',
    secondary_currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate NUMERIC(12,4) NOT NULL DEFAULT 132.50,
    default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    language TEXT NOT NULL DEFAULT 'fr',
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')) DEFAULT 'pending',
    rejection_reason TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    plan_expires_at TIMESTAMPTZ,
    receipt_settings JSONB NOT NULL DEFAULT '{
        "format": "80mm",
        "show_logo": true,
        "show_qr": true,
        "qr_type": "catalogue",
        "header_text": "",
        "footer_text": "Merci pour votre fidélité !",
        "show_socials": true,
        "show_images": false
    }'::JSONB,
    whatsapp_settings JSONB NOT NULL DEFAULT '{
        "auto_send": false,
        "template": "Bonjour {client}, voici votre reçu #{numero_recu} d''un montant de {total} chez {entreprise}. Merci de votre visite !",
        "send_format": "text"
    }'::JSONB,
    catalogue_settings JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "allow_orders": true,
        "order_whatsapp": true,
        "about_text": "",
        "faq": []
    }'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tr_cvisual_businesses_updated_at ON cvisual_businesses;
CREATE TRIGGER tr_cvisual_businesses_updated_at
BEFORE UPDATE ON cvisual_businesses
FOR EACH ROW EXECUTE FUNCTION cvisual_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cv_businesses_slug ON cvisual_businesses(slug);
CREATE INDEX IF NOT EXISTS idx_cv_businesses_owner ON cvisual_businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_cv_businesses_status ON cvisual_businesses(status);

-- ------------------------------------------------------------------------------
-- 4. TABLE : cvisual_staff (Personnel, gérants et caissiers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')) DEFAULT 'cashier',
    permissions JSONB NOT NULL DEFAULT '{
        "can_discount": false,
        "can_cancel_sale": false,
        "can_view_reports": false,
        "can_manage_stock": false,
        "can_manage_staff": false,
        "can_manage_cash": true
    }'::JSONB,
    access_code_hash TEXT,
    access_code_hint TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tr_cvisual_staff_updated_at ON cvisual_staff;
CREATE TRIGGER tr_cvisual_staff_updated_at
BEFORE UPDATE ON cvisual_staff
FOR EACH ROW EXECUTE FUNCTION cvisual_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cv_staff_business ON cvisual_staff(business_id);
CREATE INDEX IF NOT EXISTS idx_cv_staff_code_hash ON cvisual_staff(access_code_hash);

-- ------------------------------------------------------------------------------
-- 5. TABLE : cvisual_categories (Catégories de produits)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    icon TEXT DEFAULT 'tag',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, slug)
);

DROP TRIGGER IF EXISTS tr_cvisual_categories_updated_at ON cvisual_categories;
CREATE TRIGGER tr_cvisual_categories_updated_at
BEFORE UPDATE ON cvisual_categories
FOR EACH ROW EXECUTE FUNCTION cvisual_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cv_categories_business ON cvisual_categories(business_id);

-- ------------------------------------------------------------------------------
-- 6. TABLE : cvisual_products (Produits et services)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES cvisual_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    barcode TEXT,
    unit TEXT NOT NULL DEFAULT 'pièce',
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    sale_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    current_stock NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    min_stock_alert NUMERIC(12,2) NOT NULL DEFAULT 5.00,
    is_visible_in_catalogue BOOLEAN NOT NULL DEFAULT true,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    image_url TEXT,
    expiry_date DATE,
    serial_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tr_cvisual_products_updated_at ON cvisual_products;
CREATE TRIGGER tr_cvisual_products_updated_at
BEFORE UPDATE ON cvisual_products
FOR EACH ROW EXECUTE FUNCTION cvisual_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cv_products_business ON cvisual_products(business_id);
CREATE INDEX IF NOT EXISTS idx_cv_products_category ON cvisual_products(category_id);
CREATE INDEX IF NOT EXISTS idx_cv_products_barcode ON cvisual_products(business_id, barcode);
CREATE INDEX IF NOT EXISTS idx_cv_products_sku ON cvisual_products(business_id, sku);
CREATE INDEX IF NOT EXISTS idx_cv_products_active ON cvisual_products(business_id, is_archived);

-- ------------------------------------------------------------------------------
-- 7. TABLE : cvisual_product_variants (Variantes : taille, couleur, format)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES cvisual_products(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    cost_price NUMERIC(12,2),
    sale_price NUMERIC(12,2) NOT NULL,
    current_stock NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_variants_product ON cvisual_product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_cv_variants_business ON cvisual_product_variants(business_id);

-- ------------------------------------------------------------------------------
-- 8. TABLE : cvisual_product_images (Galerie de photos produits)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES cvisual_products(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_product_images_product ON cvisual_product_images(product_id);

-- ------------------------------------------------------------------------------
-- 9. TABLE : cvisual_stock_movements (Historique exhaustif des stocks)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES cvisual_products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES cvisual_product_variants(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES cvisual_staff(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'loss', 'return', 'sale', 'purchase')),
    quantity NUMERIC(12,2) NOT NULL,
    previous_stock NUMERIC(12,2),
    new_stock NUMERIC(12,2),
    unit_cost NUMERIC(12,2),
    reason TEXT,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_stock_movements_biz ON cvisual_stock_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_cv_stock_movements_prod ON cvisual_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_cv_stock_movements_created ON cvisual_stock_movements(created_at);

-- ------------------------------------------------------------------------------
-- 10. TABLE : cvisual_customers (Clients et gestion de compte)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    notes TEXT,
    credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    current_debt NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    loyalty_points INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tr_cvisual_customers_updated_at ON cvisual_customers;
CREATE TRIGGER tr_cvisual_customers_updated_at
BEFORE UPDATE ON cvisual_customers
FOR EACH ROW EXECUTE FUNCTION cvisual_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cv_customers_business ON cvisual_customers(business_id);
CREATE INDEX IF NOT EXISTS idx_cv_customers_phone ON cvisual_customers(business_id, phone);

-- ------------------------------------------------------------------------------
-- 11. TABLE : cvisual_suppliers (Fournisseurs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tr_cvisual_suppliers_updated_at ON cvisual_suppliers;
CREATE TRIGGER tr_cvisual_suppliers_updated_at
BEFORE UPDATE ON cvisual_suppliers
FOR EACH ROW EXECUTE FUNCTION cvisual_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cv_suppliers_business ON cvisual_suppliers(business_id);

-- ------------------------------------------------------------------------------
-- 12. TABLE : cvisual_purchase_orders (Bons de commande fournisseurs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES cvisual_suppliers(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled')) DEFAULT 'draft',
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    expected_delivery DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tr_cvisual_purchase_orders_updated_at ON cvisual_purchase_orders;
CREATE TRIGGER tr_cvisual_purchase_orders_updated_at
BEFORE UPDATE ON cvisual_purchase_orders
FOR EACH ROW EXECUTE FUNCTION cvisual_set_updated_at();

CREATE TABLE IF NOT EXISTS cvisual_purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES cvisual_purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES cvisual_products(id) ON DELETE CASCADE,
    quantity_ordered NUMERIC(12,2) NOT NULL,
    quantity_received NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unit_cost NUMERIC(12,2) NOT NULL,
    total_cost NUMERIC(12,2) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 13. TABLE : cvisual_cash_sessions (Sessions et journaux de caisse)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES cvisual_staff(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    closing_cash_expected NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    closing_cash_actual NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cash_difference NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_sales NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_cash_sales NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_card_sales NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_mobile_sales NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_credit_sales NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_expenses NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open'
);

CREATE INDEX IF NOT EXISTS idx_cv_cash_sessions_business ON cvisual_cash_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_cv_cash_sessions_status ON cvisual_cash_sessions(business_id, status);

-- ------------------------------------------------------------------------------
-- 14. TABLE : cvisual_sales (Ventes et tickets)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    receipt_number TEXT NOT NULL,
    customer_id UUID REFERENCES cvisual_customers(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES cvisual_staff(id) ON DELETE SET NULL,
    cash_session_id UUID REFERENCES cvisual_cash_sessions(id) ON DELETE SET NULL,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'HTG',
    exchange_rate NUMERIC(12,4) NOT NULL DEFAULT 1.00,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'partial', 'unpaid')) DEFAULT 'paid',
    status TEXT NOT NULL CHECK (status IN ('completed', 'cancelled', 'refunded')) DEFAULT 'completed',
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    offline_created_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tr_cvisual_sales_updated_at ON cvisual_sales;
CREATE TRIGGER tr_cvisual_sales_updated_at
BEFORE UPDATE ON cvisual_sales
FOR EACH ROW EXECUTE FUNCTION cvisual_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cv_sales_business ON cvisual_sales(business_id);
CREATE INDEX IF NOT EXISTS idx_cv_sales_receipt ON cvisual_sales(business_id, receipt_number);
CREATE INDEX IF NOT EXISTS idx_cv_sales_created ON cvisual_sales(business_id, created_at);

-- ------------------------------------------------------------------------------
-- 15. TABLE : cvisual_sale_items (Lignes de vente)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES cvisual_sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES cvisual_products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES cvisual_product_variants(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_sale_items_sale ON cvisual_sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_cv_sale_items_prod ON cvisual_sale_items(product_id);

-- ------------------------------------------------------------------------------
-- 16. TABLE : cvisual_payments (Modes de règlement)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES cvisual_sales(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK (method IN ('cash', 'moncash', 'natcash', 'card', 'transfer', 'credit')),
    amount NUMERIC(12,2) NOT NULL,
    amount_received NUMERIC(12,2),
    change_given NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    reference_number TEXT,
    currency TEXT NOT NULL DEFAULT 'HTG',
    exchange_rate NUMERIC(12,4) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_payments_sale ON cvisual_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_cv_payments_biz ON cvisual_payments(business_id);

-- ------------------------------------------------------------------------------
-- 17. TABLE : cvisual_customer_debts & payments (Crédits et remboursements)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_customer_debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES cvisual_customers(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES cvisual_sales(id) ON DELETE SET NULL,
    initial_amount NUMERIC(12,2) NOT NULL,
    remaining_amount NUMERIC(12,2) NOT NULL,
    due_date DATE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tr_cvisual_customer_debts_updated_at ON cvisual_customer_debts;
CREATE TRIGGER tr_cvisual_customer_debts_updated_at
BEFORE UPDATE ON cvisual_customer_debts
FOR EACH ROW EXECUTE FUNCTION cvisual_set_updated_at();

CREATE TABLE IF NOT EXISTS cvisual_customer_debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID NOT NULL REFERENCES cvisual_customer_debts(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 18. TABLE : cvisual_expenses (Dépenses d'exploitation)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES cvisual_staff(id) ON DELETE SET NULL,
    cash_session_id UUID REFERENCES cvisual_cash_sessions(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'HTG',
    description TEXT NOT NULL,
    receipt_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_expenses_business ON cvisual_expenses(business_id);

-- ------------------------------------------------------------------------------
-- 19. TABLE : cvisual_whatsapp_messages (File et historique WhatsApp)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES cvisual_sales(id) ON DELETE SET NULL,
    phone_number TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')) DEFAULT 'queued',
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_whatsapp_status ON cvisual_whatsapp_messages(business_id, status);

-- ------------------------------------------------------------------------------
-- 20. TABLE : cvisual_audit_logs (Journal d'audit et de sécurité)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES cvisual_businesses(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_audit_business ON cvisual_audit_logs(business_id);

-- ------------------------------------------------------------------------------
-- 21. TABLE : cvisual_sync_log (Historique de synchronisation hors-ligne)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cvisual_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    device_id TEXT,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operations_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success',
    details JSONB
);
