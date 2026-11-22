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

const fail = (stage: string, message: string, status = 400) => {
  console.error(`[create-school-admin] ${stage}: ${message}`);
  return json({ success: false, stage, error: message }, status);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return fail("server_configuration", "Server configuration is incomplete", 500);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return fail("authentication", "Authentication required", 401);

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return fail("authentication", callerError?.message ?? "Invalid session", 401);

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

  if (roleError || !platformAdmin) return fail("super_admin_check", roleError?.message ?? "Super Admin permission required", 403);

  let body: any;
  try { body = await req.json(); } catch (error) { return fail("request_body", error instanceof Error ? error.message : "Invalid JSON body", 400); }

  const schoolName = String(body.school_name ?? "").trim();
  const username = String(body.username ?? "").trim().toLowerCase();
  const email = String(body.admin_email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!schoolName || !email || !password || !/^[a-z0-9._-]{3,30}$/.test(username)) {
    return fail("validation", "School name, valid username, admin email and password are required", 400);
  }
  if (password.length < 4) return fail("validation", "Password must contain at least 4 characters", 400);

  const { data: existingUsername, error: usernameCheckError } = await admin
    .from("school_admin_profiles").select("id").eq("username", username).maybeSingle();
  if (usernameCheckError) return fail("username_check", usernameCheckError.message, 500);
  if (existingUsername) return fail("username_check", "Username is already in use", 409);

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
  if (schoolError || !school) return fail("create_school", schoolError?.message ?? "Could not create school", 400);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, account_type: "school_admin" },
  });
  if (createError || !created.user) {
    await admin.from("schools").delete().eq("id", school.id);
    return fail("create_auth_user", createError?.message ?? "Could not create administrator account", 400);
  }

  const userId = created.user.id;
  const { error: memberError } = await admin.from("school_members").insert({
    school_id: school.id, user_id: userId, role: "school_admin", is_active: true,
  });
  if (memberError) {
    await admin.auth.admin.deleteUser(userId);
    await admin.from("schools").delete().eq("id", school.id);
    return fail("create_school_member", memberError.message, 400);
  }

  const { error: profileError } = await admin.from("school_admin_profiles").insert({
    school_id: school.id, user_id: userId, username,
  });
  if (profileError) {
    await admin.from("school_members").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    await admin.from("schools").delete().eq("id", school.id);
    return fail("create_admin_profile", profileError.message, 400);
  }

  return json({ success: true, school_id: school.id, username, admin_email: email });
});
