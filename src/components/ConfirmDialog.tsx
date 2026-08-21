import Modal from './Modal'

export default function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Delete' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}>
      <p style={{ color: 'var(--grey)', margin: 0 }}>{children}</p>
      <div className="modal-foot">
        <button className="button button-ghost" onClick={onClose}>
          Keep it
        </button>
        <button className="button button-rose" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
