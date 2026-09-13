import { AnimatePresence, motion, type Transition } from 'motion/react'
import { ArrowUpRight, RotateCcw } from 'lucide-react'

export type NotificationListItem = {
  id: string
  title: string
  body: string
  createdAt: number
  readAt: number | null
  category?: string
  actionUrl?: string | null
}

type NotificationListProps = {
  items: NotificationListItem[]
  onOpen: (item: NotificationListItem) => void
}

const transition: Transition = { type: 'spring', stiffness: 300, damping: 26 }

function timeLabel(createdAt: number) {
  const seconds = Math.round((createdAt - Date.now()) / 1000)
  const absolute = Math.abs(seconds)
  if (absolute < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return `${Math.abs(minutes)}m ago`
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return `${Math.abs(hours)}h ago`
  return `${Math.round(Math.abs(hours) / 24)}d ago`
}

const cardVariants = (index: number) => ({
  collapsed: { marginTop: index === 0 ? 0 : -34, scaleX: 1 - index * 0.035 },
  expanded: { marginTop: index === 0 ? 0 : 4, scaleX: 1 },
})

export default function NotificationList({ items, onOpen }: NotificationListProps) {
  return (
    <motion.div
      className="w-full max-w-full overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] bg-[color-mix(in_srgb,var(--surface-elev)_94%,black)] p-2.5 shadow-[0_18px_55px_rgba(0,0,0,.38)]"
      initial="collapsed"
      whileHover="expanded"
      whileFocus="expanded"
    >
      <div className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[var(--accent)]">
        Recent activity
      </div>
      <div className="grid gap-0">
        <AnimatePresence initial={false} mode="popLayout">
          {items.slice(0, 6).map((item, index) => (
            <motion.button
              key={item.id}
              type="button"
              layout
              variants={cardVariants(index)}
              transition={transition}
              className={`relative z-10 grid w-full min-w-0 gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface-raised))] focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${item.readAt ? 'border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[var(--surface-raised)]' : 'border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-raised))]'}`}
              onClick={() => onOpen(item)}
            >
              <span className="flex min-w-0 items-center justify-between gap-2">
                <strong className="truncate text-xs font-semibold text-[var(--text)]">
                  {item.title}
                </strong>
                {!item.readAt && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                    aria-label="Unread"
                  />
                )}
              </span>
              <span className="line-clamp-2 text-[11px] leading-4 text-[var(--muted)]">
                {item.body}
              </span>
              <span className="flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
                <span>
                  {timeLabel(item.createdAt)}
                  {item.category ? ` · ${item.category}` : ''}
                </span>
                <ArrowUpRight className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2 px-1 pt-2 text-xs text-[var(--muted)]">
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,var(--surface-raised))] px-1 text-[10px] font-semibold text-[var(--accent)]">
          {items.length}
        </span>
        <span>Notifications</span>
        <RotateCcw className="ml-auto size-3.5 opacity-50" aria-hidden="true" />
      </div>
    </motion.div>
  )
}
