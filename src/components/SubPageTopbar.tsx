import { Link, NavLink } from 'react-router-dom'
import { NOVEL_NAV, itemPath } from '../nav'

export default function SubPageTopbar({ novel, title }) {
  return (
    <div className="workspace-topbar">
      <div className="crumbs">
        <Link to="/">All novels</Link> · <Link to={`/novel/${novel.id}`}>{novel.title}</Link> · <strong>{title}</strong>
      </div>
      <nav className="nav-tabs" style={{ border: 'none', padding: 0 }}>
        {NOVEL_NAV.flatMap((g) => g.items).map((n) => (
          <NavLink
            key={n.label}
            to={itemPath(novel.id, n)}
            end={n.end}
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
