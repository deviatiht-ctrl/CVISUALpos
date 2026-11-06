-- ==============================================================================
-- CVISUAL POS — 07_seed_studio_beaute.sql (Version Corrigée)
-- Configuration complète d'une entreprise "Studio de Beauté & Spa"
-- Liée au compte : laurorejeanclarens9@gmail.com
-- ==============================================================================

DO $$
DECLARE
    v_target_email TEXT := 'laurorejeanclarens9@gmail.com';
    v_user_id UUID;
    v_biz_id UUID := 'c1111111-2222-3333-4444-555555555555';
    
    -- Catégories
    v_cat_coiffure UUID;
    v_cat_onglerie UUID;
    v_cat_visage UUID;
    v_cat_massages UUID;
    v_cat_produits UUID;

    -- Produits & Prestations
    v_prod_tissage UUID;
    v_prod_braids UUID;
    v_prod_pose_ongles UUID;
    v_prod_pedicure UUID;
    v_prod_soin_visage UUID;
    v_prod_massage UUID;
    v_prod_huile_ricin UUID;
    v_prod_shampoing UUID;

    -- Staff & Clients & Caisse
    v_staff_owner UUID;
    v_staff_coiffeuse UUID;
    v_staff_estheticienne UUID;
    v_cust_1 UUID;
    v_cust_2 UUID;
    v_cust_3 UUID;
    v_session_id UUID;
    v_supplier_id UUID;
    v_sale_1 UUID;
    v_sale_2 UUID;
BEGIN

    -- 1. VÉRIFICATION OU CRÉATION DE L'UTILISATEUR DANS auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_target_email LIMIT 1;

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            role,
            aud
        )
        VALUES (
            v_user_id,
            '00000000-0000-0000-0000-000000000000',
            v_target_email,
            crypt('Clarens2026!', gen_salt('bf')), -- Modpas pa defo si kont lan potko kreye
            NOW(),
            '{"provider": "email", "providers": ["email"]}'::JSONB,
            '{"full_name": "Jean Clarens Laurore"}'::JSONB,
            NOW(),
            NOW(),
            'authenticated',
            'authenticated'
        );
        RAISE NOTICE 'Kont auth.users kreye avèk modpas : Clarens2026!';
    ELSE
        RAISE NOTICE 'Kont auth.users te deja egziste avèk ID : %', v_user_id;
    END IF;

    -- 2. AJOUT EN SUPER-ADMINISTRATEUR CVISUAL (Accès total garanti)
    INSERT INTO cvisual_admin_users (email, full_name, role)
    VALUES (v_target_email, 'Jean Clarens Laurore', 'superadmin')
    ON CONFLICT (email) DO UPDATE SET role = 'superadmin', full_name = EXCLUDED.full_name;

    -- 3. CRÉATION DE L'ENTREPRISE : CLARENS BEAUTY STUDIO & SPA
    INSERT INTO cvisual_businesses (
        id,
        owner_id,
        name,
        slug,
        type,
        slogan,
        description,
        brand_color,
        phone,
        whatsapp,
        address,
        city,
        country,
        tax_id,
        website,
        instagram,
        facebook,
        tiktok,
        primary_currency,
        secondary_currency,
        exchange_rate,
        default_tax_rate,
        language,
        status,
        plan,
        receipt_settings,
        whatsapp_settings,
        catalogue_settings
    )
    VALUES (
        v_biz_id,
        v_user_id,
        'Clarens Beauty Studio & Spa',
        'clarens-beauty-studio',
        'salon',
        'L''excellence et l''art de sublimer votre beauté',
        'Studio de beauté haut de gamme à Pétion-Ville : soins capillaires, tresses & tissages, onglerie acrylique & gel, soins esthétiques du visage, épilation et massages spa relaxants.',
        '#F97316',
        '+509 3744 8899',
        '+50937448899',
        '18, Rue Grégoire (Face Place Boyer)',
        'Pétion-Ville',
        'Haïti',
        '003-882-910-4',
        'https://cvisualpos.com/catalogue.html?e=clarens-beauty-studio',
        'clarens.beautystudio',
        'ClarensBeautyStudio',
        'clarensbeauty',
        'HTG',
        'USD',
        132.50,
        0.00,
        'fr',
        'approved', -- Déjà approuvé pour accès direct !
        'pro',
        '{
            "format": "80mm",
            "show_logo": true,
            "show_qr": true,
            "qr_type": "catalogue",
            "header_text": "Bienvenue au Clarens Beauty Studio",
            "footer_text": "Merci pour votre confiance. Prenez soin de votre beauté !",
            "show_socials": true,
            "show_images": true
        }'::JSONB,
        '{
            "auto_send": true,
            "template": "Chère cliente {client}, merci pour votre visite chez {entreprise} ! Voici votre reçu #{numero_recu} d''un montant de {total}. À très bientôt pour votre prochain soin.",
            "send_format": "text"
        }'::JSONB,
        '{
            "enabled": true,
            "allow_orders": true,
            "order_whatsapp": true,
            "about_text": "Fondé par Jean Clarens Laurore, notre salon réunit les meilleures stylistes et esthéticiennes pour vous offrir une expérience bien-être inoubliable.",
            "faq": [
                {"q": "Faut-il obligatoirement réserver ?", "r": "Les réservations sont prioritaires mais nous accueillons aussi sans rendez-vous selon disponibilité."},
                {"q": "Quels modes de paiement acceptez-vous ?", "r": "Espèces (HTG et USD), MonCash, NatCash et Carte bancaire."}
            ]
        }'::JSONB
    )
    ON CONFLICT (id) DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        status = 'approved',
        name = EXCLUDED.name,
        slug = EXCLUDED.slug;

    -- Nettoyage propre des données associées si ré-exécution
    DELETE FROM cvisual_customer_debts WHERE business_id = v_biz_id;
    DELETE FROM cvisual_payments WHERE business_id = v_biz_id;
    DELETE FROM cvisual_sale_items WHERE sale_id IN (SELECT id FROM cvisual_sales WHERE business_id = v_biz_id);
    DELETE FROM cvisual_sales WHERE business_id = v_biz_id;
    DELETE FROM cvisual_product_variants WHERE business_id = v_biz_id;
    DELETE FROM cvisual_products WHERE business_id = v_biz_id;
    DELETE FROM cvisual_categories WHERE business_id = v_biz_id;
    DELETE FROM cvisual_staff WHERE business_id = v_biz_id;
    DELETE FROM cvisual_customers WHERE business_id = v_biz_id;
    DELETE FROM cvisual_suppliers WHERE business_id = v_biz_id;
    DELETE FROM cvisual_expenses WHERE business_id = v_biz_id;
    DELETE FROM cvisual_cash_sessions WHERE business_id = v_biz_id;

    -- 4. CATÉGORIES DU SALON
    INSERT INTO cvisual_categories (business_id, name, slug, icon, sort_order)
    VALUES (v_biz_id, 'Coiffure & Tissage', 'coiffure-tissage', 'scissors', 1)
    RETURNING id INTO v_cat_coiffure;

    INSERT INTO cvisual_categories (business_id, name, slug, icon, sort_order)
    VALUES (v_biz_id, 'Onglerie & Manucure', 'onglerie-manucure', 'sparkles', 2)
    RETURNING id INTO v_cat_onglerie;

    INSERT INTO cvisual_categories (business_id, name, slug, icon, sort_order)
    VALUES (v_biz_id, 'Soins du Visage & Esthétique', 'soins-visage', 'smile', 3)
    RETURNING id INTO v_cat_visage;

    INSERT INTO cvisual_categories (business_id, name, slug, icon, sort_order)
    VALUES (v_biz_id, 'Massages & Relaxation', 'massages-spa', 'heart', 4)
    RETURNING id INTO v_cat_massages;

    INSERT INTO cvisual_categories (business_id, name, slug, icon, sort_order)
    VALUES (v_biz_id, 'Produits & Cosmétiques Vente', 'produits-vente', 'package', 5)
    RETURNING id INTO v_cat_produits;

    -- 5. PRODUITS ET PRESTATIONS
    -- 5.1 Coiffure
    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_biz_id, v_cat_coiffure, 'Pose Tissage Complet avec Finition HD',
        'Pose de mèches soignée avec fermeture dentelle HD et brushing inclus.',
        'SRV-TISS-01', '509001001', 'prestation',
        500.00, 3500.00, 999, 10, true, true
    )
    RETURNING id INTO v_prod_tissage;

    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_biz_id, v_cat_coiffure, 'Knotless Braids (Tresses Sans Nœuds)',
        'Tresses protectrices modernes longues, légères et sans tension du cuir chevelu.',
        'SRV-KNOT-02', '509001002', 'prestation',
        600.00, 4500.00, 999, 10, true, true
    )
    RETURNING id INTO v_prod_braids;

    -- 5.2 Onglerie
    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_biz_id, v_cat_onglerie, 'Pose Complète Acrylique & Gel UV Nail Art',
        'Rallongement tips acrylique avec capsules, vernis gel longue tenue et design.',
        'SRV-ONGL-01', '509001003', 'prestation',
        400.00, 2500.00, 999, 10, true, true
    )
    RETURNING id INTO v_prod_pose_ongles;

    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_biz_id, v_cat_onglerie, 'Pédicure Spa Complète avec Gommage',
        'Bain de pieds relaxant, élimination des callosités, gommage sel marin et vernis.',
        'SRV-PEDI-02', '509001004', 'prestation',
        300.00, 1800.00, 999, 10, true, true
    )
    RETURNING id INTO v_prod_pedicure;

    -- 5.3 Soins Visage
    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_biz_id, v_cat_visage, 'Soin du Visage Éclat & Nettoyage Profond',
        'Extraction comédons, vapeur d''ozone, masque à l''argile purifiant et sérum hydratant.',
        'SRV-VISG-01', '509001005', 'prestation',
        600.00, 3200.00, 999, 10, true, true
    )
    RETURNING id INTO v_prod_soin_visage;

    -- 5.4 Massage
    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_biz_id, v_cat_massages, 'Massage Relaxant aux Huiles Essentielles (60 min)',
        'Massage corps entier relaxant avec synergie d''huiles d''ylang-ylang et lavande.',
        'SRV-MASS-01', '509001006', 'séance',
        400.00, 3800.00, 999, 10, true, true
    )
    RETURNING id INTO v_prod_massage;

    -- 5.5 Produits vente comptoir
    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_biz_id, v_cat_produits, 'Huile de Ricin Noire Pure d''Haïti (Maskriti 250ml)',
        'Huile de maskriti 100% artisanale pour stimuler la pousse des cheveux et cils.',
        'PRD-MASK-250', '509123456781', 'flacon',
        450.00, 950.00, 45, 8, true, true
    )
    RETURNING id INTO v_prod_huile_ricin;

    INSERT INTO cvisual_products (
        business_id, category_id, name, description, sku, barcode, unit,
        cost_price, sale_price, current_stock, min_stock_alert, is_favorite, is_visible_in_catalogue
    )
    VALUES (
        v_biz_id, v_cat_produits, 'Kit Shampoing & Masque Kératine Pro 500ml',
        'Soin réparateur intensif sans sulfate pour cheveux défrisés ou colorés.',
        'PRD-KERAT-KIT', '509123456782', 'kit',
        1200.00, 2400.00, 24, 5, true, true
    )
    RETURNING id INTO v_prod_shampoing;

    -- Variantes
    INSERT INTO cvisual_product_variants (product_id, business_id, name, sku, sale_price, current_stock)
    VALUES 
        (v_prod_huile_ricin, v_biz_id, 'Flacon 250ml', 'MASK-250ML', 950.00, 25),
        (v_prod_huile_ricin, v_biz_id, 'Flacon Éco 500ml', 'MASK-500ML', 1650.00, 20);

    -- 6. PERSONNEL & CODES D'ACCÈS
    -- 6.1 Propriétaire
    INSERT INTO cvisual_staff (
        business_id, auth_user_id, name, email, phone, role,
        access_code_hash, access_code_hint, status, permissions
    )
    VALUES (
        v_biz_id, v_user_id, 'Jean Clarens Laurore', v_target_email, '+509 3744 8899', 'owner',
        'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', -- Code 123456
        '**3456', 'active',
        '{"can_discount": true, "can_cancel_sale": true, "can_view_reports": true, "can_manage_stock": true, "can_manage_staff": true, "can_manage_cash": true}'::JSONB
    )
    RETURNING id INTO v_staff_owner;

    -- 6.2 Caissière / Coiffeuse Principale
    INSERT INTO cvisual_staff (
        business_id, name, email, phone, role,
        access_code_hash, access_code_hint, status, permissions
    )
    VALUES (
        v_biz_id, 'Vanessa Saint-Louis', 'vanessa@clarensbeauty.ht', '+509 3611 2233', 'cashier',
        'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', -- Code 123456
        '**3456', 'active',
        '{"can_discount": true, "can_cancel_sale": false, "can_view_reports": false, "can_manage_stock": false, "can_manage_staff": false, "can_manage_cash": true}'::JSONB
    )
    RETURNING id INTO v_staff_coiffeuse;

    -- 6.3 Esthéticienne Spa
    INSERT INTO cvisual_staff (
        business_id, name, email, phone, role,
        access_code_hash, access_code_hint, status, permissions
    )
    VALUES (
        v_biz_id, 'Nadège Durosier', 'nadege@clarensbeauty.ht', '+509 3899 7766', 'cashier',
        'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', -- Code 123456
        '**3456', 'active',
        '{"can_discount": false, "can_cancel_sale": false, "can_view_reports": false, "can_manage_stock": false, "can_manage_staff": false, "can_manage_cash": true}'::JSONB
    )
    RETURNING id INTO v_staff_estheticienne;

    -- 7. FICHIER CLIENTS (Inserts séparés pour garantir 1 seule ligne par variable)
    INSERT INTO cvisual_customers (business_id, name, phone, whatsapp, email, address, city, credit_limit, current_debt, loyalty_points)
    VALUES (v_biz_id, 'Mireille Desrosiers', '+509 3788 1122', '+50937881122', 'mireille.d@yahoo.com', 'Morne Calvaire', 'Pétion-Ville', 15000.00, 0.00, 180)
    RETURNING id INTO v_cust_1;

    INSERT INTO cvisual_customers (business_id, name, phone, whatsapp, email, address, city, credit_limit, current_debt, loyalty_points)
    VALUES (v_biz_id, 'Stéphanie Paul', '+509 3455 6677', '+50934556677', 'stephanie.p@gmail.com', 'Laboule 12', 'Pétion-Ville', 25000.00, 3500.00, 320)
    RETURNING id INTO v_cust_2;

    INSERT INTO cvisual_customers (business_id, name, phone, whatsapp, email, address, city, credit_limit, current_debt, loyalty_points)
    VALUES (v_biz_id, 'Dr. Joanne Moïse', '+509 3699 0011', '+50936990011', 'dr.jmoise@outlook.com', 'Peguy-Ville', 'Pétion-Ville', 20000.00, 0.00, 450)
    RETURNING id INTO v_cust_3;

    -- 8. FOURNISSEUR
    INSERT INTO cvisual_suppliers (business_id, name, contact_name, phone, email, address, notes)
    VALUES (
        v_biz_id,
        'Caraïbes Beauté & Cosmétiques Pro',
        'Marc-Arthur Sylvain',
        '+509 2941 5555',
        'commande@caraibesbeaute.ht',
        'Route de Delmas 33',
        'Fournisseur officiel des mèches HD, gels acryliques OPI et shampoings sans sulfate.'
    )
    RETURNING id INTO v_supplier_id;

    -- 9. DÉPENSES DU SALON
    INSERT INTO cvisual_expenses (business_id, staff_id, category, amount, currency, description)
    VALUES 
        (v_biz_id, v_staff_owner, 'Énergie & Carburant', 7500.00, 'HTG', 'Achat Diesel 15 Gallons pour génératrice studio'),
        (v_biz_id, v_staff_owner, 'Fournitures & Emballages', 2200.00, 'HTG', 'Serviettes jetables, gants latex et désinfectant');

    -- 10. SESSION DE CAISSE ACTIVE
    INSERT INTO cvisual_cash_sessions (
        business_id, staff_id, opened_at, opening_cash,
        closing_cash_expected, total_sales, total_cash_sales, total_mobile_sales,
        status, notes
    )
    VALUES (
        v_biz_id, v_staff_owner, NOW() - INTERVAL '3 hours', 5000.00,
        15500.00, 10500.00, 7000.00, 3500.00,
        'open', 'Session du jour ouverte avec 5000 HTG de monnaie de départ.'
    )
    RETURNING id INTO v_session_id;

    -- 11. VENTES ENREGISTRÉES
    -- Vente 1 : Espèces
    INSERT INTO cvisual_sales (
        business_id, receipt_number, customer_id, staff_id, cash_session_id,
        subtotal, discount_amount, total_amount, currency, exchange_rate, payment_status, status
    )
    VALUES (
        v_biz_id, 'REC-202611-0001', v_cust_1, v_staff_coiffeuse, v_session_id,
        7000.00, 0.00, 7000.00, 'HTG', 1.00, 'paid', 'completed'
    )
    RETURNING id INTO v_sale_1;

    INSERT INTO cvisual_sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, total_price)
    VALUES 
        (v_sale_1, v_prod_tissage, 'Pose Tissage Complet avec Finition HD', 1, 3500.00, 500.00, 3500.00),
        (v_sale_1, v_prod_pose_ongles, 'Pose Complète Acrylique & Gel UV Nail Art', 1, 2500.00, 400.00, 2500.00),
        (v_sale_1, v_prod_huile_ricin, 'Huile de Ricin Noire Pure d''Haïti (Maskriti 250ml)', 1, 1000.00, 450.00, 1000.00);

    INSERT INTO cvisual_payments (sale_id, business_id, method, amount, amount_received, change_given)
    VALUES (v_sale_1, v_biz_id, 'cash', 7000.00, 7500.00, 500.00);

    -- Vente 2 : MonCash
    INSERT INTO cvisual_sales (
        business_id, receipt_number, customer_id, staff_id, cash_session_id,
        subtotal, discount_amount, total_amount, currency, exchange_rate, payment_status, status
    )
    VALUES (
        v_biz_id, 'REC-202611-0002', v_cust_3, v_staff_estheticienne, v_session_id,
        3500.00, 0.00, 3500.00, 'HTG', 1.00, 'paid', 'completed'
    )
    RETURNING id INTO v_sale_2;

    INSERT INTO cvisual_sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, total_price)
    VALUES (v_sale_2, v_prod_soin_visage, 'Soin du Visage Éclat & Nettoyage Profond', 1, 3500.00, 600.00, 3500.00);

    INSERT INTO cvisual_payments (sale_id, business_id, method, amount, reference_number)
    VALUES (v_sale_2, v_biz_id, 'moncash', 3500.00, 'MC-8921479');

    -- Dette client
    INSERT INTO cvisual_customer_debts (
        customer_id, business_id, initial_amount, remaining_amount, due_date, status
    )
    VALUES (
        v_cust_2, v_biz_id, 3500.00, 3500.00, CURRENT_DATE + INTERVAL '14 days', 'pending'
    );

    RAISE NOTICE 'Tout bagay enstale nèt ak siksè pou Clarens Beauty Studio & Spa !';

END $$;
