export type ClassValue = string | false | null | undefined | Record<string, boolean>
export function cn(...values: ClassValue[]) { return values.flatMap((value) => typeof value === 'string' ? value : value && typeof value === 'object' ? Object.entries(value).filter(([, enabled]) => enabled).map(([key]) => key) : []).join(' ') }
