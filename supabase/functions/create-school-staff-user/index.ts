import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ error: "Server configuration is incomplete" }, 500);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await caller.auth.getUser();
  if (callerError || !callerData.user) return json({ error: "Invalid session" }, 401);

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Taarifa ulizotuma si sahihi." }, 400); }

  const requestedSchoolId = String(body.school_id ?? "").trim();
  if (!requestedSchoolId) return json({ error: "Shule haijachaguliwa. Tafadhali onyesha upya ukurasa." }, 400);

  // Validate the exact school context selected by the authenticated admin.
  // This keeps the class list shown in the UI and the server-side class check
  // scoped to the same school, including accounts linked to multiple schools.
  const [{ data: membership, error: membershipError }, { data: adminProfile, error: profileError }] = await Promise.all([
    admin
      .from("school_members")
      .select("school_id")
      .eq("user_id", callerData.user.id)
      .eq("school_id", requestedSchoolId)
      .eq("role", "school_admin")
      .eq("is_active", true)
      .maybeSingle(),
    admin
      .from("school_admin_profiles")
      .select("school_id")
      .eq("user_id", callerData.user.id)
      .eq("school_id", requestedSchoolId)
      .maybeSingle(),
  ]);

  if (membershipError || profileError) {
    return json({ error: "Imeshindikana kuthibitisha akaunti ya msimamizi wa shule." }, 500);
  }
  const authorizedSchoolId = membership?.school_id || adminProfile?.school_id;
  if (!authorizedSchoolId) {
    return json({ error: "Huna ruhusa ya kusajili watumiaji katika shule hii." }, 403);
  }

  const displayName = String(body.display_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const rawPhone = String(body.phone ?? "").trim();
  const phoneDigits = rawPhone.replace(/[^0-9]/g, "");
  const normalizedPhone = rawPhone
    ? (rawPhone.startsWith("+")
      ? `+${phoneDigits}`
      : phoneDigits.startsWith("0") && phoneDigits.length === 10
        ? `+255${phoneDigits.slice(1)}`
        : phoneDigits.startsWith("255")
          ? `+${phoneDigits}`
          : `+${phoneDigits}`)
    : "";
  const password = String(body.password ?? "");
  const role = String(body.role ?? "");
  const classId = body.class_id ? String(body.class_id) : null;
  const teacherId = body.teacher_id ? String(body.teacher_id) : null;

  const allowedRoles = ["class_teacher", "head_teacher", "accountant", "teacher"];

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

  if ((role === "teacher" || role === "class_teacher") && !teacherId) {
    return json({ error: "Chagua mwalimu aliyesajiliwa kwenye shule hii." }, 400);
  }

  if (teacherId) {
    const { data: teacher, error: teacherError } = await admin
      .from("teachers")
      .select("id")
      .eq("id", teacherId)
      .eq("school_id", authorizedSchoolId)
      .maybeSingle();
    if (teacherError || !teacher) return json({ error: "Mwalimu uliyemchagua hajasajiliwa kwenye shule hii." }, 403);

    const { data: existingLink, error: linkError } = await admin
      .from("school_staff_accounts")
      .select("id")
      .eq("teacher_id", teacherId)
      .maybeSingle();
    if (linkError) return json({ error: "Imeshindikana kuthibitisha uhusiano wa mwalimu." }, 500);
    if (existingLink) return json({ error: "Mwalimu huyu tayari ameunganishwa na akaunti ya mfumo." }, 409);
  }

  if (role === "class_teacher" && !classId) {
    return json({ error: "Chagua darasa la mwalimu wa darasa." }, 400);
  }

  if (classId) {
    const { data: klass, error: classError } = await admin
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("school_id", authorizedSchoolId)
      .maybeSingle();

    if (classError || !klass) return json({ error: "Darasa ulilochagua si la shule yako." }, 403);
  }

  // Supabase Phone Auth is intentionally not required. For phone-only staff,
  // create a confirmed internal email identity and keep the real phone in the
  // school_staff_accounts table. Login resolves that phone server-side.
  const authEmail = email || `staff-${crypto.randomUUID()}@staff-login.invalid`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    email_confirm: true,
    password,
    user_metadata: {
      account_type: "school_staff",
      school_id: authorizedSchoolId,
      role,
      display_name: displayName,
    },
  });

  if (createError || !created.user) {
    return json({ error: createError?.message ?? "Imeshindikana kutengeneza akaunti." }, 400);
  }

  const { error: insertError } = await admin
    .from("school_staff_accounts")
    .insert({
      school_id: authorizedSchoolId,
      user_id: created.user.id,
      display_name: displayName,
      email: email || null,
      phone: normalizedPhone || null,
      role,
      class_id: classId,
      teacher_id: teacherId,
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
