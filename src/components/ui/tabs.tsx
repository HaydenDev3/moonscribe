import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
export function Tabs({ className='', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={className} {...props}/> }
export function TabsList({ className='', ...props }: HTMLAttributes<HTMLDivElement>) { return <div role="tablist" className={`inline-flex items-center rounded-xl bg-black/25 p-1 ${className}`} {...props}/> }
export function TabsTrigger({ className='', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button role="tab" className={`min-h-9 rounded-lg px-3 text-xs text-zinc-500 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9a74e] ${className}`} {...props}/> }
export function TabsContent({ className='', ...props }: HTMLAttributes<HTMLDivElement>) { return <div role="tabpanel" className={className} {...props}/> }
