import type { HTMLAttributes } from 'react'
export function Badge({ className='', ...props }: HTMLAttributes<HTMLElement>) { return <span className={`inline-flex items-center rounded-full border border-white/10 bg-white/[.06] px-2.5 py-1 text-[10px] font-medium text-zinc-300 ${className}`} {...props}/> }
