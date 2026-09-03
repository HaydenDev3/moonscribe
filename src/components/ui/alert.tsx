import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div role="status" className={cn('relative rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm text-zinc-200',className)} {...props}/> }
export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLElement>) { return <h5 className={cn('mb-1 font-semibold',className)} {...props}/> }
export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLElement>) { return <div className={cn('text-xs leading-relaxed text-zinc-400',className)} {...props}/> }
