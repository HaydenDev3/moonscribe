import Icon from './Icon'

import type { ReactNode } from 'react'

export default function EmptyState({ icon = 'fa-regular fa-circle-dot', title, children, action }: { icon?: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon icon={icon} /></div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  )
}
