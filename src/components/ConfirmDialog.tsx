import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from './ui/alert-dialog'
import { Button } from './ui/button'

export default function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Delete' }) {
  return <AlertDialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
    <AlertDialogContent>
      <AlertDialogTitle>{title}</AlertDialogTitle>
      <AlertDialogDescription>{children}</AlertDialogDescription>
      <div className="modal-foot">
        <AlertDialogCancel asChild><Button type="button" variant="ghost">Keep it</Button></AlertDialogCancel>
        <AlertDialogAction asChild><Button type="button" variant="destructive" onClick={onConfirm}>{confirmLabel}</Button></AlertDialogAction>
      </div>
    </AlertDialogContent>
  </AlertDialog>
}
