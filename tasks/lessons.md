# Lessons

Patterns worth not repeating. Newest first.

## Names that belong to the spec (18 Sep 2026)

The invoice-capture brief said only "the key from an env var", so I picked
`INVOICE_CAPTURE_KEY` and mentioned the choice at the end of a long summary. The
next version of the brief named it `TILL_CAPTURE_KEY`, and the rename touched
code, `.env.local.example` and the RUNBOOK.

**Rule.** An env var, a table, a route, a storage bucket — anything that has to
match something outside this repo — is the spec's to name, not mine. When a brief
leaves one open, say so *before* building, not in the summary afterwards. One
question costs a line; a rename costs every file that mentions it and a Vercel
setting that is easy to forget.

## Judge a payment by its reference, not its payee (18 Sep 2026)

I proposed hiding every bank payment to a staff member as wages, and a payee rule for "May
Richardson" as wages. Paul corrected it: some of those transfers are expense claims, which need
receipts. The references told the story all along — "W15", "Week 20" are pay; "Shopping",
"Tesco's receipt" are claims.

- Before classifying money by who received it, group by the reference/description and look.
- A person can be paid for several reasons; rules keyed on the payee alone will hide some of them.
