// Needham Nest - invoice capture API.
// Deployed to the TILL Supabase project (sirmwnwllnarqdaqpzhy), not the café's.
// Kept in the café repo because the café app is its only caller; deploy with
// the Supabase MCP / CLI against the till project.
//
// The page lives in the cafe staff app; Supabase forces text/plain on HTML served
// from the functions domain, so the page cannot be served from here.
// verify_jwt off. Guarded by app_settings.invoice_capture_key.
// All writes use the service role, so RLS stays closed on every table.
//
// Calls:
//   GET  ?a=bootstrap            { suppliers, pending }
//   POST ?a=upload   (multipart) file, supplier_id?, captured_by?, state? -> { invoice_id }
//   GET  ?a=waiting              { invoices: [...with signed url] } — nobody has read these yet
//   POST ?a=claim    (json)      { id } -> { claimed }  — takes one for reading
//   POST ?a=result   (json)      { id, state, invoice_no?, invoice_date?, total_gross?, total_net?, reviewed_by? }
//                                 totals in pence; state confirmed (read into the café's expenses) or failed

import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const BUSINESS = "needham-nest";
const BUCKET = "invoices";
// A read that started this long ago and never reported back has died.
// Measured from read_started_at, set when a reader claims the invoice.
const STALE_MINUTES = 15;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info, x-capture-key",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function keyOk(given: string | null): Promise<boolean> {
  if (!given) return false;
  const { data } = await db.from("app_settings").select("value").eq("key", "invoice_capture_key").single();
  return !!data && data.value === given;
}

async function pendingCount(): Promise<number> {
  const { count } = await db
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("business_id", BUSINESS)
    .neq("state", "confirmed");
  return count ?? 0;
}

function staleBefore(): string {
  return new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
}

// Waiting to be read: never read, a read that failed, or a read that died.
function waitingFilter(): string {
  return `state.in.(captured,failed),and(state.eq.extracting,read_started_at.lt.${staleBefore()})`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const action = url.searchParams.get("a") ?? "bootstrap";

  // The key may travel in the query (standalone page) or the header (app proxy).
  const key = url.searchParams.get("k") ?? req.headers.get("x-capture-key");
  if (!(await keyOk(key))) return json({ error: "Wrong key. Check the link." }, 401);

  if (action === "bootstrap") {
    const { data } = await db
      .from("suppliers")
      .select("id,name")
      .eq("business_id", BUSINESS)
      .eq("active", true)
      .order("sort_order");
    return json({ suppliers: data ?? [], pending: await pendingCount() });
  }

  if (action === "upload" && req.method === "POST") {
    const form = await req.formData();
    const file = form.get("file");
    const supplierId = (form.get("supplier_id") as string) || null;
    const capturedBy = (form.get("captured_by") as string) || null;
    // The café app reads each file as it arrives, so it saves it already
    // claimed; the standalone page leaves it for the next read.
    const state = form.get("state") === "extracting" ? "extracting" : "captured";
    if (!(file instanceof File)) return json({ error: "No file came through." }, 400);

    const now = new Date();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const id = crypto.randomUUID();
    const path = `${BUSINESS}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${id}.${ext}`;

    const up = await db.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (up.error) return json({ error: "Storage refused it: " + up.error.message }, 500);

    const ins = await db.from("invoices").insert({
      id,
      business_id: BUSINESS,
      supplier_id: supplierId,
      storage_path: path,
      state,
      read_started_at: state === "extracting" ? now.toISOString() : null,
      captured_by: capturedBy,
      note: file.name,
    }).select("id").single();
    if (ins.error) return json({ error: "Saved the file but not the record." }, 500);

    return json({ invoice_id: ins.data.id });
  }

  if (action === "waiting") {
    const { data, error } = await db
      .from("invoices")
      .select("id, state, storage_path, captured_by, captured_at, note, supplier:suppliers(name)")
      .eq("business_id", BUSINESS)
      .or(waitingFilter())
      .order("captured_at")
      .limit(25);
    if (error) return json({ error: error.message }, 500);

    const invoices = [];
    for (const row of data ?? []) {
      const signed = await db.storage.from(BUCKET).createSignedUrl(row.storage_path, 600);
      invoices.push({
        id: row.id,
        state: row.state,
        file_name: row.note,
        captured_by: row.captured_by,
        captured_at: row.captured_at,
        supplier: (row.supplier as { name?: string } | null)?.name ?? null,
        url: signed.data?.signedUrl ?? null,
      });
    }
    return json({ invoices });
  }

  if (action === "claim" && req.method === "POST") {
    const body = await req.json().catch(() => null) as { id?: string } | null;
    if (!body?.id) return json({ error: "Which invoice?" }, 400);
    // Only one reader gets it: the update matches nothing once someone else has.
    const { data, error } = await db
      .from("invoices")
      .update({ state: "extracting", read_started_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("business_id", BUSINESS)
      .or(waitingFilter())
      .select("id");
    if (error) return json({ error: error.message }, 500);
    return json({ claimed: (data ?? []).length === 1 });
  }

  if (action === "result" && req.method === "POST") {
    const body = await req.json().catch(() => null) as {
      id?: string;
      state?: string;
      invoice_no?: string | null;
      invoice_date?: string | null;
      total_gross?: number | null;
      total_net?: number | null;
      reviewed_by?: string | null;
    } | null;
    if (!body?.id) return json({ error: "Which invoice?" }, 400);
    if (body.state !== "confirmed" && body.state !== "failed") {
      return json({ error: "State must be confirmed or failed." }, 400);
    }

    const update: Record<string, unknown> = { state: body.state };
    if (body.state === "confirmed") {
      update.invoice_no = body.invoice_no ?? null;
      update.invoice_date = body.invoice_date ?? null;
      update.total_gross = Number.isInteger(body.total_gross) ? body.total_gross : null;
      update.total_net = Number.isInteger(body.total_net) ? body.total_net : null;
      update.reviewed_by = body.reviewed_by ?? null;
      update.reviewed_at = new Date().toISOString();
    }

    const { error } = await db
      .from("invoices")
      .update(update)
      .eq("id", body.id)
      .eq("business_id", BUSINESS);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, pending: await pendingCount() });
  }

  return json({ error: "Unknown request." }, 404);
});
