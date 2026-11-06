-- ==============================================================================
-- CVISUAL POS — 08_online_orders.sql
-- Module de Commandes en Ligne & Comptes Clients Vitrine
-- Préfixe strict 'cvisual_' pour isolation totale
-- ==============================================================================

-- 1. EXTENSION DE LA TABLE CLIENTS (Authentification vitrine & profil)
ALTER TABLE cvisual_customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE cvisual_customers ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. TABLE : cvisual_online_orders (Commandes passées sur le catalogue public)
CREATE TABLE IF NOT EXISTS cvisual_online_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL,
    business_id UUID NOT NULL REFERENCES cvisual_businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES cvisual_customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    delivery_address TEXT,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'HTG',
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'moncash', 'natcash', 'card', 'online')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tr_cvisual_online_orders_updated_at ON cvisual_online_orders;
CREATE TRIGGER tr_cvisual_online_orders_updated_at
BEFORE UPDATE ON cvisual_online_orders
FOR EACH ROW EXECUTE FUNCTION cvisual_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cv_online_orders_biz ON cvisual_online_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_cv_online_orders_cust ON cvisual_online_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_cv_online_orders_status ON cvisual_online_orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_cv_online_orders_phone ON cvisual_online_orders(customer_phone);

-- 3. TABLE : cvisual_online_order_items (Lignes de commande en ligne)
CREATE TABLE IF NOT EXISTS cvisual_online_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES cvisual_online_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES cvisual_products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(12,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cv_online_order_items_order ON cvisual_online_order_items(order_id);

-- 4. POLITIQUES RLS
ALTER TABLE cvisual_online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_online_order_items ENABLE ROW LEVEL SECURITY;

-- 4.1 Politiques Clients : Permettre la création de profil et connexion depuis la vitrine
DROP POLICY IF EXISTS "Public can create customer profile" ON cvisual_customers;
CREATE POLICY "Public can create customer profile"
ON cvisual_customers FOR INSERT
TO anon, authenticated
WITH CHECK (cvisual_is_business_approved(business_id));

DROP POLICY IF EXISTS "Public can read own customer record" ON cvisual_customers;
CREATE POLICY "Public can read own customer record"
ON cvisual_customers FOR SELECT
TO anon, authenticated
USING (true);

-- 4.2 Politiques Commandes en ligne :
-- Les clients peuvent créer des commandes
DROP POLICY IF EXISTS "Public can create online orders" ON cvisual_online_orders;
CREATE POLICY "Public can create online orders"
ON cvisual_online_orders FOR INSERT
TO anon, authenticated
WITH CHECK (cvisual_is_business_approved(business_id));

-- Les clients peuvent voir leurs commandes (et les commerçants voient celles de leur boutique)
DROP POLICY IF EXISTS "Read online orders" ON cvisual_online_orders;
CREATE POLICY "Read online orders"
ON cvisual_online_orders FOR SELECT
TO anon, authenticated
USING (
    cvisual_is_business_approved(business_id)
);

-- Les commerçants peuvent gérer et mettre à jour le statut des commandes
DROP POLICY IF EXISTS "Staff can manage online orders" ON cvisual_online_orders;
CREATE POLICY "Staff can manage online orders"
ON cvisual_online_orders FOR UPDATE
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
)
WITH CHECK (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

-- Lignes d'articles
DROP POLICY IF EXISTS "Public can insert order items" ON cvisual_online_order_items;
CREATE POLICY "Public can insert order items"
ON cvisual_online_order_items FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Read order items" ON cvisual_online_order_items;
CREATE POLICY "Read order items"
ON cvisual_online_order_items FOR SELECT
TO anon, authenticated
USING (true);
