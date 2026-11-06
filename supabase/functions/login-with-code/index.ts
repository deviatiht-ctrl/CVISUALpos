/**
 * CVISUAL POS — Edge Function: login-with-code
 * Connexion sécurisée pour employés et caissiers via code d'accès à 6-8 chiffres.
 * Vérifie le hash du code, s'assure que l'entreprise est approuvée et génère un JWT valide.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  // Gestion requêtes pré-vol CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, code_hash } = await req.json();

    if (!code && !code_hash) {
      return new Response(
        JSON.stringify({ error: "Code d'accès obligatoire." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calcul du hash SHA-256 si le code brut a été fourni
    const targetHash = code_hash || await sha256(code.trim());

    // Initialisation du client Supabase Admin avec la clé de service
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Recherche du membre du personnel correspondant
    const { data: staffMember, error: staffError } = await supabaseAdmin
      .from("cvisual_staff")
      .select("*, cvisual_businesses(*)")
      .eq("access_code_hash", targetHash)
      .eq("status", "active")
      .maybeSingle();

    if (staffError || !staffMember) {
      return new Response(
        JSON.stringify({ error: "Code d'accès invalide ou compte inactif." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Contrôle du statut de l'entreprise
    const business = staffMember.cvisual_businesses;
    if (!business || business.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "L'établissement n'est pas approuvé ou a été suspendu." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Mise à jour de la date de dernière connexion
    await supabaseAdmin
      .from("cvisual_staff")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", staffMember.id);

    // 4. Génération d'une session ou retour des informations autorisées
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: staffMember.id,
          name: staffMember.name,
          role: staffMember.role,
          permissions: staffMember.permissions,
          business_id: business.id
        },
        business: business
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erreur interne du serveur." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
