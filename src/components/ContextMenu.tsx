// Right-click context menus. Any component can open one at the cursor with
// openContextMenu(x, y, items). Rendered in a portal, closed on click/Esc.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

const Ctx = createContext(null)

export function ContextMenuProvider({ children }) {
  const [menu, setMenu] = useState(null)
  const menuRef = useRef<ComponentRef<'div'> | null>(null)
  const focusElement = (element: Element | null | undefined) => {
    if (element && 'focus' in element && typeof element.focus === 'function') element.focus()
  }

  const close = useCallback(() => setMenu(null), [])

  const open = useCallback((e, items) => {
    if (e) e.preventDefault()
    const x = e?.clientX ?? 0
    const y = e?.clientY ?? 0
    setMenu({ x, y, items })
  }, [])

  useEffect(() => {
    const preventNativeMenu = (event) => event.preventDefault()
    window.addEventListener('contextmenu', preventNativeMenu)
    return () => window.removeEventListener('contextmenu', preventNativeMenu)
  }, [])

  useEffect(() => {
    if (!menu) return
    const onKey = (e) => {
      if (e.key === 'Escape') return close()
      const buttons = Array.from(menuRef.current?.querySelectorAll('button:not(:disabled)') || [])
      if (!buttons.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
      e.preventDefault()
      const current = buttons.indexOf(document.activeElement as (typeof buttons)[number])
      const next = e.key === 'Home' ? 0
        : e.key === 'End' ? buttons.length - 1
          : e.key === 'ArrowDown' ? (current + 1 + buttons.length) % buttons.length
            : (current - 1 + buttons.length) % buttons.length
      focusElement(buttons[next])
    }
    const onScroll = () => close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [menu, close])

  // Clamp the menu inside the viewport on open.
  useEffect(() => {
    if (!menu) return
    const el = menuRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let { x, y } = menu
    if (x + r.width > window.innerWidth - 8) x = Math.max(8, window.innerWidth - r.width - 8)
    if (y + r.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - r.height - 8)
    if (x !== menu.x || y !== menu.y) setMenu({ ...menu, x, y })
    const first = el.querySelector('button:not(:disabled)')
    requestAnimationFrame(() => focusElement(first))
  }, [menu])

  return (
    <Ctx.Provider value={{ openContextMenu: open, closeContextMenu: close }}>
      {children}
      {menu &&
        createPortal(
          <>
            <div className="cm-overlay" onClick={close} onContextMenu={(e) => { e.preventDefault(); close() }} />
            <div className="context-menu" ref={menuRef} style={{ left: menu.x, top: menu.y }} role="menu" onContextMenu={(e) => e.preventDefault()}>
              {menu.items.map((it, i) =>
                it === 'divider' ? (
                  <div className="cm-sep" key={i} />
                ) : (
                  <button
                    key={it.label + i}
                    className={`cm-item ${it.danger ? 'danger' : ''}`}
                    disabled={it.disabled}
                    role="menuitem"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      close()
                      it.onClick?.()
                    }}
                  >
                    {it.icon && <span className="cm-icon"><Icon icon={it.icon} /></span>}
                    {it.label}
                  </button>
                )
              )}
            </div>
          </>,
          document.body
        )}
    </Ctx.Provider>
  )
}

export function useContextMenu() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useContextMenu must be used inside ContextMenuProvider')
  return ctx
}
