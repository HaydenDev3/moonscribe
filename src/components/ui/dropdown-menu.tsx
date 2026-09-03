import * as Menu from '@radix-ui/react-dropdown-menu'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/utils'
export const DropdownMenu=Menu.Root; export const DropdownMenuTrigger=Menu.Trigger; export const DropdownMenuGroup=Menu.Group; export const DropdownMenuRadioGroup=Menu.RadioGroup
export function DropdownMenuContent({className,...props}:ComponentPropsWithoutRef<typeof Menu.Content>){return <Menu.Portal><Menu.Content sideOffset={6} className={cn('z-50 min-w-40 overflow-hidden rounded-xl border border-white/10 bg-[#15141b] p-1 text-white shadow-2xl',className)} {...props}/></Menu.Portal>}
export function DropdownMenuItem({className,...props}:ComponentPropsWithoutRef<typeof Menu.Item>){return <Menu.Item className={cn('flex min-h-9 cursor-pointer items-center rounded-lg px-3 text-xs outline-none transition focus:bg-white/[.08] data-[disabled]:pointer-events-none data-[disabled]:opacity-40',className)} {...props}/>} export const DropdownMenuLabel=Menu.Label; export const DropdownMenuSeparator=Menu.Separator; export const DropdownMenuCheckboxItem=Menu.CheckboxItem; export const DropdownMenuRadioItem=Menu.RadioItem
