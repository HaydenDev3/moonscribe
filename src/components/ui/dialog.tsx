import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/utils'
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal
export const DialogOverlay = ({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) => <DialogPrimitive.Overlay className={cn('fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out',className)} {...props}/>
export const DialogContent = ({ className, children, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) => <DialogPortal><DialogOverlay/><DialogPrimitive.Content className={cn('fixed left-1/2 top-1/2 z-50 grid max-h-[min(90dvh,720px)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-[#121116] p-6 text-white shadow-2xl focus:outline-none',className)} {...props}>{children}</DialogPrimitive.Content></DialogPortal>
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description
