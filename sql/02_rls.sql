-- ==============================================================================
-- CVISUAL POS — 02_rls.sql
-- Politiques de sécurité RLS avec préfixe strict 'cvisual_'
-- ==============================================================================

-- Activation de RLS sur toutes les tables Cvisual
ALTER TABLE cvisual_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_business_type_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_customer_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_customer_debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cvisual_sync_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- FONCTIONS D'AIDE POUR L'ISOLATION ET LES RÔLES (PRÉFIXÉES cvisual_)
-- ------------------------------------------------------------------------------

-- Vérifie si l'utilisateur courant est un super-administrateur Cvisual
CREATE OR REPLACE FUNCTION cvisual_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM cvisual_admin_users
        WHERE email = auth.jwt() ->> 'email'
           OR id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Récupère l'ID de l'entreprise associée à l'utilisateur courant
CREATE OR REPLACE FUNCTION cvisual_current_business_id()
RETURNS UUID AS $$
DECLARE
    bid UUID;
BEGIN
    SELECT id INTO bid FROM cvisual_businesses WHERE owner_id = auth.uid() LIMIT 1;
    IF bid IS NOT NULL THEN
        RETURN bid;
    END IF;

    SELECT business_id INTO bid FROM cvisual_staff WHERE auth_user_id = auth.uid() AND status = 'active' LIMIT 1;
    RETURN bid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Vérifie si une entreprise donnée est approuvée
CREATE OR REPLACE FUNCTION cvisual_is_business_approved(b_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM cvisual_businesses WHERE id = b_id AND status = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_admin_users
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage admin_users" ON cvisual_admin_users;
CREATE POLICY "Admins can manage admin_users"
ON cvisual_admin_users FOR ALL
TO authenticated
USING (cvisual_is_admin());

DROP POLICY IF EXISTS "Users can check if they are admin" ON cvisual_admin_users;
CREATE POLICY "Users can check if they are admin"
ON cvisual_admin_users FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_business_type_presets
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Presets are readable by all" ON cvisual_business_type_presets;
CREATE POLICY "Presets are readable by all"
ON cvisual_business_type_presets FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can manage presets" ON cvisual_business_type_presets;
CREATE POLICY "Admins can manage presets"
ON cvisual_business_type_presets FOR ALL
TO authenticated
USING (cvisual_is_admin());

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_businesses
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can register a business" ON cvisual_businesses;
CREATE POLICY "Users can register a business"
ON cvisual_businesses FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Members can view their business" ON cvisual_businesses;
CREATE POLICY "Members can view their business"
ON cvisual_businesses FOR SELECT
TO authenticated
USING (
    id = cvisual_current_business_id()
    OR owner_id = auth.uid()
    OR cvisual_is_admin()
);

DROP POLICY IF EXISTS "Owners can update their business" ON cvisual_businesses;
CREATE POLICY "Owners can update their business"
ON cvisual_businesses FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR cvisual_is_admin())
WITH CHECK (owner_id = auth.uid() OR cvisual_is_admin());

DROP POLICY IF EXISTS "Public catalogue view for businesses" ON cvisual_businesses;
CREATE POLICY "Public catalogue view for businesses"
ON cvisual_businesses FOR SELECT
TO anon, authenticated
USING (
    status = 'approved'
    AND (catalogue_settings->>'enabled')::BOOLEAN = true
);

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_staff
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff view own business" ON cvisual_staff;
CREATE POLICY "Staff view own business"
ON cvisual_staff FOR SELECT
TO authenticated
USING (business_id = cvisual_current_business_id() OR cvisual_is_admin());

DROP POLICY IF EXISTS "Manage staff for approved business" ON cvisual_staff;
CREATE POLICY "Manage staff for approved business"
ON cvisual_staff FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
)
WITH CHECK (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_categories
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members view categories" ON cvisual_categories;
CREATE POLICY "Members view categories"
ON cvisual_categories FOR SELECT
TO authenticated
USING (business_id = cvisual_current_business_id() OR cvisual_is_admin());

DROP POLICY IF EXISTS "Members manage categories" ON cvisual_categories;
CREATE POLICY "Members manage categories"
ON cvisual_categories FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
)
WITH CHECK (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

DROP POLICY IF EXISTS "Public catalogue categories" ON cvisual_categories;
CREATE POLICY "Public catalogue categories"
ON cvisual_categories FOR SELECT
TO anon, authenticated
USING (
    is_active = true
    AND cvisual_is_business_approved(business_id)
);

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_products & variantes & images
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members manage products" ON cvisual_products;
CREATE POLICY "Members manage products"
ON cvisual_products FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
)
WITH CHECK (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

DROP POLICY IF EXISTS "Public catalogue products" ON cvisual_products;
CREATE POLICY "Public catalogue products"
ON cvisual_products FOR SELECT
TO anon, authenticated
USING (
    is_archived = false
    AND is_visible_in_catalogue = true
    AND cvisual_is_business_approved(business_id)
);

DROP POLICY IF EXISTS "Members manage variants" ON cvisual_product_variants;
CREATE POLICY "Members manage variants"
ON cvisual_product_variants FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

DROP POLICY IF EXISTS "Public catalogue variants" ON cvisual_product_variants;
CREATE POLICY "Public catalogue variants"
ON cvisual_product_variants FOR SELECT
TO anon, authenticated
USING (cvisual_is_business_approved(business_id));

DROP POLICY IF EXISTS "Members manage product images" ON cvisual_product_images;
CREATE POLICY "Members manage product images"
ON cvisual_product_images FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

DROP POLICY IF EXISTS "Public catalogue images" ON cvisual_product_images;
CREATE POLICY "Public catalogue images"
ON cvisual_product_images FOR SELECT
TO anon, authenticated
USING (cvisual_is_business_approved(business_id));

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_stock_movements
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members view and create stock movements" ON cvisual_stock_movements;
CREATE POLICY "Members view and create stock movements"
ON cvisual_stock_movements FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_customers & customer_debts
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members manage customers" ON cvisual_customers;
CREATE POLICY "Members manage customers"
ON cvisual_customers FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

DROP POLICY IF EXISTS "Members manage debts" ON cvisual_customer_debts;
CREATE POLICY "Members manage debts"
ON cvisual_customer_debts FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

DROP POLICY IF EXISTS "Members manage debt payments" ON cvisual_customer_debt_payments;
CREATE POLICY "Members manage debt payments"
ON cvisual_customer_debt_payments FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_suppliers & purchase_orders
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members manage suppliers" ON cvisual_suppliers;
CREATE POLICY "Members manage suppliers"
ON cvisual_suppliers FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

DROP POLICY IF EXISTS "Members manage purchase orders" ON cvisual_purchase_orders;
CREATE POLICY "Members manage purchase orders"
ON cvisual_purchase_orders FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

DROP POLICY IF EXISTS "Members manage purchase items" ON cvisual_purchase_order_items;
CREATE POLICY "Members manage purchase items"
ON cvisual_purchase_order_items FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM cvisual_purchase_orders po
        WHERE po.id = cvisual_purchase_order_items.purchase_order_id
        AND po.business_id = cvisual_current_business_id()
    )
    OR cvisual_is_admin()
);

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_cash_sessions
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members manage cash sessions" ON cvisual_cash_sessions;
CREATE POLICY "Members manage cash sessions"
ON cvisual_cash_sessions FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_sales, sale_items, payments
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members manage sales" ON cvisual_sales;
CREATE POLICY "Members manage sales"
ON cvisual_sales FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

DROP POLICY IF EXISTS "Members manage sale items" ON cvisual_sale_items;
CREATE POLICY "Members manage sale items"
ON cvisual_sale_items FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM cvisual_sales s
        WHERE s.id = cvisual_sale_items.sale_id
        AND s.business_id = cvisual_current_business_id()
    )
    OR cvisual_is_admin()
);

DROP POLICY IF EXISTS "Members manage payments" ON cvisual_payments;
CREATE POLICY "Members manage payments"
ON cvisual_payments FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_expenses
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members manage expenses" ON cvisual_expenses;
CREATE POLICY "Members manage expenses"
ON cvisual_expenses FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_whatsapp_messages
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members manage whatsapp messages" ON cvisual_whatsapp_messages;
CREATE POLICY "Members manage whatsapp messages"
ON cvisual_whatsapp_messages FOR ALL
TO authenticated
USING (
    (business_id = cvisual_current_business_id() AND cvisual_is_business_approved(business_id))
    OR cvisual_is_admin()
);

-- ------------------------------------------------------------------------------
-- POLITIQUES : cvisual_audit_logs & sync_log
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Audit logs insertable by members, viewable by owner and admin" ON cvisual_audit_logs;
CREATE POLICY "Audit logs insertable by members, viewable by owner and admin"
ON cvisual_audit_logs FOR ALL
TO authenticated
USING (business_id = cvisual_current_business_id() OR cvisual_is_admin());

DROP POLICY IF EXISTS "Sync logs manage" ON cvisual_sync_log;
CREATE POLICY "Sync logs manage"
ON cvisual_sync_log FOR ALL
TO authenticated
USING (business_id = cvisual_current_business_id() OR cvisual_is_admin());
