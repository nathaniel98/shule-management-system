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

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Taarifa ulizotuma si sahihi." }, 400); }
  const requestedSchoolId = String(body.school_id ?? "").trim();
  if (!requestedSchoolId) return json({ error: "Shule haijachaguliwa." }, 400);

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: membership, error: membershipError }, { data: adminProfile, error: profileError }] = await Promise.all([
    admin.from("school_members").select("school_id")
      .eq("user_id", callerData.user.id)
      .eq("school_id", requestedSchoolId)
      .eq("role", "school_admin")
      .eq("is_active", true)
      .maybeSingle(),
    admin.from("school_admin_profiles").select("school_id")
      .eq("user_id", callerData.user.id)
      .eq("school_id", requestedSchoolId)
      .maybeSingle(),
  ]);

  if (membershipError || profileError) {
    return json({ error: "Imeshindikana kuthibitisha akaunti ya msimamizi wa shule." }, 500);
  }
  if (!membership?.school_id && !adminProfile?.school_id) {
    return json({ error: "Huna ruhusa ya kuona walimu wa shule hii." }, 403);
  }

  const { data: teachers, error: teachersError } = await admin
    .from("teachers")
    .select("id, first_name, middle_name, last_name, employee_no, status")
    .eq("school_id", requestedSchoolId)
    .order("first_name", { ascending: true });

  if (teachersError) {
    return json({ error: "Imeshindikana kupakia orodha ya walimu." }, 500);
  }

  return json({ teachers: teachers ?? [] });
});
