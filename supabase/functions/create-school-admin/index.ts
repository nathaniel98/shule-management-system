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

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return json({ error: "Invalid session" }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: platformAdmin, error: roleError } = await admin
    .from("system_admins")
    .select("user_id")
    .eq("user_id", callerData.user.id)
    .eq("role", "super_admin")
    .eq("is_active", true)
    .maybeSingle();

  if (roleError || !platformAdmin) return json({ error: "Super Admin permission required" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const schoolName = String(body.school_name ?? "").trim();
  const username = String(body.username ?? "").trim().toLowerCase();
  const email = String(body.admin_email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!schoolName || !email || !password || !/^[a-z0-9._-]{3,30}$/.test(username)) {
    return json({ error: "School name, valid username, admin email and password are required" }, 400);
  }
  if (password.length < 10) return json({ error: "Password must contain at least 10 characters" }, 400);

  const { data: existingUsername } = await admin
    .from("school_admin_profiles").select("id").eq("username", username).maybeSingle();
  if (existingUsername) return json({ error: "Username is already in use" }, 409);

  const schoolPayload = {
    school_name: schoolName,
    school_type: String(body.school_type ?? "Private"),
    education_system: String(body.education_system ?? "Zanzibar"),
    email: String(body.school_email ?? email).trim().toLowerCase() || null,
    phone: String(body.phone ?? "").trim() || null,
    address: String(body.address ?? "").trim() || null,
  };

  const { data: school, error: schoolError } = await admin
    .from("schools").insert(schoolPayload).select("id").single();
  if (schoolError || !school) return json({ error: schoolError?.message ?? "Could not create school" }, 400);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, account_type: "school_admin" },
  });
  if (createError || !created.user) {
    await admin.from("schools").delete().eq("id", school.id);
    return json({ error: createError?.message ?? "Could not create administrator account" }, 400);
  }

  const userId = created.user.id;
  const { error: memberError } = await admin.from("school_members").insert({
    school_id: school.id, user_id: userId, role: "school_admin", is_active: true,
  });
  if (memberError) {
    await admin.auth.admin.deleteUser(userId);
    await admin.from("schools").delete().eq("id", school.id);
    return json({ error: memberError.message }, 400);
  }

  const { error: profileError } = await admin.from("school_admin_profiles").insert({
    school_id: school.id, user_id: userId, username,
  });
  if (profileError) {
    await admin.from("school_members").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    await admin.from("schools").delete().eq("id", school.id);
    return json({ error: profileError.message }, 400);
  }

  return json({ success: true, school_id: school.id, username, admin_email: email });
});
