'use client'

import { useEffect, useRef, useState } from 'react'

const RATE_PER_100G = 1.5

export function PickMixCalculator() {
  const [grams, setGrams] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus on mount so the iPad pops its number pad straight away
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const g = Number(grams)
  const valid = grams !== '' && Number.isFinite(g) && g >= 0
  const price = valid ? (g / 100) * RATE_PER_100G : 0
  const priceStr = price.toFixed(2)

  return (
    <div className="flex flex-col items-center gap-6">
      <label className="w-full">
        <span className="block text-sm font-medium text-brand-forest">
          Weight in grams
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={grams}
          onChange={(e) => setGrams(e.target.value.replace(/\D/g, '').slice(0, 5))}
          placeholder="0"
          className="mt-2 w-full rounded-2xl border-2 border-brand-sage/60 bg-white px-4 py-6 text-center font-mono text-6xl tracking-wider text-brand-forest outline-none focus:border-brand-amber focus:ring-4 focus:ring-brand-amber/30"
        />
      </label>

      <div className="w-full rounded-2xl border-2 border-brand-amber bg-brand-amber/10 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-amber">
          Charge
        </p>
        <p className="mt-1 text-7xl font-bold text-brand-forest">
          £{priceStr}
        </p>
        {valid && (
          <p className="mt-2 text-sm text-brand-slate">
            {g}g × £{RATE_PER_100G.toFixed(2)} per 100g
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {[50, 100, 150, 200, 250, 300].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setGrams(String(preset))}
            className="rounded-lg border border-brand-sage/60 bg-white px-3 py-2 text-sm font-medium text-brand-forest hover:bg-brand-sage/10"
          >
            {preset}g
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setGrams('')
            inputRef.current?.focus()
          }}
          className="rounded-lg border border-brand-amber/60 bg-brand-amber/10 px-3 py-2 text-sm font-medium text-brand-forest hover:bg-brand-amber/20"
        >
          Clear
        </button>
      </div>

      <p className="text-center text-xs text-brand-slate">
        Type the weight in grams. Then type{' '}
        <strong className="text-brand-forest">£{priceStr}</strong> into the
        SumUp till.
      </p>
    </div>
  )
}
