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

  // This school admin is confirmed in school_members. Use that verified
  // membership as the sole authorization source for this endpoint.
  const { data: memberships, error: membershipError } = await admin
    .from("school_members")
    .select("school_id")
    .eq("user_id", callerData.user.id)
    .eq("school_id", requestedSchoolId)
    .eq("role", "school_admin")
    .eq("is_active", true)
    .limit(1);

  if (membershipError) {
    console.error("Teacher directory membership lookup failed:", membershipError);
    return json({ error: "Imeshindikana kuthibitisha ruhusa za School Admin.", detail: membershipError.message }, 500);
  }
  if (!memberships || memberships.length === 0) {
    return json({ error: "Huna ruhusa ya kuona walimu wa shule hii." }, 403);
  }

  const { data: teachers, error: teachersError } = await admin
    .from("teachers")
    .select("id, first_name, middle_name, last_name, employee_no, status")
    .eq("school_id", requestedSchoolId)
    .order("first_name", { ascending: true });

  if (teachersError) {
    console.error("Teacher directory query failed:", teachersError);\n    return json({ error: "Imeshindikana kupakia orodha ya walimu.", detail: teachersError.message, code: teachersError.code }, 500);
  }

  return json({ teachers: teachers ?? [] });
});

// Deploy this endpoint through the staff-authentication workflow.
