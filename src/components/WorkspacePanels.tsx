import { useEffect, useState } from 'react'
import { getWorkspacePreferences, updateWorkspacePreferences } from '../db/workspacePreferences'
import Icon from './Icon'

export default function WorkspacePanels({ novelId, workspaceKey, panels = [], children }) {
  const [prefs, setPrefs] = useState<any>(null); const [open, setOpen] = useState(false)
  useEffect(() => { getWorkspacePreferences(novelId).then(setPrefs) }, [novelId])
  const config = prefs?.panels?.[workspaceKey] || panels.map((key) => ({ key, visible: true, size: 'medium' }))
  const isVisible = (key) => config.find((item) => item.key === key)?.visible !== false
  const toggle = async (key) => { const next = panels.map((item) => { const current = config.find((entry) => entry.key === item); return { key: item, visible: current?.key === key ? !isVisible(key) : isVisible(item), size: current?.size || 'medium' } }); const saved = await updateWorkspacePreferences(novelId, { panels: { ...(prefs?.panels || {}), [workspaceKey]: next } }); setPrefs(saved) }
  return children({ isVisible, customize: <><button type="button" className="button button-quiet" onClick={() => setOpen((value) => !value)}><Icon icon="fa-solid fa-sliders" /> Customize</button>{open && <div className="workspace-panel-menu" role="menu">{panels.map((key) => <label key={key}><span>{key.replace(/-/g, ' ')}</span><input type="checkbox" checked={isVisible(key)} onChange={() => void toggle(key)} /></label>)}</div>}</> })
}
