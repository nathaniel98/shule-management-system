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
    .select("id, user_id, school_id, role, teacher_id, staff_member_id").eq("id", accountId).eq("school_id", schoolId).maybeSingle();
  if (accountError) return json({ error: "Imeshindikana kupata akaunti ya mtumiaji." }, 500);
  if (!account) return json({ error: "Akaunti haikupatikana kwenye shule hii." }, 404);
  if (account.user_id === callerData.user.id) return json({ error: "Huwezi kufuta au kubadilisha akaunti unayotumia sasa." }, 403);

  if (action === "delete") {
    // Deactivate the school account instead of hard-deleting the Auth user.
    // A staff login may be referenced by historical school records; retaining
    // the identity preserves those records while revoking this school's access.
    const { data: deactivated, error: deactivateError } = await admin
      .from("school_staff_accounts")
      .update({ is_active: false })
      .eq("id", accountId)
      .eq("school_id", schoolId)
      .eq("user_id", account.user_id)
      .eq("is_active", true)
      .select("id")
      .maybeSingle();
    if (deactivateError) return json({ error: `Imeshindikana kuzima akaunti: ${deactivateError.message}` }, 500);
    if (!deactivated) return json({ error: "Akaunti tayari imezimwa au haikupatikana." }, 404);
    return json({ success: true, deactivated: true });
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
  const staffMemberId = body.staff_member_id ? String(body.staff_member_id) : null;
  const classId = body.class_id ? String(body.class_id) : null;
  const allowedRoles = ["class_teacher", "head_teacher", "accountant", "teacher", "academic"];
  if (!displayName || (!email && !phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) || !allowedRoles.includes(role)) {
    return json({ error: "Taarifa ulizoingiza si sahihi." }, 400);
  }
  let linkedTeacherId: string | null = null;
  if (staffMemberId) {
    const { data: staffMember, error: staffMemberError } = await admin.from("school_staff_directory")
      .select("id, school_id, staff_category, status, teacher_id")
      .eq("id", staffMemberId).eq("school_id", schoolId).maybeSingle();
    if (staffMemberError) return json({ error: "Imeshindikana kuthibitisha mtumishi aliyechaguliwa." }, 500);
    if (!staffMember || staffMember.status !== "Active") {
      return json({ error: "Chagua mtumishi aliye hai kwenye orodha ya shule hii." }, 400);
    }
    const { data: otherAccount, error: otherAccountError } = await admin.from("school_staff_accounts")
      .select("id").eq("staff_member_id", staffMemberId).neq("id", accountId).maybeSingle();
    if (otherAccountError) return json({ error: "Imeshindikana kuthibitisha uhusiano wa akaunti." }, 500);
    if (otherAccount) return json({ error: "Mtumishi huyu tayari ameunganishwa na akaunti nyingine." }, 409);
    if ((role === "teacher" || role === "class_teacher") &&
        (staffMember.staff_category !== "teaching" || !staffMember.teacher_id)) {
      return json({ error: "Jukumu hili linahitaji kuchagua mtumishi aliyesajiliwa kama mwalimu." }, 400);
    }
    linkedTeacherId = staffMember.teacher_id;
  } else if (role === "teacher" || role === "class_teacher") {
    return json({ error: "Jukumu hili linahitaji kuunganishwa na mtumishi aliyesajiliwa kama mwalimu." }, 400);
  }
  if (role === "class_teacher" && !classId) return json({ error: "Chagua darasa la mwalimu wa darasa." }, 400);
  if (classId) {
    const { data: klass, error: classError } = await admin.from("classes").select("id")
      .eq("id", classId).eq("school_id", schoolId).maybeSingle();
    if (classError || !klass) return json({ error: "Darasa ulilochagua si la shule hii." }, 403);
  }

  const { data: updated, error: updateError } = await admin.from("school_staff_accounts")
    .update({ display_name: displayName, email: email || null, phone, role, staff_member_id: staffMemberId, teacher_id: linkedTeacherId, class_id: role === "class_teacher" ? classId : null })
    .eq("id", accountId).eq("school_id", schoolId).select("id").maybeSingle();
  if (updateError) {
    if (updateError.code === "23505") return json({ error: "Namba hii ya simu tayari inatumiwa na akaunti nyingine." }, 409);
    return json({ error: `Imeshindikana kuhifadhi mabadiliko: ${updateError.message}` }, 500);
  }
  if (!updated) return json({ error: "Akaunti haikupatikana au haikuhaririwa." }, 404);
  return json({ success: true });
});
