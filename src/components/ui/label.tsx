import type { LabelHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
export function Label({ className,...props }: LabelHTMLAttributes<HTMLElement>) { return <label className={cn('text-xs font-medium text-zinc-300',className)} {...props}/> }
