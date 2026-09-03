import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
export function Input({ className,...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={cn('flex h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus-visible:ring-2 focus-visible:ring-[#d9a74e]',className)} {...props}/> }
