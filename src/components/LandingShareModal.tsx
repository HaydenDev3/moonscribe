import { useState } from 'react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import Icon from './Icon'

type LandingShareModalProps = { open: boolean; onOpenChange: (open: boolean) => void }

export default function LandingShareModal({ open, onOpenChange }: LandingShareModalProps) {
  const [copied, setCopied] = useState(false)
  const shareUrl = typeof window === 'undefined' ? 'https://www.moonscribe.cc/' : window.location.href.split('#')[0]

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="landing-share-dialog">
        <div className="landing-share-dialog-mark"><Icon icon="fa-solid fa-share-nodes" /></div>
        <DialogTitle>Share MoonScribe</DialogTitle>
        <DialogDescription>Invite a fellow storyteller to explore the quiet writing studio.</DialogDescription>
        <div className="landing-share-link-row"><input readOnly value={shareUrl} aria-label="MoonScribe share link" /><button type="button" onClick={copyLink}><Icon icon={copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'} /> {copied ? 'Copied' : 'Copy link'}</button></div>
        <div className="landing-share-dialog-actions"><a className="button button-secondary" href={`mailto:?subject=${encodeURIComponent('MoonScribe — a quiet studio for long stories')}&body=${encodeURIComponent(shareUrl)}`}><Icon icon="fa-solid fa-envelope" /> Email</a><DialogClose asChild><button className="button button-primary" type="button">Done</button></DialogClose></div>
      </DialogContent>
    </Dialog>
  )
}
