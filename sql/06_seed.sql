-- ==============================================================================
-- CVISUAL POS — 06_seed.sql
-- Données initiales et démo avec tables préfixées 'cvisual_'
-- ==============================================================================

-- 1. PRESETS DES TYPES D'ENTREPRISES
INSERT INTO cvisual_business_type_presets (id, label, description, active_modules, terminology, default_categories)
VALUES
(
    'clothing',
    'Boutique / Vêtements & Mode',
    'Gestion par tailles, couleurs, codes-barres et retours clients.',
    ARRAY['sales', 'products', 'stock', 'customers', 'cash-register', 'reports', 'settings', 'staff'],
    '{"item": "Article", "stock": "Inventaire", "customer": "Client", "catalog": "Collection"}'::JSONB,
    ARRAY['Hommes', 'Femmes', 'Enfants', 'Chaussures', 'Accessoires']
),
(
    'grocery',
    'Supermarché / Épicerie & Alimentation',
    'Scan rapide des codes-barres, unités au poids/litre, dates de péremption et alertes stock.',
    ARRAY['sales', 'products', 'stock', 'suppliers', 'cash-register', 'reports', 'settings', 'staff'],
    '{"item": "Produit", "stock": "Rayon / Réserve", "customer": "Client", "catalog": "Catalogue"}'::JSONB,
    ARRAY['Boissons', 'Épicerie', 'Frais & Surgelés', 'Hygiène & Entretien', 'Snacks & Biscuits']
),
(
    'restaurant',
    'Restaurant / Fast-food & Bar',
    'Menu par catégories, gestion de tables, à emporter, notes cuisine et tickets de préparation.',
    ARRAY['sales', 'products', 'stock', 'cash-register', 'reports', 'expenses', 'settings', 'staff'],
    '{"item": "Plat / Boisson", "stock": "Ingrédients", "customer": "Client", "catalog": "Menu Digital"}'::JSONB,
    ARRAY['Entrées', 'Plats Principaux', 'Boissons & Cocktails', 'Desserts', 'Accompagnements']
),
(
    'pharmacy',
    'Pharmacie & Santé',
    'Gestion rigoureuse des numéros de lot, dates de péremption et traçabilité.',
    ARRAY['sales', 'products', 'stock', 'suppliers', 'customers', 'cash-register', 'reports', 'settings', 'staff'],
    '{"item": "Médicament", "stock": "Officine", "customer": "Patient / Client", "catalog": "Parapharmacie"}'::JSONB,
    ARRAY['Antidouleurs & Fièvre', 'Antibiotiques', 'Vitamines & Compléments', 'Soins & Pansements', 'Hygiène Bébé']
),
(
    'salon',
    'Salon de beauté, Coiffure & Spa',
    'Catalogue de soins, prestations de services, durées et produits associés.',
    ARRAY['sales', 'products', 'customers', 'cash-register', 'reports', 'expenses', 'settings', 'staff'],
    '{"item": "Prestation / Soin", "stock": "Produits professionnels", "customer": "Clientèle", "catalog": "Carte des Soins"}'::JSONB,
    ARRAY['Coiffure Homme', 'Coiffure Femme', 'Manucure & Pédicure', 'Massages & Spas', 'Soins Visage']
),
(
    'hardware',
    'Quincaillerie & Pièces Auto',
    'Gestion des références OEM, compatibilités pièces, fournisseurs et gros volumes.',
    ARRAY['sales', 'products', 'stock', 'suppliers', 'customers', 'cash-register', 'reports', 'expenses', 'settings'],
    '{"item": "Pièce / Matériel", "stock": "Entrepôt", "customer": "Entrepreneur / Particulier", "catalog": "Catalogue Pièces"}'::JSONB,
    ARRAY['Outillage', 'Peinture & Finitions', 'Électricité', 'Plomberie', 'Visserie & Fixations']
),
(
    'electronics',
    'Électronique, Téléphonie & Informatique',
    'Numéros de série (IMEI/S/N), garanties et accessoires.',
    ARRAY['sales', 'products', 'stock', 'suppliers', 'customers', 'cash-register', 'reports', 'settings', 'staff'],
    '{"item": "Appareil / Accessoire", "stock": "Stock Magasin", "customer": "Client", "catalog": "Boutique High-Tech"}'::JSONB,
    ARRAY['Smartphones', 'Ordinateurs & Tablettes', 'Accessoires & Câbles', 'Audio & Écouteurs', 'Réparations']
),
(
    'other',
    'Commerce général / Autre commerce',
    'Configuration standard polyvalente et évolutive.',
    ARRAY['sales', 'products', 'stock', 'customers', 'suppliers', 'expenses', 'cash-register', 'reports', 'settings', 'staff'],
    '{"item": "Article", "stock": "Stock", "customer": "Client", "catalog": "Catalogue"}'::JSONB,
    ARRAY['Général', 'Divers', 'Services']
)
ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    active_modules = EXCLUDED.active_modules,
    terminology = EXCLUDED.terminology,
    default_categories = EXCLUDED.default_categories;


-- ------------------------------------------------------------------------------
-- 2. ENTREPRISE DÉMO 1 : "Boutique Élégance Caraïbes" (Mode)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_b1_id UUID := 'b1111111-1111-1111-1111-111111111111';
    v_cat_femme UUID;
    v_cat_homme UUID;
    v_cat_acc UUID;
    v_prod_robe UUID;
    v_prod_chemise UUID;
    v_cust_1 UUID;
    v_staff_1 UUID;
    v_sale_1 UUID;
BEGIN
    INSERT INTO cvisual_businesses (
        id, name, slug, type, slogan, description, brand_color,
        phone, whatsapp, address, city, country, tax_id,
        primary_currency, secondary_currency, exchange_rate, default_tax_rate,
        language, status, plan,
        receipt_settings, catalogue_settings
    )
    VALUES (
        v_b1_id,
        'Boutique Élégance Caraïbes',
        'elegance-caraibes',
        'clothing',
        'Le raffinement et le style sous les tropiques',
        'Vêtements de prêt-à-porter haut de gamme, chemises en lin, robes de créateurs et accessoires.',
        '#F97316',
        '+509 3701 2345',
        '+50937012345',
        '42, Rue Panméricaine',
        'Pétion-Ville',
        'Haïti',
        '002-349-812-7',
        'HTG',
        'USD',
        132.50,
        10.00,
        'fr',
        'approved',
        'pro',
        '{"format": "80mm", "show_logo": true, "show_qr": true, "qr_type": "catalogue", "header_text": "Bienvenue chez Élégance Caraïbes", "footer_text": "Les retours sont acceptés sous 7 jours avec ticket.", "show_socials": true, "show_images": true}'::JSONB,
        '{"enabled": true, "allow_orders": true, "order_whatsapp": true, "about_text": "Spécialiste de la mode tropicale chic depuis 2018.", "faq": []}'::JSONB
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO cvisual_categories (business_id, name, slug, icon, sort_order)
    VALUES (v_b1_id, 'Femmes', 'femmes', 'sparkles', 1)
    RETURNING id INTO v_cat_femme;

    INSERT INTO cvisual_categories (business_id, name, slug, icon, sort_order)
    VALUES (v_b1_id, 'Hommes', 'hommes', 'shirt', 2)
    RETURNING id INTO v_cat_homme;

    INSERT INTO cvisual_categories (business_id, name, slug, icon, sort_order)
    VALUES (v_b1_id, 'Accessoires', 'accessoires', 'watch', 3)
    RETURNING id INTO v_cat_acc;

    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, tax_rate, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_b1_id, v_cat_femme, 'Robe Longue en Soie Florale',
        'Magnifique robe fluide d''été avec motifs floraux caribéens.',
        'ROB-FLOR-01', '789101112131', 'pièce',
        3500.00, 6500.00, 10.00, 14, 3, true, true
    )
    RETURNING id INTO v_prod_robe;

    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, tax_rate, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_b1_id, v_cat_homme, 'Chemise Lin Blanc Premium',
        'Chemise col mao 100% lin d''Italie, respirante et légère.',
        'CHM-LIN-WHT', '789101112132', 'pièce',
        2200.00, 4200.00, 10.00, 22, 5, true, true
    )
    RETURNING id INTO v_prod_chemise;

    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, tax_rate, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_b1_id, v_cat_acc, 'Ceinture Cuir Artisanal Haïti',
        'Ceinture en cuir véritable tressé main par des artisans locaux.',
        'ACC-CEIN-01', '789101112133', 'pièce',
        800.00, 1850.00, 10.00, 18, 4, false, true
    );

    INSERT INTO cvisual_product_variants (product_id, business_id, name, sku, sale_price, current_stock)
    VALUES 
        (v_prod_robe, v_b1_id, 'Taille S - Bleu Océan', 'ROB-FLOR-S-BLU', 6500.00, 4),
        (v_prod_robe, v_b1_id, 'Taille M - Bleu Océan', 'ROB-FLOR-M-BLU', 6500.00, 6),
        (v_prod_robe, v_b1_id, 'Taille L - Corail Tropical', 'ROB-FLOR-L-COR', 6500.00, 4);

    INSERT INTO cvisual_customers (business_id, name, phone, whatsapp, email, address, city, credit_limit, loyalty_points)
    VALUES (
        v_b1_id, 'Nathalie Jean-Baptiste', '+509 3844 5566', '+50938445566',
        'nathalie.jb@gmail.com', 'Vivy Mitchell', 'Pétion-Ville', 20000.00, 120
    )
    RETURNING id INTO v_cust_1;

    INSERT INTO cvisual_staff (
        business_id, name, email, phone, role, access_code_hash, access_code_hint, status, permissions
    )
    VALUES (
        v_b1_id, 'Jean-Claude Pierre', 'jeanclaude@elegance.ht', '+509 3677 8899', 'cashier',
        'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
        '**3456', 'active',
        '{"can_discount": true, "can_cancel_sale": false, "can_view_reports": false, "can_manage_stock": false, "can_manage_staff": false, "can_manage_cash": true}'::JSONB
    )
    RETURNING id INTO v_staff_1;

    INSERT INTO cvisual_sales (
        business_id, receipt_number, customer_id, staff_id, subtotal, discount_amount,
        tax_amount, total_amount, currency, exchange_rate, payment_status, status
    )
    VALUES (
        v_b1_id, 'REC-202611-0001', v_cust_1, v_staff_1, 10700.00, 700.00,
        1000.00, 11000.00, 'HTG', 1.00, 'paid', 'completed'
    )
    RETURNING id INTO v_sale_1;

    INSERT INTO cvisual_sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, total_price)
    VALUES 
        (v_sale_1, v_prod_robe, 'Robe Longue en Soie Florale', 1, 6500.00, 3500.00, 6500.00),
        (v_sale_1, v_prod_chemise, 'Chemise Lin Blanc Premium', 1, 4200.00, 2200.00, 4200.00);

    INSERT INTO cvisual_payments (sale_id, business_id, method, amount, amount_received, change_given)
    VALUES (v_sale_1, v_b1_id, 'cash', 11000.00, 12000.00, 1000.00);

END $$;


-- ------------------------------------------------------------------------------
-- 3. ENTREPRISE DÉMO 2 : "SuperMarché & Supérette Caraïbes" (Alimentation)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_b2_id UUID := 'b2222222-2222-2222-2222-222222222222';
    v_cat_boiss UUID;
    v_cat_epic UUID;
    v_prod_eau UUID;
    v_prod_riz UUID;
    v_prod_jus UUID;
BEGIN
    INSERT INTO cvisual_businesses (
        id, name, slug, type, slogan, description, brand_color,
        phone, whatsapp, address, city, country, tax_id,
        primary_currency, secondary_currency, exchange_rate, default_tax_rate,
        language, status, plan,
        receipt_settings, catalogue_settings
    )
    VALUES (
        v_b2_id,
        'SuperMarché & Supérette Caraïbes',
        'supermarche-caraibes',
        'grocery',
        'La fraîcheur au meilleur prix au quotidien',
        'Votre supermarché de proximité avec tous les produits frais, conserves, boissons et entretien.',
        '#059669',
        '+509 2940 8888',
        '+50929408888',
        '15, Boulevard du 15 Octobre',
        'Tabarre',
        'Haïti',
        '004-981-223-1',
        'HTG',
        'USD',
        132.50,
        0.00,
        'fr',
        'approved',
        'enterprise',
        '{"format": "80mm", "show_logo": true, "show_qr": true, "qr_type": "catalogue", "header_text": "Merci pour vos courses !", "footer_text": "Reçu fiscal légal - Conservez votre ticket.", "show_socials": true, "show_images": false}'::JSONB,
        '{"enabled": true, "allow_orders": true, "order_whatsapp": true, "about_text": "Votre supermarché de confiance à Tabarre.", "faq": []}'::JSONB
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO cvisual_categories (business_id, name, slug, icon, sort_order)
    VALUES (v_b2_id, 'Boissons & Jus', 'boissons', 'cup-soda', 1)
    RETURNING id INTO v_cat_boiss;

    INSERT INTO cvisual_categories (business_id, name, slug, icon, sort_order)
    VALUES (v_b2_id, 'Épicerie & Féculents', 'epicerie', 'shopping-basket', 2)
    RETURNING id INTO v_cat_epic;

    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, tax_rate, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_b2_id, v_cat_boiss, 'Pack Eau Minérale Culligan 500ml (x24)',
        'Pack de 24 bouteilles d''eau purifiée Culligan.',
        'EAU-CUL-500', '012345678901', 'pack',
        950.00, 1350.00, 0.00, 48, 10, true, true
    )
    RETURNING id INTO v_prod_eau;

    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, tax_rate, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_b2_id, v_cat_epic, 'Riz Parfumé Mega 25 lbs',
        'Sac de 25 livres de riz blanc parfumé de première qualité.',
        'RIZ-MEGA-25', '012345678902', 'sac',
        2800.00, 3450.00, 0.00, 35, 8, true, true
    )
    RETURNING id INTO v_prod_riz;

    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, tax_rate, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_b2_id, v_cat_boiss, 'Jus Tampico Citrus Punch 1 Gallon',
        'Boisson aux agrumes rafraîchissante format 1 gallon (3.78L).',
        'JUS-TAM-1GL', '012345678903', 'bouteille',
        420.00, 650.00, 0.00, 3, 5, false, true
    )
    RETURNING id INTO v_prod_jus;

END $$;
