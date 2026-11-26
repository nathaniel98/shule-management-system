
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anon || !service) {
    return json({ error: "Server configuration is incomplete" }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Authentication required" }, 401);
  }

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerData, error: callerError } =
    await caller.auth.getUser();

  if (callerError || !callerData.user) {
    return json({ error: "Invalid session" }, 401);
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: membership, error: membershipError } = await admin
    .from("school_members")
    .select("school_id")
    .eq("user_id", callerData.user.id)
    .eq("role", "school_admin")
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError || !membership) {
    return json({ error: "Ruhusa ya School Admin inahitajika." }, 403);
  }

  let body: any;

  try {
    body = await req.json();
  } catch {
    return json({ error: "Taarifa ulizotuma si sahihi." }, 400);
  }

  const displayName = String(body.display_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const rawPhone = String(body.phone ?? "").trim();
  const phoneDigits = rawPhone.replace(/[^0-9]/g, "");
  const normalizedPhone = rawPhone
    ? (rawPhone.startsWith("+") ? `+${phoneDigits}` : phoneDigits.startsWith("0") && phoneDigits.length === 10 ? `+255${phoneDigits.slice(1)}` : phoneDigits.startsWith("255") ? `+${phoneDigits}` : `+${phoneDigits}`)
    : "";
  const password = String(body.password ?? "");
  const role = String(body.role ?? "");
  const classId = body.class_id ? String(body.class_id) : null;

  const allowedRoles = [
    "class_teacher",
    "head_teacher",
    "accountant",
    "teacher",
  ];

  if (
    !displayName ||
    (!email && !normalizedPhone) ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    (normalizedPhone && !/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) ||
    password.length < 8 ||
    !allowedRoles.includes(role)
  ) {
    return json({ error: "Jaza taarifa zote zinazohitajika." }, 400);
  }

  if (role === "class_teacher" && !classId) {
    return json({ error: "Chagua darasa la mwalimu wa darasa." }, 400);
  }

  if (classId) {
    const { data: klass, error: classError } = await admin
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("school_id", membership.school_id)
      .maybeSingle();

    if (classError || !klass) {
      return json({ error: "Darasa ulilochagua si la shule yako." }, 403);
    }
  }

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      ...(email ? { email, email_confirm: true } : { phone: normalizedPhone, phone_confirm: true }),
      password,
      user_metadata: {
        account_type: "school_staff",
        school_id: membership.school_id,
        role,
        display_name: displayName,
      },
    });

  if (createError || !created.user) {
    return json({
      error: createError?.message ?? "Imeshindikana kutengeneza akaunti.",
    }, 400);
  }

  const { error: insertError } = await admin
    .from("school_staff_accounts")
    .insert({
      school_id: membership.school_id,
      user_id: created.user.id,
      display_name: displayName,
      email: email || null,
      phone: normalizedPhone || null,
      role,
      class_id: classId,
    });

  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: insertError.message }, 400);
  }

  return json({
    success: true,
    display_name: displayName,
    email: email || null,
    phone: normalizedPhone || null,
    role,
  });
});
