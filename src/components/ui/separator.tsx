import type { HTMLAttributes } from 'react'
export function Separator({ className='', orientation='horizontal', ...props }: HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal'|'vertical' }) { return <div role="separator" className={`${orientation==='vertical'?'h-full w-px':'h-px w-full'} bg-white/10 ${className}`} {...props}/> }
