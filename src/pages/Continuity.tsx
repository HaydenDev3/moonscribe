import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { continuityReport, severityLabel } from '../db/continuity'
import { useApp } from '../context/AppContext'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icon'

const SEVERITY_ICON = { flag: 'fa-solid fa-circle-exclamation', watch: 'fa-solid fa-triangle-exclamation', hint: 'fa-solid fa-circle-info' }

export default function Continuity({ novelId, embedded }) {
  const { id } = useParams()
  const nid = novelId || id
  const { toast } = useApp()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [running, setRunning] = useState(false)

  const run = useCallback(async () => {
    setRunning(true)
    const r = await continuityReport(nid)
    setReport(r)
    setRunning(false)
  }, [nid])

  useEffect(() => {
    run()
  }, [run])

  const openChapter = (cid) => {
    if (!cid) return
    navigate(`/novel/${nid}`, { state: { chapterId: cid } })
  }

  const counts = report?.counts
  const flags = (report?.issues || []).filter((i) => i.severity === 2)
  const watches = (report?.issues || []).filter((i) => i.severity === 1)
  const hints = (report?.issues || []).filter((i) => i.severity === 0)

  return (
    <div className={embedded ? undefined : 'app'}>
      <div className="page page-wide">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>Continuity</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Scanned against your characters and worldbuilding — nothing leaves this device.
            </p>
          </div>
          <button className="button button-ghost" onClick={() => { run(); toast('Re-reading the manuscript…') }} disabled={running}>
            <Icon icon="fa-solid fa-rotate" style={{ marginRight: 6 }} /> {running ? 'Checking…' : 'Check again'}
          </button>
        </div>

        {counts && (
          <div className="continuity-stats">
            <span className="stat">{counts.chapters} chapters</span>
            <span className="stat">{counts.characters} characters</span>
            <span className="stat">{counts.places} places</span>
          </div>
        )}

        {report && report.issues.length === 0 ? (
          <EmptyState icon="fa-solid fa-circle-check" title="Nothing to flag">
            The manuscript holds together. When it drifts, this page will say so.
          </EmptyState>
        ) : (
          report?.issues.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {flags.length > 0 && (
                <IssueGroup label="Worth a look" icon={SEVERITY_ICON.flag} issues={flags} onOpen={openChapter} />
              )}
              {watches.length > 0 && (
                <IssueGroup label="Watch" icon={SEVERITY_ICON.watch} issues={watches} onOpen={openChapter} />
              )}
              {hints.length > 0 && (
                <IssueGroup label="Quiet notes" icon={SEVERITY_ICON.hint} issues={hints} onOpen={openChapter} />
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

function IssueGroup({ label, icon, issues, onOpen }) {
  return (
    <div>
      <div className="continuity-group-label">
        <Icon icon={icon} style={{ marginRight: 6 }} /> {label} · {issues.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {issues.map((i, idx) => (
          <div key={`${i.kind}:${i.chapterId || idx}`} className={`continuity-row ${severityLabel(i.severity)}`}>
            <div style={{ flex: 1 }}>
              <div className="continuity-title">{i.title}</div>
              <div className="muted small">{i.detail}</div>
            </div>
            {i.chapterId && (
              <button className="button button-ghost" onClick={() => onOpen(i.chapterId)}>
                Open chapter <Icon icon="fa-solid fa-arrow-right" style={{ marginLeft: 6 }} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
