import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only client using the service-role key. Never import from client code.
let cached: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — see .env.example"
      );
    }
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}

export const STAGING_BUCKET = "staging";

export async function logActivity(
  documentId: string | null,
  action: string,
  detail?: Record<string, unknown>
) {
  await supabase()
    .from("activity_log")
    .insert({ document_id: documentId, action, detail: detail ?? null });
}
