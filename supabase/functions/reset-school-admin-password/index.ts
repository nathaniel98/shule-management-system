import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Server configuration is incomplete" }, 500);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await caller.auth.getUser();
  if (callerError || !callerData.user) return json({ error: "Invalid session" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: platformAdmin } = await admin.from("system_admins")
    .select("user_id").eq("user_id", callerData.user.id)
    .eq("role", "super_admin").eq("is_active", true).maybeSingle();
  if (!platformAdmin) return json({ error: "Super Admin permission required" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const schoolId = String(body.school_id ?? "");
  const password = String(body.new_password ?? "");
  if (!schoolId || password.length < 10) {
    return json({ error: "School ID and a password of at least 10 characters are required" }, 400);
  }

  const { data: profile, error: profileError } = await admin
    .from("school_admin_profiles").select("user_id")
    .eq("school_id", schoolId).maybeSingle();
  if (profileError || !profile) return json({ error: "School administrator account not found" }, 404);

  const { error: updateError } = await admin.auth.admin.updateUserById(profile.user_id, { password });
  if (updateError) return json({ error: updateError.message }, 400);
  return json({ success: true });
});
