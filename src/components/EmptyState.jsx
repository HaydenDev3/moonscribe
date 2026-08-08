import Icon from './Icon'

export default function EmptyState({ icon = 'fa-regular fa-circle-dot', title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon icon={icon} /></div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  )
}
