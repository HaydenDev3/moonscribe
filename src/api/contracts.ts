export type ApiErrorCode = 'AUTH_EXPIRED' | 'OFFLINE' | 'TIMEOUT' | 'RATE_LIMITED' | 'CONFLICT' | 'VALIDATION' | 'SERVER_ERROR' | 'UNKNOWN'

export type ApiErrorShape = { error?: string; code?: string; requestId?: string; retryAfterMs?: number }

export type SyncRecord = { store: string; id: string; novelId?: string; updatedAt: number; deleted?: boolean; payload?: unknown }

export type SyncPushResponse = { ok?: boolean; accepted?: string[]; rejected?: Array<{ key: string; reason: string }>; serverTime?: number; requestId?: string }
export type SyncPullResponse = { records: SyncRecord[]; serverTime: number; requestId?: string }

export type ShareFailureCode = 'INVITE_EXPIRED' | 'ACCESS_REVOKED' | 'HOST_NOT_SYNCED' | 'ROOM_OFFLINE' | 'PERMISSION_DENIED'
