export const UNKNOWN_SUPABASE_ERROR = 'Unknown Supabase channel error.';

export const describeSupabaseError = (payload: unknown): string => {
    if (!payload) return UNKNOWN_SUPABASE_ERROR;
    if (payload instanceof Error) return payload.message || UNKNOWN_SUPABASE_ERROR;
    if (typeof payload === 'string') return payload;
    if (typeof payload === 'number' || typeof payload === 'boolean') return String(payload);
    if (typeof payload === 'object') {
        const details = payload as Record<string, unknown>;
        const candidate = details.error ?? details.message ?? details.reason;
        if (candidate instanceof Error) return candidate.message || UNKNOWN_SUPABASE_ERROR;
        if (typeof candidate === 'string') return candidate;
        if (candidate && typeof candidate === 'object' && 'message' in candidate) {
            const nested = (candidate as { message?: unknown }).message;
            if (typeof nested === 'string') return nested;
        }
        try {
            return JSON.stringify(details);
        } catch {
            // fall through
        }
    }
    return UNKNOWN_SUPABASE_ERROR;
};

// Simple UUID v4 generator
export function generateUUIDv4(): string {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
        // Server-side fallback
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substring(2, 10);
        return `ssr-${timestamp}-${randomStr}`;
    }

    // Client-side implementation
    // Prefer native randomUUID when available
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }

    // Fallback using getRandomValues, else Math.random
    const bytes = new Uint8Array(16);
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        window.crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i += 1) bytes[i] = (Math.random() * 256) & 255;
    }
    // RFC 4122 variant + version
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    const b = Array.from(bytes, toHex).join('');
    return `${b.substring(0, 8)}-${b.substring(8, 12)}-${b.substring(12, 16)}-${b.substring(16, 20)}-${b.substring(20)}`;
}

export function buildRoomId(userA: string, userB: string, sessionMode: string): string {
    const sortedPair = [userA, userB].sort();
    const timestamp = Date.now().toString(36);
    const nonce = generateUUIDv4();
    return `${sortedPair.join(':')}:${sessionMode}:${timestamp}:${nonce}`;
}
