import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function normalizeTanzanianPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("255") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+255${digits.slice(1)}`;
  if (digits.length === 9) return `+255${digits}`;
  if (value.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ error: "Server configuration is incomplete" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Taarifa za kuingia si sahihi." }, 400); }

  const identifier = String(body.identifier ?? "").trim();
  const password = String(body.password ?? "");
  if (!identifier || !password) return json({ error: "Weka username/barua pepe au namba ya simu na nenosiri." }, 400);

  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const digits = identifier.replace(/\D/g, "");
  const looksLikePhone = !identifier.includes("@") && /^[+\d\s()-]+$/.test(identifier) && digits.length >= 9;

  let data;
  let error;

  if (looksLikePhone) {
    const phone = normalizeTanzanianPhone(identifier);
    if (!phone) return json({ error: "Namba ya simu si sahihi." }, 400);

    // Resolve the phone number only against an active staff account.
    // Phone Auth/SMS is not used: the Auth user's verified internal email
    // is used to validate the password through the already-enabled Email provider.
    const { data: staff, error: staffError } = await admin
      .from("school_staff_accounts")
      .select("user_id")
      .eq("phone", phone)
      .eq("is_active", true)
      .maybeSingle();

    if (staffError || !staff) {
      return json({ error: "Namba ya simu au nenosiri si sahihi." }, 401);
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(staff.user_id);
    if (userError || !userData.user) {
      return json({ error: "Namba ya simu au nenosiri si sahihi." }, 401);
    }

    let authEmail = userData.user.email?.trim().toLowerCase() || "";
    if (!authEmail) {
      // Backward compatibility for staff Auth users originally created with phone only.
      authEmail = `staff-${userData.user.id}@staff-login.invalid`;
      const { error: updateError } = await admin.auth.admin.updateUserById(userData.user.id, {
        email: authEmail,
        email_confirm: true,
      });
      if (updateError) {
        return json({ error: "Imeshindikana kuandaa akaunti ya kuingia. Wasiliana na School Admin." }, 500);
      }
    }

    ({ data, error } = await auth.auth.signInWithPassword({ email: authEmail, password }));
  } else {
    let email = identifier.toLowerCase();
    if (!identifier.includes("@")) {
      const { data: profile, error: profileError } = await admin
        .from("school_admin_profiles")
        .select("user_id")
        .eq("username", identifier.toLowerCase())
        .maybeSingle();

      if (profileError || !profile) {
        return json({ error: "Username au nenosiri si sahihi." }, 401);
      }

      const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
      if (userError || !userData.user?.email) {
        return json({ error: "Username au nenosiri si sahihi." }, 401);
      }
      email = userData.user.email;
    }

    ({ data, error } = await auth.auth.signInWithPassword({ email, password }));
  }

  if (error || !data.session) {
    return json({ error: "Username, namba ya simu au nenosiri si sahihi." }, 401);
  }

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});
