import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentPropsWithoutRef } from 'react'
export const TooltipProvider=TooltipPrimitive.Provider; export const Tooltip=TooltipPrimitive.Root; export const TooltipTrigger=TooltipPrimitive.Trigger
export function TooltipContent({className='',...props}:ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>){return <TooltipPrimitive.Portal><TooltipPrimitive.Content sideOffset={6} className={`z-50 rounded-lg bg-[#24212a] px-3 py-2 text-[11px] text-white shadow-xl ${className}`} {...props}/></TooltipPrimitive.Portal>}
