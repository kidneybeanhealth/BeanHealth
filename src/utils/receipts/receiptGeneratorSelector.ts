/**
 * Receipt Generator Selector — The Traffic Cop
 * ─────────────────────────────────────────────
 * Reads tenant.config.receipt and returns the correct receipt bytes.
 *
 * To add a new hospital receipt:
 *   1. Create `utils/receipts/yourHospitalReceiptGenerator.ts`
 *   2. Add one `case 'your_key':` below
 *   3. Set config->>'receipt' = 'your_key' for that hospital in DB
 */

import { HospitalProfile } from '../../contexts/TenantContext';
import { TokenData } from '../tokenReceiptGenerator';
import { generateKKCReceipt } from './kkcReceiptGenerator';
import { generateStandardReceipt } from './standardReceiptGenerator';

export function getReceiptBytes(data: TokenData, tenant: HospitalProfile | null): Uint8Array {
    const template = tenant?.config?.receipt ?? 'standard';

    switch (template) {
        case 'kkc':
            return generateKKCReceipt(data);

        // ── ADD NEW HOSPITALS HERE ─────────────────────────────────────────
        // case 'hospital_xyz':
        //     return generateHospitalXYZReceipt(data, tenant!);
        // ──────────────────────────────────────────────────────────────────

        case 'standard':
        default:
            // If tenant is null (profile not loaded yet), use a minimal fallback
            if (!tenant) {
                return generateKKCReceipt(data); // safe KKC fallback
            }
            return generateStandardReceipt(data, tenant);
    }
}
