import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import ProfileAvatar from './ProfileAvatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

export type PresenceAvatarPerson = {
  id?: string | number
  sessionId?: string
  username?: string
  name?: string
  avatar?: string | null
  status?: string
  chapterId?: string | null
  deviceType?: string
  device?: string
}

type UserPresenceAvatarProps = {
  people: PresenceAvatarPerson[]
  chapterId?: string | null
  maxVisible?: number
}

const statusLabel: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do not disturb',
  offline: 'Offline',
}

const statusClass: Record<string, string> = {
  online: 'bg-emerald-400',
  idle: 'bg-amber-300',
  dnd: 'bg-rose-400',
  offline: 'bg-white/30',
}

export default function UserPresenceAvatar({
  people,
  chapterId,
  maxVisible = 4,
}: UserPresenceAvatarProps) {
  const visible = people.slice(0, maxVisible)
  if (!visible.length) return null

  return (
    <TooltipProvider delayDuration={250}>
      <LayoutGroup>
        <div
          className="flex items-center -space-x-2"
          aria-label={`${people.length} active collaborator${people.length === 1 ? '' : 's'}`}
        >
          <AnimatePresence initial={false}>
            {visible.map((person, index) => {
              const name = person.username || person.name || 'Collaborator'
              const status = person.status || 'offline'
              const key = person.sessionId || `${person.id || name}-${index}`
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <motion.span
                      layoutId={`presence-avatar-${key}`}
                      layout
                      initial={{ opacity: 0, scale: 0.72, x: 8 }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                        x: 0,
                        filter: status === 'offline' ? 'grayscale(1)' : 'grayscale(0)',
                      }}
                      exit={{ opacity: 0, scale: 0.72, x: -8 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                      className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 bg-[var(--surface-raised)] shadow-[0_2px_8px_rgba(0,0,0,.22)] ${person.chapterId === chapterId ? 'border-[var(--accent)]' : 'border-[var(--surface)]'}`}
                      tabIndex={0}
                      aria-label={`${name}: ${statusLabel[status] || status}`}
                    >
                      <ProfileAvatar src={person.avatar} name={name} />
                      <i
                        className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[var(--surface)] ${statusClass[status] || statusClass.offline}`}
                        aria-hidden="true"
                      />
                    </motion.span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>
                      {name} · {statusLabel[status] || status}
                    </span>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </AnimatePresence>
          {people.length > maxVisible && (
            <motion.span
              layout
              className="grid h-7 min-w-7 place-items-center rounded-full border-2 border-[var(--surface)] bg-[var(--surface-elev)] px-1 text-[10px] font-semibold text-[var(--moon-text,var(--text))]"
            >
              +{people.length - maxVisible}
            </motion.span>
          )}
        </div>
      </LayoutGroup>
    </TooltipProvider>
  )
}
