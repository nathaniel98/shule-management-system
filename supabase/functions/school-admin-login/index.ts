import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
  if (!identifier || !password) return json({ error: "Weka username/barua pepe na nenosiri." }, 400);

  let email = identifier.toLowerCase();
  if (!identifier.includes("@")) {
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile } = await admin.from("school_admin_profiles")
      .select("user_id").eq("username", identifier.toLowerCase()).maybeSingle();
    if (!profile) return json({ error: "Username au nenosiri si sahihi." }, 401);
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
    if (userError || !userData.user?.email) return json({ error: "Username au nenosiri si sahihi." }, 401);
    email = userData.user.email;
  }

  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) return json({ error: "Username/barua pepe au nenosiri si sahihi." }, 401);
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});
