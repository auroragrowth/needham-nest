// Daily handbook sign-off reminders (pg_cron, 9am UK).
//
// Everyone in the active round who hasn't signed gets one email a day, with
// how far they've got and the days left, until they sign. Paul gets a summary
// on Mondays, on the due date, every day it's overdue, and once when everyone
// has signed. Every send is written to handbook_reminder_log; a unique index
// there stops anyone being emailed twice in a day, however often this runs.
//
// ?test=1 sends a sample reminder and today's summary to the owner inbox only.
import { createClient } from "jsr:@supabase/supabase-js@2";

const GREEN = "#1A453B";
const GOLD = "#E6A251";
const CREAM = "#F7F0E0";
const APP = "https://needham-nest.vercel.app";
const SIGN_URL = `${APP}/staff/handbook-signoff`;
const TRACKER_URL = `${APP}/handbook/sign-offs`;
const OWNER = "info@needhamnest.uk";
const FROM = "The Needham Nest <handbook@needhamnest.uk>";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
function days(from: string, to: string) {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d(to) - d(from)) / 86_400_000);
}
function fmtDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London",
  });
}
function weekday(iso: string) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay(); // 1 = Monday
}

function shell(inner: string) {
  return `<div style="background:${CREAM};padding:24px;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:2px solid ${GOLD};padding:26px">
  ${inner}
  <p style="margin-top:26px;font-size:14px;color:#222">Thanks,<br>Ben, Paul and the team &#128154;</p>
  <p style="margin-top:4px;font-size:12px;color:#777">The Needham Nest · The Old Town Hall, Needham Market, Ipswich, Suffolk IP6 8AL</p>
  </div></div>`;
}

function button(href: string, label: string) {
  return `<p style="margin:22px 0"><a href="${href}" style="display:inline-block;background:${GREEN};color:${CREAM};text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px;border:2px solid ${GOLD}">${esc(label)}</a></p>`;
}

type Person = {
  profile_id: string; name: string; email: string | null;
  read: number; confirmed: boolean; signed: boolean; signed_on: string | null;
};

function staffEmail(p: Person, total: number, dueOn: string, today: string, isFirst: boolean) {
  const first = p.name.split(" ")[0];
  const left = days(today, dueOn);
  const when = left > 1 ? `${left} days left`
    : left === 1 ? "that's tomorrow"
    : left === 0 ? "that's today"
    : `it's now ${-left} day${left === -1 ? "" : "s"} overdue`;
  const where = p.confirmed
    ? "You've read it all. All that's left is to sign and date it, which takes a minute."
    : p.read === 0
      ? `There are ${total} short sections to get through.`
      : `You've read <strong>${p.read} of ${total}</strong> sections so far. Nice one.`;

  const subject = left < 0
    ? "Overdue: please sign the staff handbook"
    : isFirst
      ? "Please read and sign the staff handbook"
      : left <= 2
        ? `Reminder: handbook sign-off due ${left === 0 ? "today" : left === 1 ? "tomorrow" : `in ${left} days`}`
        : `Reminder: read and sign the handbook (${left} days left)`;

  const html = shell(`
  <h2 style="font-family:Georgia,serif;color:${GREEN};margin:0 0 14px">Hi ${esc(first)},</h2>
  <p style="font-size:15px;color:#222;line-height:1.55;margin:0 0 12px">${isFirst
    ? "We'd like everyone to read the staff handbook and sign to say you've read it. It's all on the staff app."
    : "Just a quick nudge about the staff handbook."}</p>
  <p style="font-size:15px;color:#222;line-height:1.55;margin:0 0 12px">${where}</p>
  <p style="font-size:15px;color:#222;line-height:1.55;margin:0 0 12px">Please finish by <strong>${esc(fmtDay(dueOn))}</strong>, ${when}.</p>
  ${button(SIGN_URL, p.confirmed ? "Sign the handbook" : "Open the handbook")}
  <p style="font-size:14px;color:#444;line-height:1.55;margin:0 0 8px"><strong>How it works:</strong> log in with your PIN, open each section (it ticks off as you go), tap <em>I have read it</em>, then sign and date. Your progress saves, so you can do a few at a time.</p>
  <p style="font-size:13px;color:#777;line-height:1.5;margin:0">You'll get this each morning until it's signed. Any questions, just ask May.</p>`);
  return { subject, html };
}

function ownerEmail(people: Person[], total: number, dueOn: string, today: string, title: string) {
  const signed = people.filter((p) => p.signed);
  const todo = people.filter((p) => !p.signed);
  const left = days(today, dueOn);
  const rows = todo.map((p) =>
    `<li><strong>${esc(p.name)}</strong>: ${p.confirmed ? "read it all, not signed yet" : `${p.read} of ${total} read`}${p.email ? "" : " <em>(no email on file, app prompt only)</em>"}</li>`,
  ).join("");
  const done = signed.map((p) => `<li>${esc(p.name)}${p.signed_on ? ` &middot; ${esc(fmtDay(p.signed_on))}` : ""}</li>`).join("");
  const subject = todo.length === 0
    ? "Handbook: everyone has signed ✓"
    : `Handbook sign-off: ${signed.length} of ${people.length} signed${left < 0 ? ` (${-left} days overdue)` : left === 0 ? " (due today)" : ""}`;
  const html = shell(`
  <h2 style="font-family:Georgia,serif;color:${GREEN};margin:0 0 4px">Handbook sign-off</h2>
  <p style="margin:0 0 14px;color:#666;font-size:13px">${esc(title)} &middot; due ${esc(fmtDay(dueOn))}</p>
  <p style="font-size:16px;color:#222;margin:0 0 10px"><strong>${signed.length} of ${people.length}</strong> signed.</p>
  ${todo.length ? `<h3 style="font-family:Georgia,serif;color:${GREEN};font-size:15px;margin:18px 0 6px">Still to do</h3><ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6;color:#222">${rows}</ul>` : ""}
  ${signed.length ? `<h3 style="font-family:Georgia,serif;color:${GREEN};font-size:15px;margin:18px 0 6px">Signed</h3><ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6;color:#222">${done}</ul>` : ""}
  ${button(TRACKER_URL, "See signatures")}`);
  return { subject, html };
}

async function send(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, detail: "RESEND_API_KEY not set" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: OWNER, subject, html }),
  });
  return { ok: r.ok, detail: r.ok ? null : `${r.status} ${(await r.text()).slice(0, 300)}` };
}

// Claims today's slot in the log first, so two overlapping runs can't both send.
async function sendOnce(roundId: string, profileId: string | null, to: string, kind: string, today: string, subject: string, html: string) {
  const { data: claim, error } = await supabase.from("handbook_reminder_log")
    .insert({ round_id: roundId, profile_id: profileId, sent_on: today, recipient: to, kind, ok: true, detail: "sending" })
    .select("id").single();
  if (error || !claim) return { skipped: true };
  const res = await send(to, subject, html);
  await supabase.from("handbook_reminder_log").update({ ok: res.ok, detail: res.detail ?? subject }).eq("id", claim.id);
  return { skipped: false, ok: res.ok };
}

Deno.serve(async (req) => {
  const test = new URL(req.url).searchParams.get("test") === "1";
  const today = londonToday();

  const { data: round } = await supabase.from("handbook_signoff_rounds")
    .select("id, title, started_on, due_on").eq("active", true).lte("started_on", today)
    .order("started_on", { ascending: false }).limit(1).maybeSingle();
  if (!round) return Response.json({ ok: true, note: "no active round" });

  const [{ data: rows, error: e1 }, { count: total }, { data: reads }, { data: everDone }, { data: sentBefore }] = await Promise.all([
    supabase.from("handbook_signoffs")
      .select("profile_id, read_confirmed_at, signed_at, signed_on, profiles(name, email, active)")
      .eq("round_id", round.id),
    supabase.from("handbook_articles").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("handbook_reads").select("profile_id").eq("round_id", round.id),
    supabase.from("handbook_reminder_log").select("id").eq("round_id", round.id).eq("kind", "owner-complete").limit(1),
    supabase.from("handbook_reminder_log").select("profile_id").eq("round_id", round.id).eq("kind", "staff").eq("ok", true).lt("sent_on", today),
  ]);
  const hadReminder = new Set((sentBefore ?? []).map((r: any) => r.profile_id));
  if (e1) return Response.json({ error: e1.message }, { status: 500 });

  const readCount = new Map<string, number>();
  for (const r of reads ?? []) readCount.set(r.profile_id, (readCount.get(r.profile_id) ?? 0) + 1);

  const people: Person[] = (rows ?? [])
    .filter((r: any) => r.profiles?.active)
    .map((r: any) => ({
      profile_id: r.profile_id,
      name: r.profiles.name,
      email: r.profiles.email?.trim() || null,
      read: readCount.get(r.profile_id) ?? 0,
      confirmed: Boolean(r.read_confirmed_at),
      signed: Boolean(r.signed_at),
      signed_on: r.signed_on,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const n = total ?? 0;

  if (test) {
    const sample = people.find((p) => !p.signed) ?? people[0];
    const s = staffEmail({ ...sample, name: "Paul (sample)" }, n, round.due_on, today, true);
    const o = ownerEmail(people, n, round.due_on, today, round.title);
    const a = await sendOnce(round.id, null, OWNER, "test-staff", today, `[Sample] ${s.subject}`, s.html);
    const b = await sendOnce(round.id, null, OWNER, "test-owner", today, `[Sample] ${o.subject}`, o.html);
    return Response.json({ test: true, staffSample: a, ownerSample: b });
  }

  const results: Record<string, unknown> = {};
  for (const p of people) {
    if (p.signed) continue;
    if (!p.email) { results[p.name] = "no email"; continue; }
    const m = staffEmail(p, n, round.due_on, today, !hadReminder.has(p.profile_id));
    results[p.name] = await sendOnce(round.id, p.profile_id, p.email, "staff", today, m.subject, m.html);
  }

  const allSigned = people.length > 0 && people.every((p) => p.signed);
  const left = days(today, round.due_on);
  if (allSigned) {
    if (!everDone?.length) {
      const o = ownerEmail(people, n, round.due_on, today, round.title);
      results.owner = await sendOnce(round.id, null, OWNER, "owner-complete", today, o.subject, o.html);
    }
  } else if (weekday(today) === 1 || left <= 0) {
    const o = ownerEmail(people, n, round.due_on, today, round.title);
    results.owner = await sendOnce(round.id, null, OWNER, "owner", today, o.subject, o.html);
  }

  return Response.json({ today, results });
});
