import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn('rounded-2xl border border-white/10 bg-white/[.03] text-white shadow-xl',className)} {...props}/> }
export function CardHeader({ className,...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn('flex flex-col gap-2 p-6',className)} {...props}/> }
export function CardTitle({ className,...props }: HTMLAttributes<HTMLElement>) { return <h3 className={cn('font-heading text-xl font-semibold',className)} {...props}/> }
export function CardContent({ className,...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn('p-6 pt-0',className)} {...props}/> }
