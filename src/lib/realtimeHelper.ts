/**
 * Realtime Helper — WebSocket Polling Fallback
 * ─────────────────────────────────────────────
 * Supabase Realtime uses WebSockets (wss://xxx.supabase.co) which are blocked
 * by Jio ISP DNS errors. HTTP REST calls are already proxied and work fine.
 *
 * This utility wraps Supabase channel subscriptions with automatic polling
 * fallback. If the WebSocket doesn't connect within WEBSOCKET_TIMEOUT_MS,
 * it falls back to polling via the HTTP proxy (which works on Jio).
 *
 * Usage:
 *   const unsub = subscribeWithFallback(
 *     'pharmacy-queue',
 *     () => supabase.channel('pharmacy-queue').on('postgres_changes', ...),
 *     () => fetchQueueFromDB(),   // called on each poll tick
 *     5000                        // poll every 5 seconds
 *   );
 *   return unsub; // call in useEffect cleanup
 */

import { RealtimeChannel } from '@supabase/supabase-js';

// How long to wait for WebSocket to connect before switching to polling
const WEBSOCKET_TIMEOUT_MS = 8000;

export type UnsubscribeFn = () => void;

interface SubscribeOptions {
    /** Channel name — used for logging only */
    name: string;
    /** Factory that creates and subscribes the Supabase realtime channel */
    channelFactory: () => RealtimeChannel;
    /** Fallback: called immediately + on every poll tick when WS is unavailable */
    pollFn: () => Promise<void> | void;
    /** Polling interval in ms (default: 5000) */
    pollIntervalMs?: number;
}

/**
 * Subscribe to Supabase realtime with automatic polling fallback for Jio/ISP-blocked networks.
 *
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
export function subscribeWithFallback({
    name,
    channelFactory,
    pollFn,
    pollIntervalMs = 5000,
}: SubscribeOptions): UnsubscribeFn {
    let channel: RealtimeChannel | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let wsTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let isPolling = false;
    let destroyed = false;

    const startPolling = () => {
        if (isPolling || destroyed) return;
        isPolling = true;
        console.log(`[Realtime:${name}] WebSocket unavailable — switching to HTTP polling every ${pollIntervalMs}ms`);

        // Run immediately, then on interval
        pollFn();
        pollTimer = setInterval(() => {
            if (!destroyed) pollFn();
        }, pollIntervalMs);
    };

    const stopPolling = () => {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        isPolling = false;
    };

    const cleanup = () => {
        destroyed = true;
        if (wsTimeoutTimer) clearTimeout(wsTimeoutTimer);
        stopPolling();
        if (channel) {
            channel.unsubscribe();
            channel = null;
        }
    };

    try {
        channel = channelFactory();

        // Start WS timeout — if channel doesn't reach SUBSCRIBED state in time, start polling
        wsTimeoutTimer = setTimeout(() => {
            if (destroyed) return;
            const state = channel?.state;
            if (state !== 'joined') {
                console.warn(`[Realtime:${name}] WebSocket not connected after ${WEBSOCKET_TIMEOUT_MS}ms (state: ${state}). Falling back to polling.`);
                startPolling();
            }
        }, WEBSOCKET_TIMEOUT_MS);

        channel.subscribe((status) => {
            if (destroyed) return;

            if (status === 'SUBSCRIBED') {
                // WebSocket connected — cancel polling if it was running
                if (wsTimeoutTimer) clearTimeout(wsTimeoutTimer);
                stopPolling();
                console.log(`[Realtime:${name}] WebSocket connected ✓`);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                console.warn(`[Realtime:${name}] WebSocket status: ${status} — switching to polling`);
                startPolling();
            }
        });
    } catch (err) {
        console.error(`[Realtime:${name}] Channel creation failed:`, err);
        startPolling();
    }

    return cleanup;
}

/**
 * Simple hook-friendly version: just polls via HTTP proxy.
 * Use this when you don't need real-time and just want periodic refresh.
 *
 * const stopPoll = startPolling(() => fetchData(), 5000);
 * return stopPoll; // useEffect cleanup
 */
export function startPolling(
    fn: () => Promise<void> | void,
    intervalMs: number
): UnsubscribeFn {
    fn(); // run immediately
    const timer = setInterval(fn, intervalMs);
    return () => clearInterval(timer);
}

/**
 * Returns true if we are likely on a network that blocks *.supabase.co directly.
 * Used to skip WebSocket attempts and go straight to polling.
 * Checks if we're in production AND on a network that previously had WS issues.
 */
export function isISPBlockedNetwork(): boolean {
    if (typeof window === 'undefined') return false;
    // Check local storage for a flag set when WebSocket consistently fails
    return window.localStorage.getItem('bh_ws_blocked') === 'true';
}

export function markNetworkAsBlocked(): void {
    try { window.localStorage.setItem('bh_ws_blocked', 'true'); } catch {}
}

export function clearNetworkBlockedFlag(): void {
    try { window.localStorage.removeItem('bh_ws_blocked'); } catch {}
}
