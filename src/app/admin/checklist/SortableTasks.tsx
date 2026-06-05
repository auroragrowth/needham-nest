'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { reorderTasks } from '@/lib/checklist/actions'

export type Task = {
  id: string
  name: string
  area: string | null
  active: boolean
}

/**
 * Reorderable list. Works on every device:
 *  - Up / Down buttons (tap-friendly on iPad, keyboard-accessible on
 *    desktop)
 *  - HTML5 native drag handle on top (works on desktop pointers, no-op
 *    on iOS)
 *
 * Single bucket — parent renders one per frequency.
 */
export function SortableTasks({ initial }: { initial: Task[] }) {
  const [items, setItems] = useState(initial)
  const [, startTransition] = useTransition()
  const draggedId = useRef<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  // Re-sync if the server-fetched initial changes (e.g. after add)
  useEffect(() => {
    setItems(initial)
  }, [initial])

  function persist(next: Task[]) {
    startTransition(() => {
      reorderTasks(next.map((t) => t.id)).catch(() => {
        /* best effort; next refresh will re-fetch */
      })
    })
  }

  function moveBy(id: string, delta: -1 | 1) {
    setItems((current) => {
      const idx = current.findIndex((t) => t.id === id)
      if (idx < 0) return current
      const targetIdx = idx + delta
      if (targetIdx < 0 || targetIdx >= current.length) return current
      const next = [...current]
      ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
      persist(next)
      return next
    })
  }

  function onDragStart(e: React.DragEvent<HTMLLIElement>, id: string) {
    draggedId.current = id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  function onDragOver(e: React.DragEvent<HTMLLIElement>, id: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overId !== id) setOverId(id)
  }

  function onDrop(e: React.DragEvent<HTMLLIElement>, targetId: string) {
    e.preventDefault()
    const draggedIdValue = draggedId.current
    draggedId.current = null
    setOverId(null)
    if (!draggedIdValue || draggedIdValue === targetId) return

    setItems((current) => {
      const next = [...current]
      const fromIdx = next.findIndex((t) => t.id === draggedIdValue)
      const toIdx = next.findIndex((t) => t.id === targetId)
      if (fromIdx < 0 || toIdx < 0) return current
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      persist(next)
      return next
    })
  }

  function onDragEnd() {
    draggedId.current = null
    setOverId(null)
  }

  return (
    <ul className="mt-2 divide-y divide-brand-sage/30 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
      {items.length === 0 && (
        <li className="px-4 py-3 text-sm text-brand-slate">No tasks in this bucket.</li>
      )}
      {items.map((t, i) => {
        const isOver = overId === t.id
        const isFirst = i === 0
        const isLast = i === items.length - 1
        return (
          <li
            key={t.id}
            draggable
            onDragStart={(e) => onDragStart(e, t.id)}
            onDragOver={(e) => onDragOver(e, t.id)}
            onDrop={(e) => onDrop(e, t.id)}
            onDragEnd={onDragEnd}
            className={`flex items-center gap-2 px-2 py-2 transition-colors ${
              isOver ? 'bg-brand-teal/10' : ''
            } ${!t.active ? 'opacity-60' : ''}`}
            style={{ touchAction: 'manipulation' }}
          >
            <span
              className="hidden cursor-grab select-none px-1 text-lg text-brand-slate hover:text-brand-forest active:cursor-grabbing sm:inline"
              aria-label="Drag to reorder"
              title="Drag to reorder (desktop)"
            >
              ⋮⋮
            </span>
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => moveBy(t.id, -1)}
                disabled={isFirst}
                aria-label="Move up"
                title="Move up"
                className="cursor-pointer rounded text-base text-brand-forest disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveBy(t.id, 1)}
                disabled={isLast}
                aria-label="Move down"
                title="Move down"
                className="cursor-pointer rounded text-base text-brand-forest disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                ▼
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-brand-forest">
                {t.name}
                {!t.active && (
                  <span className="ml-2 rounded bg-brand-sage/30 px-2 py-0.5 text-xs text-brand-forest">
                    inactive
                  </span>
                )}
              </p>
              {t.area && (
                <p className="text-xs text-brand-slate">{t.area}</p>
              )}
            </div>
            <Link
              href={`/admin/checklist/${t.id}`}
              className="text-sm font-medium text-brand-amber hover:underline"
            >
              Edit
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
