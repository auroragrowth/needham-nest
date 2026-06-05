'use client'

import { useRef, useState } from 'react'

const RATE_PER_100G = 1.5

const PRESETS = [50, 100, 150, 200, 250, 300, 400, 500]

export function PickMixCalculator() {
  const [grams, setGrams] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  const g = Number(grams)
  const valid = grams !== '' && Number.isFinite(g) && g >= 0
  const price = valid ? (g / 100) * RATE_PER_100G : 0
  const priceStr = price.toFixed(2)

  function setPreset(value: number) {
    setGrams(String(value))
    inputRef.current?.focus()
  }

  function clear() {
    setGrams('')
    inputRef.current?.focus()
  }

  return (
    <div
      className="flex flex-col items-center gap-6"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Result is at the TOP on tablet so it stays visible above the
          on-screen keyboard. */}
      <div className="w-full rounded-2xl border-2 border-brand-amber bg-brand-amber/10 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-amber">
          Charge customer
        </p>
        <p className="mt-1 text-7xl font-bold text-brand-forest">
          £{priceStr}
        </p>
        <p className="mt-2 text-sm text-brand-slate">
          {valid
            ? `${g}g × £${RATE_PER_100G.toFixed(2)} per 100g`
            : 'Type the weight below'}
        </p>
      </div>

      <label
        htmlFor="pick-mix-grams"
        className="w-full"
        onClick={() => inputRef.current?.focus()}
      >
        <span className="block text-sm font-medium text-brand-forest">
          Weight in grams (tap to type)
        </span>
        <input
          id="pick-mix-grams"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={grams}
          onChange={(e) =>
            setGrams(e.target.value.replace(/\D/g, '').slice(0, 5))
          }
          placeholder="0"
          aria-label="Weight in grams"
          className="mt-2 w-full rounded-2xl border-2 border-brand-sage/60 bg-white px-4 py-6 text-center font-mono text-6xl tracking-wider text-brand-forest outline-none focus:border-brand-amber focus:ring-4 focus:ring-brand-amber/30"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        />
      </label>

      <div>
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-brand-slate">
          Quick weights
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setPreset(preset)}
              className="cursor-pointer select-none rounded-xl border border-brand-sage/60 bg-white px-4 py-3 text-base font-medium text-brand-forest active:scale-95 hover:bg-brand-sage/10"
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {preset}g
            </button>
          ))}
        </div>
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={clear}
            className="cursor-pointer select-none rounded-xl border border-brand-amber/60 bg-brand-amber/10 px-5 py-3 text-base font-medium text-brand-forest active:scale-95 hover:bg-brand-amber/20"
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <p className="text-center text-sm text-brand-slate">
        Type{' '}
        <strong className="rounded bg-brand-amber/20 px-1 text-brand-forest">
          £{priceStr}
        </strong>{' '}
        into the SumUp till.
      </p>
    </div>
  )
}
