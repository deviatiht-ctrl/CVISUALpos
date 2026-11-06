-- ==============================================================================
-- CVISUAL POS — 04_admin.sql
-- Configuration initiale du Super-Administrateur Cvisual (Table cvisual_admin_users)
-- ==============================================================================
--
-- >>>> ATTENTION : REMPLACER L'EMAIL CI-DESSOUS PAR VOTRE VRAI EMAIL ADMIN <<<<
-- >>>> AVANT D'EXÉCUTER CE SCRIPT DANS L'ÉDITEUR SQL SUPABASE               <<<<
--
-- ==============================================================================

-- 1. Insertion de l'administrateur principal dans la table cvisual_admin_users
INSERT INTO cvisual_admin_users (email, full_name, role)
VALUES (
    'admin@cvisual.com', -- <<=== MODIFIER CET EMAIL AVEC VOTRE COMPTE AUTH SUPABASE
    'Directeur Cvisual',
    'superadmin'
)
ON CONFLICT (email) DO UPDATE SET
    role = 'superadmin',
    full_name = EXCLUDED.full_name;

-- 2. Procédure pour promouvoir un utilisateur en administrateur Cvisual
CREATE OR REPLACE FUNCTION cvisual_promote_to_admin(target_email TEXT, target_name TEXT DEFAULT 'Admin')
RETURNS TEXT AS $$
BEGIN
    INSERT INTO cvisual_admin_users (email, full_name, role)
    VALUES (LOWER(TRIM(target_email)), target_name, 'superadmin')
    ON CONFLICT (email) DO UPDATE SET role = 'superadmin';
    
    RETURN 'Utilisateur ' || target_email || ' promu avec succès au rang de Super-Administrateur Cvisual.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Procédure pour rétrograder ou retirer un administrateur Cvisual
CREATE OR REPLACE FUNCTION cvisual_demote_admin(target_email TEXT)
RETURNS TEXT AS $$
BEGIN
    DELETE FROM cvisual_admin_users WHERE email = LOWER(TRIM(target_email));
    RETURN 'Accès administrateur Cvisual révoqué pour ' || target_email || '.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
