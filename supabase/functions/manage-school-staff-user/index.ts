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

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await caller.auth.getUser();
  if (callerError || !callerData.user) return json({ error: "Invalid session" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Taarifa ulizotuma si sahihi." }, 400); }
  const schoolId = String(body.school_id ?? "").trim();
  const accountId = String(body.staff_account_id ?? "").trim();
  const action = String(body.action ?? "");
  if (!schoolId || !accountId || !["update", "delete"].includes(action)) {
    return json({ error: "Taarifa za ombi hazijakamilika." }, 400);
  }

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: membership, error: membershipError }, { data: adminProfile, error: profileError }] = await Promise.all([
    admin.from("school_members").select("school_id")
      .eq("user_id", callerData.user.id).eq("school_id", schoolId)
      .eq("role", "school_admin").eq("is_active", true).maybeSingle(),
    admin.from("school_admin_profiles").select("school_id")
      .eq("user_id", callerData.user.id).eq("school_id", schoolId).maybeSingle(),
  ]);
  if (membershipError || profileError) return json({ error: "Imeshindikana kuthibitisha ruhusa za msimamizi." }, 500);
  if (!(membership?.school_id || adminProfile?.school_id)) {
    return json({ error: "Huna ruhusa ya kusimamia watumiaji wa shule hii." }, 403);
  }

  const { data: account, error: accountError } = await admin.from("school_staff_accounts")
    .select("id, user_id, school_id, role, teacher_id").eq("id", accountId).eq("school_id", schoolId).maybeSingle();
  if (accountError) return json({ error: "Imeshindikana kupata akaunti ya mtumiaji." }, 500);
  if (!account) return json({ error: "Akaunti haikupatikana kwenye shule hii." }, 404);
  if (account.user_id === callerData.user.id) return json({ error: "Huwezi kufuta au kubadilisha akaunti unayotumia sasa." }, 403);

  if (action === "delete") {
    const { error: deleteError } = await admin.auth.admin.deleteUser(account.user_id);
    if (deleteError) return json({ error: `Imeshindikana kufuta akaunti: ${deleteError.message}` }, 500);
    return json({ success: true });
  }

  const displayName = String(body.display_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const rawPhone = String(body.phone ?? "").trim();
  const digits = rawPhone.replace(/[^0-9]/g, "");
  const phone = rawPhone
    ? (rawPhone.startsWith("+") ? `+${digits}`
      : digits.startsWith("0") && digits.length === 10 ? `+255${digits.slice(1)}`
      : digits.startsWith("255") ? `+${digits}` : `+${digits}`)
    : null;
  const role = String(body.role ?? "");
  const classId = body.class_id ? String(body.class_id) : null;
  const allowedRoles = ["class_teacher", "head_teacher", "accountant", "teacher"];
  if (!displayName || (!email && !phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) || !allowedRoles.includes(role)) {
    return json({ error: "Taarifa ulizoingiza si sahihi." }, 400);
  }
  if ((role === "class_teacher" || role === "teacher") && !account.teacher_id) {
    return json({ error: "Jukumu hili linahitaji akaunti iunganishwe na mwalimu aliyesajiliwa. Badilisha jukumu au tengeneza akaunti ya mwalimu kupitia sehemu ya usajili wa watumiaji." }, 400);
  }
  if (role === "class_teacher" && !classId) return json({ error: "Chagua darasa la mwalimu wa darasa." }, 400);
  if (classId) {
    const { data: klass, error: classError } = await admin.from("classes").select("id")
      .eq("id", classId).eq("school_id", schoolId).maybeSingle();
    if (classError || !klass) return json({ error: "Darasa ulilochagua si la shule hii." }, 403);
  }

  // Keep the Auth email in sync with the staff account. Phone-only accounts
  // use the same internal email convention as create-school-staff-user.
  const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(account.user_id);
  if (authUserError || !authUserData.user) return json({ error: "Imeshindikana kupata utambulisho wa login wa mtumiaji." }, 500);
  const previousAuthEmail = authUserData.user.email || "";
  const nextAuthEmail = email || `staff-${account.user_id}@staff-login.invalid`;
  const authEmailChanged = previousAuthEmail.toLowerCase() !== nextAuthEmail.toLowerCase();
  if (authEmailChanged) {
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(account.user_id, {
      email: nextAuthEmail,
      email_confirm: true,
      user_metadata: {
        ...(authUserData.user.user_metadata || {}),
        account_type: "school_staff",
        school_id: schoolId,
        role,
        display_name: displayName,
      },
    });
    if (authUpdateError) {
      return json({ error: `Imeshindikana kusasisha taarifa za login: ${authUpdateError.message}` }, 400);
    }
  } else {
    const { error: metadataError } = await admin.auth.admin.updateUserById(account.user_id, {
      user_metadata: {
        ...(authUserData.user.user_metadata || {}),
        account_type: "school_staff",
        school_id: schoolId,
        role,
        display_name: displayName,
      },
    });
    if (metadataError) return json({ error: "Imeshindikana kusasisha taarifa za akaunti." }, 500);
  }

  const { data: updated, error: updateError } = await admin.from("school_staff_accounts")
    .update({ display_name: displayName, email: email || null, phone, role, class_id: role === "class_teacher" ? classId : null })
    .eq("id", accountId).eq("school_id", schoolId).select("id").maybeSingle();
  if (updateError || !updated) {
    // Best-effort rollback to keep Auth and the staff-account row consistent.
    if (authEmailChanged) {
      await admin.auth.admin.updateUserById(account.user_id, {
        email: previousAuthEmail,
        email_confirm: true,
      });
    }
    if (updateError?.code === "23505") return json({ error: "Namba hii ya simu tayari inatumiwa na akaunti nyingine." }, 409);
    return json({ error: updateError ? `Imeshindikana kuhifadhi mabadiliko: ${updateError.message}` : "Akaunti haikupatikana au haikuhaririwa." }, 500);
  }
  return json({ success: true });
});
