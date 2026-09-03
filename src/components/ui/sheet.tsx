import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/utils'
export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close
export const SheetContent = ({ className, side='right', ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: 'left'|'right'|'top'|'bottom' }) => <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70"/><DialogPrimitive.Content className={cn('fixed z-50 flex flex-col gap-4 border-white/10 bg-[#121116] p-6 text-white shadow-2xl focus:outline-none',side==='left'?'inset-y-0 left-0 h-full w-[min(88vw,380px)] border-r':'inset-y-0 right-0 h-full w-[min(88vw,380px)] border-l',className)} {...props}/></DialogPrimitive.Portal>
export const SheetTitle = DialogPrimitive.Title
export const SheetDescription = DialogPrimitive.Description
