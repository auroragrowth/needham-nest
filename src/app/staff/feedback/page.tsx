'use client'

/**
 * Anonymous staff feedback form.
 *
 * The insert goes straight from the browser to Supabase with the public
 * (publishable) key, so nothing about who filled it in ever reaches our
 * server. RLS allows `anon` to INSERT and only Paul to SELECT.
 */

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type RatingField = 'cafe_rating' | 'products_rating' | 'prices_rating'

type Section = {
  title: string
  hint: string
  rating?: RatingField
  questions: { field: string; label: string }[]
}

const SECTIONS: Section[] = [
  {
    title: 'The café overall',
    hint: 'How you feel about the place as a whole at the moment.',
    rating: 'cafe_rating',
    questions: [
      {
        field: 'cafe_comments',
        label: 'What is working well, and what could be better?',
      },
    ],
  },
  {
    title: 'The team',
    hint: 'How things feel working alongside everyone day to day.',
    questions: [
      { field: 'team_comments', label: 'Your thoughts on the team' },
    ],
  },
  {
    title: 'What we sell',
    hint: 'The food and drink on the menu.',
    rating: 'products_rating',
    questions: [
      {
        field: 'products_comments',
        label: 'Anything we should add, change or drop?',
      },
    ],
  },
  {
    title: 'Our prices',
    hint: 'What we charge for what we sell.',
    rating: 'prices_rating',
    questions: [
      {
        field: 'prices_comments',
        label: 'Do our prices feel about right? Tell us more.',
      },
    ],
  },
  {
    title: 'Specials',
    hint: 'The specials and one-off things we run, like Smash Burger Night.',
    questions: [
      {
        field: 'specials_comments',
        label: 'What is landing well, and what would you like to see?',
      },
    ],
  },
  {
    title: 'Paul and Ben',
    hint: 'How the owners are with you and the team.',
    questions: [{ field: 'owners_comments', label: 'Your honest thoughts' }],
  },
  {
    title: 'Communication and how the team is managed',
    hint: 'Anything that could be clearer or run more smoothly.',
    questions: [
      {
        field: 'comms_management_comments',
        label: 'What would you improve?',
      },
    ],
  },
  {
    title: 'Fixed shift rotas',
    hint: 'We are looking at set shifts at the moment, so this really helps.',
    questions: [
      { field: 'rota_comments', label: 'How do set shifts work for you?' },
    ],
  },
  {
    title: 'Other members of the team',
    hint: 'Anything you want to raise about anyone you work with, good or otherwise.',
    questions: [{ field: 'other_staff_comments', label: 'Your feedback' }],
  },
  {
    title: 'Your manager, May',
    hint: 'Please be as detailed as you can. This part is really valuable.',
    questions: [
      { field: 'manager_did_well', label: 'What is May doing well?' },
      { field: 'manager_improve', label: 'What could May improve on?' },
      {
        field: 'support_needed',
        label: 'Where would you like more support from her, or from us?',
      },
    ],
  },
  {
    title: 'Anything else',
    hint: 'Anything at all we have not asked about.',
    questions: [{ field: 'anything_else', label: 'Over to you' }],
  },
]

function Stars({
  value,
  onChange,
}: {
  value?: number
  onChange: (v: number | undefined) => void
}) {
  return (
    <div className="mt-2 flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={`px-1 text-3xl leading-none ${
            value && n <= value ? 'text-brand-amber' : 'text-brand-sage/50'
          }`}
        >
          ★
        </button>
      ))}
      {value ? (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="ml-2 text-xs text-brand-slate underline"
        >
          clear
        </button>
      ) : null}
    </div>
  )
}

export default function StaffFeedbackPage() {
  const [ratings, setRatings] = useState<Partial<Record<RatingField, number>>>(
    {},
  )
  const [text, setText] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)

    const payload: Record<string, string | number> = {}
    for (const [field, value] of Object.entries(ratings)) {
      if (value) payload[field] = value
    }
    for (const [field, value] of Object.entries(text)) {
      const trimmed = value.trim()
      if (trimmed) payload[field] = trimmed
    }

    if (Object.keys(payload).length === 0) {
      setError('Add a rating or a comment before sending.')
      return
    }

    setSending(true)
    const { error: insertError } = await createClient()
      .from('staff_feedback')
      .insert(payload)

    if (insertError) {
      setError('Sorry, that did not send. Check your connection and try again.')
      setSending(false)
      return
    }

    setDone(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (done) {
    return (
      <main className="mx-auto max-w-md text-center">
        <div className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-8">
          <p className="text-4xl" aria-hidden>
            ✓
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-brand-forest">
            That is really helpful
          </h1>
          <p className="mt-2 text-sm text-brand-slate">
            Thank you for taking the time. Your answers came through
            anonymously, and only Paul will read them.
          </p>
          <Link
            href="/staff"
            className="mt-6 inline-block text-sm font-semibold text-brand-amber hover:underline"
          >
            ← Back to the tablet
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md">
      <Link href="/staff" className="text-sm text-brand-amber hover:underline">
        ← Tablet
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Have your say
      </h1>

      <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
        <strong className="font-semibold">This is completely anonymous.</strong>{' '}
        We do not record who you are, so please be honest — it genuinely helps
        us make this a better place to work. Only Paul sees your answers, and
        they will be looked at once everyone has filled the form in.
      </p>
      <p className="mt-3 text-sm text-brand-slate">
        Fill in as much or as little as you like. No need to add your name.
        Take your time.
      </p>

      <div className="mt-6 space-y-4">
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-xl border border-brand-sage/40 bg-white p-5"
          >
            <h2 className="text-lg font-semibold text-brand-forest">
              {section.title}
            </h2>
            <p className="mt-1 text-sm text-brand-slate">{section.hint}</p>

            {section.rating && (
              <Stars
                value={ratings[section.rating]}
                onChange={(v) =>
                  setRatings((r) => ({ ...r, [section.rating!]: v }))
                }
              />
            )}

            {section.questions.map((q) => (
              <div key={q.field} className="mt-4">
                <label
                  htmlFor={q.field}
                  className="block text-sm font-medium text-brand-forest"
                >
                  {q.label}
                </label>
                <textarea
                  id={q.field}
                  name={q.field}
                  rows={4}
                  value={text[q.field] ?? ''}
                  onChange={(e) =>
                    setText((t) => ({ ...t, [q.field]: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-base text-brand-forest"
                />
              </div>
            ))}
          </section>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={sending}
        className="mt-6 w-full rounded-full bg-brand-forest px-6 py-4 text-base font-semibold text-brand-cream transition active:scale-[0.99] disabled:opacity-60"
      >
        {sending ? 'Sending…' : 'Send my feedback'}
      </button>
      <p className="mt-3 mb-2 text-center text-sm text-brand-slate">
        Thank you
      </p>
    </main>
  )
}
