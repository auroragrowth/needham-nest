'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Draw-with-your-finger signature box. Writes a PNG data URL into a hidden
 * input called `name`, so it submits with an ordinary server-action form.
 */
export function SignaturePad({ name }: { name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const inkLength = useRef(0)
  const [value, setValue] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * ratio)
    canvas.height = Math.round(rect.height * ratio)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#17443f'
  }, [])

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = point(e)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    const p = point(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    inkLength.current += Math.hypot(p.x - last.current.x, p.y - last.current.y)
    last.current = p
  }

  function up() {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    // A dot or a tiny flick isn't a signature.
    if (inkLength.current > 40 && canvasRef.current) {
      setValue(canvasRef.current.toDataURL('image/png'))
    }
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    inkLength.current = 0
    setValue('')
  }

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-brand-sage bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          className="block h-44 w-full touch-none"
          aria-label="Signature box. Draw your signature with your finger or mouse."
        />
        {!value && (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-brand-slate">
            Sign here with your finger
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className={value ? 'text-brand-teal-deep' : 'text-brand-slate'}>
          {value ? 'Signature added ✓' : 'No signature yet'}
        </span>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-brand-forest hover:bg-brand-sage/10"
        >
          Clear
        </button>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  )
}
