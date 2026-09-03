import type { ImgHTMLAttributes, HTMLAttributes } from 'react'
export function Avatar({ className='', ...props }: HTMLAttributes<HTMLElement>) { return <span className={`relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full ${className}`} {...props}/> }
export function AvatarImage(props: ImgHTMLAttributes<HTMLImageElement>) { return <img className="aspect-square h-full w-full object-cover" {...props}/> }
export function AvatarFallback({ className='', ...props }: HTMLAttributes<HTMLElement>) { return <span className={`flex h-full w-full items-center justify-center bg-[#b68736] text-sm text-black ${className}`} {...props}/> }
