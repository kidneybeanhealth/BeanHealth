/**
 * Doctor Sort Strategy
 * ────────────────────
 * Sorts a list of doctor names according to the order configured in DB.
 * Config field: hospital_profiles.config->>'doctor_sort_order'
 *
 * Example DB value: ["prabhakar", "divakar"]
 * → Dr. Prabhakar and Dr. Divakar appear first, rest are sorted alphabetically.
 *
 * KKC config already has: { "doctor_sort_order": ["prabhakar", "divakar"] }
 * so KKC's sort behavior is identical to what it was before.
 */

export interface DoctorItem {
    id: string;
    name: string;
    [key: string]: unknown;
}

/**
 * Sort doctors: pinned doctors (from sortOrder) appear first, in order.
 * Remaining doctors are sorted alphabetically.
 *
 * @param doctors     Array of doctor objects with a `name` property
 * @param sortOrder   Array of lowercase name fragments to pin, e.g. ["prabhakar", "divakar"]
 * @returns           Sorted copy of the doctors array
 */
export function sortDoctors<T extends DoctorItem>(doctors: T[], sortOrder: string[]): T[] {
    if (!sortOrder || sortOrder.length === 0) {
        // No config → simple alphabetical sort
        return [...doctors].sort((a, b) => a.name.localeCompare(b.name));
    }

    const pinned: T[] = [];
    const rest: T[] = [];

    for (const doctor of doctors) {
        const lowerName = doctor.name.toLowerCase();
        const pinnedIndex = sortOrder.findIndex(fragment => lowerName.includes(fragment));
        if (pinnedIndex !== -1) {
            pinned[pinnedIndex] = doctor; // preserve configured order
        } else {
            rest.push(doctor);
        }
    }

    // Remove undefined slots (in case a configured name isn't present in DB)
    const cleanPinned = pinned.filter(Boolean);
    const cleanRest   = rest.sort((a, b) => a.name.localeCompare(b.name));

    return [...cleanPinned, ...cleanRest];
}
