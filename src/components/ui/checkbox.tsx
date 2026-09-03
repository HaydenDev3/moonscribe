import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className='', type='checkbox', ...props }, ref) => <input ref={ref} type={type} className={`h-4 w-4 rounded border-white/20 accent-[#d9a74e] focus-visible:ring-2 focus-visible:ring-[#d9a74e] ${className}`} {...props}/>); Checkbox.displayName='Checkbox'
