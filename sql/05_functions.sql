-- ==============================================================================
-- CVISUAL POS — 05_functions.sql
-- Fonctions Métier SQL Atomiques et Procédures Stockées préfixées 'cvisual_'
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FONCTION : Numérotation atomique des reçus par entreprise
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cvisual_generate_receipt_number(p_business_id UUID)
RETURNS TEXT AS $$
DECLARE
    prefix TEXT := 'REC-';
    current_year_month TEXT;
    seq_count INT;
    next_num TEXT;
BEGIN
    current_year_month := TO_CHAR(NOW(), 'YYYYMM');
    
    SELECT COUNT(*) + 1 INTO seq_count
    FROM cvisual_sales
    WHERE business_id = p_business_id
      AND TO_CHAR(created_at, 'YYYYMM') = current_year_month;

    next_num := prefix || current_year_month || '-' || LPAD(seq_count::TEXT, 4, '0');
    RETURN next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 2. FONCTION : Enregistrement transactionnel d'une vente (Atomique)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cvisual_process_sale(
    p_business_id UUID,
    p_staff_id UUID,
    p_customer_id UUID,
    p_cash_session_id UUID,
    p_subtotal NUMERIC,
    p_discount_amount NUMERIC,
    p_discount_percent NUMERIC,
    p_tax_amount NUMERIC,
    p_total_amount NUMERIC,
    p_currency TEXT,
    p_exchange_rate NUMERIC,
    p_payment_method TEXT,
    p_amount_received NUMERIC,
    p_change_given NUMERIC,
    p_notes TEXT,
    p_items JSONB,
    p_offline_created_at TIMESTAMPTZ DEFAULT NULL,
    p_custom_receipt_number TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_sale_id UUID;
    v_receipt_number TEXT;
    v_item JSONB;
    v_prod_id UUID;
    v_var_id UUID;
    v_qty NUMERIC;
    v_unit_price NUMERIC;
    v_unit_cost NUMERIC;
    v_item_name TEXT;
    v_item_discount NUMERIC;
    v_item_tax NUMERIC;
    v_item_total NUMERIC;
    v_curr_stock NUMERIC;
    v_new_stock NUMERIC;
    v_payment_status TEXT := 'paid';
BEGIN
    -- Numéro de reçu
    IF p_custom_receipt_number IS NOT NULL AND TRIM(p_custom_receipt_number) <> '' THEN
        v_receipt_number := p_custom_receipt_number;
    ELSE
        v_receipt_number := cvisual_generate_receipt_number(p_business_id);
    END IF;

    IF p_payment_method = 'credit' THEN
        v_payment_status := 'unpaid';
    END IF;

    -- 1. Insertion de la vente
    INSERT INTO cvisual_sales (
        business_id, receipt_number, customer_id, staff_id, cash_session_id,
        subtotal, discount_amount, discount_percent, tax_amount, total_amount,
        currency, exchange_rate, payment_status, status, notes, offline_created_at
    )
    VALUES (
        p_business_id, v_receipt_number, p_customer_id, p_staff_id, p_cash_session_id,
        p_subtotal, p_discount_amount, p_discount_percent, p_tax_amount, p_total_amount,
        COALESCE(p_currency, 'HTG'), COALESCE(p_exchange_rate, 1.00), v_payment_status, 'completed', p_notes, p_offline_created_at
    )
    RETURNING id INTO v_sale_id;

    -- 2. Insertion des lignes de vente et décompte du stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_var_id := CASE WHEN v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' <> '' 
                         THEN (v_item->>'variant_id')::UUID ELSE NULL END;
        v_qty := (v_item->>'qty')::NUMERIC;
        v_unit_price := (v_item->>'unit_price')::NUMERIC;
        v_unit_cost := COALESCE((v_item->>'unit_cost')::NUMERIC, 0.00);
        v_item_name := COALESCE(v_item->>'name', 'Article');
        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0.00);
        v_item_tax := COALESCE((v_item->>'tax')::NUMERIC, 0.00);
        v_item_total := (v_item->>'total')::NUMERIC;

        INSERT INTO cvisual_sale_items (
            sale_id, product_id, variant_id, product_name, quantity,
            unit_price, unit_cost, discount_amount, tax_amount, total_price
        )
        VALUES (
            v_sale_id, v_prod_id, v_var_id, v_item_name, v_qty,
            v_unit_price, v_unit_cost, v_item_discount, v_item_tax, v_item_total
        );

        IF v_prod_id IS NOT NULL THEN
            SELECT current_stock INTO v_curr_stock FROM cvisual_products WHERE id = v_prod_id FOR UPDATE;
            v_new_stock := COALESCE(v_curr_stock, 0) - v_qty;
            
            UPDATE cvisual_products SET current_stock = v_new_stock WHERE id = v_prod_id;

            INSERT INTO cvisual_stock_movements (
                business_id, product_id, variant_id, staff_id, type,
                quantity, previous_stock, new_stock, unit_cost, reason, reference_id
            )
            VALUES (
                p_business_id, v_prod_id, v_var_id, p_staff_id, 'sale',
                -v_qty, v_curr_stock, v_new_stock, v_unit_cost, 'Vente ' || v_receipt_number, v_sale_id::TEXT
            );
        END IF;
    END LOOP;

    -- 3. Insertion du paiement
    INSERT INTO cvisual_payments (
        sale_id, business_id, method, amount, amount_received,
        change_given, currency, exchange_rate
    )
    VALUES (
        v_sale_id, p_business_id, p_payment_method, p_total_amount, p_amount_received,
        COALESCE(p_change_given, 0.00), COALESCE(p_currency, 'HTG'), COALESCE(p_exchange_rate, 1.00)
    );

    -- 4. Si vente à crédit, mise à jour du compte client et création de la dette
    IF p_payment_method = 'credit' AND p_customer_id IS NOT NULL THEN
        INSERT INTO cvisual_customer_debts (
            customer_id, business_id, sale_id, initial_amount, remaining_amount, status
        )
        VALUES (
            p_customer_id, p_business_id, v_sale_id, p_total_amount, p_total_amount, 'pending'
        );

        UPDATE cvisual_customers
        SET current_debt = current_debt + p_total_amount
        WHERE id = p_customer_id;
    END IF;

    -- 5. Mise à jour de la session de caisse si ouverte
    IF p_cash_session_id IS NOT NULL THEN
        UPDATE cvisual_cash_sessions
        SET total_sales = total_sales + p_total_amount,
            total_cash_sales = total_cash_sales + (CASE WHEN p_payment_method = 'cash' THEN p_total_amount ELSE 0 END),
            total_card_sales = total_card_sales + (CASE WHEN p_payment_method = 'card' THEN p_total_amount ELSE 0 END),
            total_mobile_sales = total_mobile_sales + (CASE WHEN p_payment_method IN ('moncash', 'natcash') THEN p_total_amount ELSE 0 END),
            total_credit_sales = total_credit_sales + (CASE WHEN p_payment_method = 'credit' THEN p_total_amount ELSE 0 END),
            closing_cash_expected = closing_cash_expected + (CASE WHEN p_payment_method = 'cash' THEN p_total_amount ELSE 0 END)
        WHERE id = p_cash_session_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'receipt_number', v_receipt_number
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 3. FONCTION : Métriques du Dashboard en 5 secondes
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cvisual_get_dashboard_metrics(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_today_sales NUMERIC(12,2) := 0;
    v_today_count INT := 0;
    v_yesterday_sales NUMERIC(12,2) := 0;
    v_today_profit NUMERIC(12,2) := 0;
    v_low_stock_count INT := 0;
    v_total_debts NUMERIC(12,2) := 0;
    v_open_session JSONB;
BEGIN
    SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
    INTO v_today_sales, v_today_count
    FROM cvisual_sales
    WHERE business_id = p_business_id
      AND status = 'completed'
      AND created_at >= CURRENT_DATE;

    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_yesterday_sales
    FROM cvisual_sales
    WHERE business_id = p_business_id
      AND status = 'completed'
      AND created_at >= CURRENT_DATE - INTERVAL '1 day'
      AND created_at < CURRENT_DATE;

    SELECT COALESCE(SUM(si.total_price - (si.unit_cost * si.quantity)), 0)
    INTO v_today_profit
    FROM cvisual_sale_items si
    JOIN cvisual_sales s ON s.id = si.sale_id
    WHERE s.business_id = p_business_id
      AND s.status = 'completed'
      AND s.created_at >= CURRENT_DATE;

    SELECT COUNT(*)
    INTO v_low_stock_count
    FROM cvisual_products
    WHERE business_id = p_business_id
      AND is_archived = false
      AND current_stock <= min_stock_alert;

    SELECT COALESCE(SUM(remaining_amount), 0)
    INTO v_total_debts
    FROM cvisual_customer_debts
    WHERE business_id = p_business_id
      AND status IN ('pending', 'partial');

    SELECT row_to_json(cs)::JSONB
    INTO v_open_session
    FROM cvisual_cash_sessions cs
    WHERE cs.business_id = p_business_id
      AND cs.status = 'open'
    ORDER BY cs.opened_at DESC
    LIMIT 1;

    RETURN jsonb_build_object(
        'today_sales', v_today_sales,
        'today_count', v_today_count,
        'yesterday_sales', v_yesterday_sales,
        'sales_growth_percent', CASE WHEN v_yesterday_sales > 0 
                                     THEN ROUND(((v_today_sales - v_yesterday_sales) / v_yesterday_sales * 100), 1)
                                     ELSE 0 END,
        'today_profit', v_today_profit,
        'low_stock_count', v_low_stock_count,
        'total_debts', v_total_debts,
        'open_session', v_open_session
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------------------------
-- 4. FONCTION : Fermeture et réconciliation d'une session de caisse
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cvisual_close_cash_session(
    p_session_id UUID,
    p_actual_cash NUMERIC,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_expected NUMERIC;
    v_diff NUMERIC;
BEGIN
    SELECT closing_cash_expected INTO v_expected
    FROM cvisual_cash_sessions
    WHERE id = p_session_id;

    v_diff := p_actual_cash - COALESCE(v_expected, 0.00);

    UPDATE cvisual_cash_sessions
    SET status = 'closed',
        closed_at = NOW(),
        closing_cash_actual = p_actual_cash,
        cash_difference = v_diff,
        notes = COALESCE(p_notes, notes)
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'expected_cash', v_expected,
        'actual_cash', p_actual_cash,
        'cash_difference', v_diff
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
