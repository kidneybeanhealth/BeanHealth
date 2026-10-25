/**
 * Which number a call rings from. Pure, so it is tested without Deno.
 *
 * Each number carries `perLine` calls at once. A number is busy while one of
 * its calls is placing or placed and under 10 minutes old: no agent call runs
 * that long, so an outcome that never arrived stops holding the number. Among
 * free numbers, the one that has rung least in the window wins, so the day's
 * calls spread across all of them. Ties go to the order they are configured.
 */
export interface LineUse {
    caller_line: string
    status: string
    created_at: string
}

export const BUSY_FOR_MS = 10 * 60_000

export function pickCallerLine(lines: string[], recent: LineUse[], perLine: number, now: number): string | null {
    const use = new Map(lines.map((l) => [l, { busy: 0, rung: 0 }]))
    for (const r of recent) {
        const u = use.get(r.caller_line)
        if (!u) continue
        u.rung += 1
        if ((r.status === 'placing' || r.status === 'placed') && Date.parse(r.created_at) >= now - BUSY_FOR_MS) u.busy += 1
    }
    const free = lines.filter((l) => use.get(l)!.busy < perLine)
    if (free.length === 0) return null
    return free.reduce((a, b) => (use.get(b)!.rung < use.get(a)!.rung ? b : a))
}
