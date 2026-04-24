/**
 * BeanHealth Drug Normalization Engine — 7-Step Pipeline
 *
 * Pipeline: raw prescription string
 *   → Step 1: Load
 *   → Step 2: Preprocess (form prefix, strength extraction, casing)
 *   → Step 3: Deduplicate & cluster variants
 *   → Step 4: Create canonical drugs
 *   → Step 5: Map variants (form normalisation)
 *   → Step 6: Entity resolution (local DB + combo expansion)
 *   → Step 7: Output structured JSON
 *
 * "Telma-AM 40/5 OD" → [{telmisartan, 40mg, ARB, C09CA07}, {amlodipine, 5mg, CCB, C08CA01}]
 */

import { buildComboMap, buildReferenceMap, INDIAN_DRUG_DATABASE } from '../data/indianDrugDatabase';
import { supabase } from '../lib/supabase';

/* ─── Public types ───────────────────────────────────────────────────────── */

export interface RawDrugEntry {
    raw_name: string;
    times_prescribed?: number;
}

export interface NormalizedDrug {
    raw_name: string;
    brand_name: string;
    form: string;
    strength: string;
    times_prescribed?: number;
}

export interface DrugVariant {
    strength: string;
    form: string;
    times_prescribed?: number;
}

/** A single resolved ingredient (used when a combo is expanded) */
export interface ResolvedIngredient {
    name: string;
    strength: string;      // e.g. "40 mg"
    category: string;
    atc_code: string;
}

export interface CanonicalDrug {
    id: string;
    name: string;
    variants: DrugVariant[];
    /** Populated after entity resolution */
    components: string[];
    /** Expanded ingredient list with per-ingredient strengths (combo-aware) */
    ingredients: ResolvedIngredient[];
    category: string | null;
    atc_code: string | null;
    renal_precaution: boolean;
    cdsco_schedule: string | null;
    review_status: 'approved' | 'pending_review';
    source_raws: string[];
    /** True when the brand resolved to a known combination product */
    is_combo: boolean;
}

export interface PipelineStep {
    step: number;
    name: string;
    status: 'idle' | 'running' | 'done' | 'error';
    count?: number;
    message?: string;
}

export interface PipelineResult {
    steps: PipelineStep[];
    normalized: NormalizedDrug[];
    canonical: CanonicalDrug[];
    resolvedCount: number;
    pendingReviewCount: number;
    logs: string[];
}

/* ─── Form prefix patterns ───────────────────────────────────────────────── */

const FORM_PREFIXES: Array<{ pattern: RegExp; form: string }> = [
    { pattern: /^(TABLET|TABS?)\.?\s+/i,           form: 'tablet' },
    { pattern: /^TAB\.?\s+/i,                      form: 'tablet' },
    { pattern: /^(CAPSULE|CAPS?)\.?\s+/i,          form: 'capsule' },
    { pattern: /^CAP\.?\s+/i,                      form: 'capsule' },
    { pattern: /^(INJECTION|INJECT|INJ)\.?\s+/i,   form: 'injection' },
    { pattern: /^(SYRUP|SYP|SYR)\.?\s+/i,         form: 'syrup' },
    { pattern: /^(SUSPENSION|SUSP)\.?\s+/i,        form: 'suspension' },
    { pattern: /^(CREAM|CRM)\.?\s+/i,              form: 'cream' },
    { pattern: /^(OINTMENT|OINT)\.?\s+/i,          form: 'ointment' },
    { pattern: /^GEL\.?\s+/i,                      form: 'gel' },
    { pattern: /^(DROPS?|DRP)\.?\s+/i,             form: 'drops' },
    { pattern: /^SACHET\.?\s+/i,                   form: 'sachet' },
    { pattern: /^PATCH\s+/i,                       form: 'patch' },
    { pattern: /^SPRAY\s+/i,                       form: 'spray' },
    { pattern: /^LOTION\.?\s+/i,                   form: 'lotion' },
    { pattern: /^(SOLUTION|SOLN?)\.?\s+/i,         form: 'solution' },
    { pattern: /^(POWDER|PWDR?)\.?\s+/i,           form: 'powder' },
    { pattern: /^(VIAL|AMP|AMPOULE)\.?\s+/i,      form: 'injection' },
    { pattern: /^(INHALER|INH)\.?\s+/i,            form: 'inhaler' },
    { pattern: /^(SUPPOSITORY|SUPP)\.?\s+/i,       form: 'suppository' },
    { pattern: /^ENEMA\s+/i,                       form: 'enema' },
];

const MODIFIER_TOKENS = new Set([
    'SR', 'ER', 'XR', 'CR', 'MR', 'XL', 'LA', 'OD', 'BD', 'TDS', 'QID',
    'FORTE', 'PLUS', 'DS', 'MD', 'ODT', 'DT',
]);

const STRENGTH_REGEX = /(\d+(?:\.\d+)?)\s*(MG\/ML|MCG\/ML|MG\/5ML|MG|MCG|GM?|ML|IU|MEQ|UNITS?|%)/gi;

/* ─── Step 1: Load ───────────────────────────────────────────────────────── */

export function step1_load(rawList: RawDrugEntry[]): { entries: RawDrugEntry[]; log: string } {
    const entries = rawList.filter(e => e.raw_name?.trim().length > 0);
    return { entries, log: `[Step 1] Loaded ${entries.length} raw drug entries.` };
}

/* ─── Step 2: Preprocess ─────────────────────────────────────────────────── */

export function step2_preprocess(entries: RawDrugEntry[]): { normalized: NormalizedDrug[]; log: string } {
    const results: NormalizedDrug[] = [];

    for (const entry of entries) {
        try {
            const raw = entry.raw_name.trim().toUpperCase();
            let working = raw;
            let form = 'unknown';

            for (const { pattern, form: detectedForm } of FORM_PREFIXES) {
                if (pattern.test(working)) {
                    working = working.replace(pattern, '').trim();
                    form = detectedForm;
                    break;
                }
            }

            const strengthMatches = [...working.matchAll(STRENGTH_REGEX)];
            let strength = '';
            if (strengthMatches.length > 0) {
                strength = strengthMatches.map(m => `${m[1]} ${m[2].toUpperCase()}`).join(' + ');
                working = working.replace(STRENGTH_REGEX, '').trim().replace(/\s{2,}/g, ' ').replace(/[,\s/]+$/, '').trim();
            } else {
                // Also capture bare ratio like "40/5" (no unit) as strength
                const ratioMatch = working.match(/\b(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\b/);
                if (ratioMatch) {
                    strength = `${ratioMatch[1]} mg + ${ratioMatch[2]} mg`;
                    working = working.replace(ratioMatch[0], '').trim().replace(/\s{2,}/g, ' ').trim();
                }
            }

            // Strip trailing modifier tokens
            const tokenised = working.split(/[\s\-_]+/).filter(Boolean);
            const brandTokens = tokenised.filter(t => !MODIFIER_TOKENS.has(t.toUpperCase()));
            working = brandTokens.join(' ');

            const brandName = working
                .split(/\s+/)
                .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(' ');

            results.push({ raw_name: entry.raw_name, brand_name: brandName, form, strength, times_prescribed: entry.times_prescribed });
        } catch {
            results.push({ raw_name: entry.raw_name, brand_name: entry.raw_name, form: 'unknown', strength: '', times_prescribed: entry.times_prescribed });
        }
    }

    return {
        normalized: results,
        log: `[Step 2] Preprocessed ${results.length} entries. Forms: ${[...new Set(results.map(r => r.form))].join(', ')}`,
    };
}

/* ─── Step 3: Cluster ────────────────────────────────────────────────────── */

export interface ClusteredGroup {
    brand_name: string;
    entries: NormalizedDrug[];
}

export function step3_cluster(normalized: NormalizedDrug[]): { groups: ClusteredGroup[]; log: string } {
    const map = new Map<string, NormalizedDrug[]>();
    for (const nd of normalized) {
        const key = nd.brand_name.toUpperCase().replace(/[\s-]+/g, '_');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(nd);
    }
    const groups: ClusteredGroup[] = [];
    map.forEach((entries, key) => groups.push({ brand_name: key, entries }));
    const dupes = groups.filter(g => g.entries.length > 1).length;
    return { groups, log: `[Step 3] ${groups.length} unique clusters. ${dupes} had multiple variants.` };
}

/* ─── Step 4: Canonical ──────────────────────────────────────────────────── */

export function step4_canonical(groups: ClusteredGroup[]): { canonical: CanonicalDrug[]; log: string } {
    const canonical: CanonicalDrug[] = groups.map(g => {
        const first = g.entries[0];
        const variants: DrugVariant[] = g.entries.map(e => ({ strength: e.strength || 'unspecified', form: e.form, times_prescribed: e.times_prescribed }));
        const seen = new Set<string>();
        const unique = variants.filter(v => { const k = `${v.strength}|${v.form}`; if (seen.has(k)) return false; seen.add(k); return true; });
        return {
            id: first.brand_name.toUpperCase().replace(/[\s-]+/g, '_'),
            name: first.brand_name,
            variants: unique,
            components: [],
            ingredients: [],
            category: null,
            atc_code: null,
            renal_precaution: false,
            cdsco_schedule: null,
            review_status: 'pending_review' as const,
            source_raws: g.entries.map(e => e.raw_name),
            is_combo: false,
        };
    });
    return { canonical, log: `[Step 4] Created ${canonical.length} canonical entries.` };
}

/* ─── Step 5: Map variants ───────────────────────────────────────────────── */

export function step5_mapVariants(canonical: CanonicalDrug[]): { canonical: CanonicalDrug[]; log: string } {
    const updated = canonical.map(drug => ({
        ...drug,
        variants: drug.variants.map(v => ({ ...v, form: v.form === 'unknown' ? 'unspecified' : v.form })),
    }));
    return { canonical: updated, log: `[Step 5] Mapped ${updated.reduce((s, d) => s + d.variants.length, 0)} variants.` };
}

/* ─── Step 6: Entity resolution + combo expansion ────────────────────────── */

export function step6_resolve(
    canonical: CanonicalDrug[],
    _refDB: unknown  // kept for API compat — resolution uses local maps
): { canonical: CanonicalDrug[]; resolvedCount: number; log: string } {
    const refMap = buildReferenceMap();
    const comboMap = buildComboMap();
    let resolvedCount = 0;

    const updated = canonical.map(drug => {
        const id = drug.id;

        /* 1. Combo expansion */
        const combo = comboMap.get(id);
        if (combo) {
            const firstVariant = drug.variants[0]?.strength || '';
            const numericParts = firstVariant.match(/\d+(?:\.\d+)?/g) ?? [];
            const ingredients: ResolvedIngredient[] = combo.ingredients.map((ing, idx) => ({
                name: ing.name,
                strength: numericParts[idx] ? `${numericParts[idx]} mg` : 'unspecified',
                category: ing.category,
                atc_code: ing.atc_code,
            }));
            resolvedCount++;
            return { ...drug, components: combo.ingredients.map(i => i.name), ingredients, category: combo.ingredients[0]?.category ?? null, atc_code: combo.ingredients[0]?.atc_code ?? null, renal_precaution: false, review_status: 'approved' as const, is_combo: true };
        }

        /* 2. Direct lookup */
        const refEntry = refMap.get(id) ?? refMap.get(id.split('_')[0]);
        if (refEntry) {
            resolvedCount++;
            const strength = drug.variants[0]?.strength || 'unspecified';
            return { ...drug, components: refEntry.components, ingredients: refEntry.components.map(c => ({ name: c, strength, category: refEntry.category, atc_code: refEntry.atc_code ?? '' })), category: refEntry.category, atc_code: refEntry.atc_code ?? null, renal_precaution: refEntry.renal_precaution ?? false, cdsco_schedule: refEntry.cdsco_schedule ?? null, review_status: 'approved' as const, is_combo: false };
        }

        /* 3. Fuzzy prefix match */
        const prefix = id.split('_')[0];
        if (prefix.length >= 4) {
            for (const [key, ref] of refMap.entries()) {
                if (key.startsWith(prefix) || prefix.startsWith(key.slice(0, Math.min(key.length, 5)))) {
                    resolvedCount++;
                    const strength = drug.variants[0]?.strength || 'unspecified';
                    return { ...drug, components: ref.components, ingredients: ref.components.map(c => ({ name: c, strength, category: ref.category, atc_code: ref.atc_code ?? '' })), category: ref.category, atc_code: ref.atc_code ?? null, renal_precaution: ref.renal_precaution ?? false, cdsco_schedule: ref.cdsco_schedule ?? null, review_status: 'approved' as const, is_combo: false };
                }
            }
        }

        return drug;
    });

    return { canonical: updated, resolvedCount, log: `[Step 6] Resolved ${resolvedCount}/${canonical.length} drugs.` };
}

/* ─── Step 7: Output ─────────────────────────────────────────────────────── */

export function step7_output(canonical: CanonicalDrug[]): { log: string } {
    const approved = canonical.filter(d => d.review_status === 'approved').length;
    const pending = canonical.filter(d => d.review_status === 'pending_review').length;
    return { log: `[Step 7] Done. ${approved} approved, ${pending} pending review.` };
}

/* ─── Full pipeline runner ───────────────────────────────────────────────── */

const tick = () => new Promise(r => setTimeout(r, 60));

export async function runPipeline(
    rawList: RawDrugEntry[],
    onStepComplete?: (step: PipelineStep, log: string) => void
): Promise<PipelineResult> {
    const logs: string[] = [];
    const refDB = INDIAN_DRUG_DATABASE.map(e => ({ brand_name: e.display_name, generic_name: e.generic_name, category: e.category, components: e.components, atc_code: e.atc_code, renal_precaution: e.renal_precaution, cdsco_schedule: e.cdsco_schedule }));

    const steps: PipelineStep[] = [
        { step: 1, name: 'Load raw drug list', status: 'idle' },
        { step: 2, name: 'Preprocess all entries', status: 'idle' },
        { step: 3, name: 'Deduplicate & cluster', status: 'idle' },
        { step: 4, name: 'Create canonical drugs', status: 'idle' },
        { step: 5, name: 'Map variants', status: 'idle' },
        { step: 6, name: 'Run entity resolution', status: 'idle' },
        { step: 7, name: 'Output final JSON', status: 'idle' },
    ];

    const report = (idx: number, count: number, log: string) => {
        steps[idx] = { ...steps[idx], status: 'done', count };
        logs.push(log);
        onStepComplete?.({ ...steps[idx] }, log);
    };

    steps[0].status = 'running'; await tick();
    const { entries, log: l1 } = step1_load(rawList);
    report(0, entries.length, l1);

    steps[1].status = 'running'; await tick();
    const { normalized, log: l2 } = step2_preprocess(entries);
    report(1, normalized.length, l2);

    steps[2].status = 'running'; await tick();
    const { groups, log: l3 } = step3_cluster(normalized);
    report(2, groups.length, l3);

    steps[3].status = 'running'; await tick();
    const { canonical: c4, log: l4 } = step4_canonical(groups);
    report(3, c4.length, l4);

    steps[4].status = 'running'; await tick();
    const { canonical: c5, log: l5 } = step5_mapVariants(c4);
    report(4, c5.reduce((s, d) => s + d.variants.length, 0), l5);

    steps[5].status = 'running'; await tick();
    const { canonical: c6, resolvedCount: localResolved, log: l6 } = step6_resolve(c5, refDB);
    report(5, localResolved, l6);

    // Supabase fallback — query reference_drugs for brands still unresolved after local pass
    let finalCanonical = c6;
    let resolvedCount = localResolved;
    const stillPending = c6.filter(d => d.review_status === 'pending_review');
    if (stillPending.length > 0) {
        try {
            const pendingNames = stillPending.map(d => d.name);
            const { data: remoteMatches } = await (supabase.from('reference_drugs') as any)
                .select('brand_name, generic_name, category, atc_code, components, cdsco_schedule, renal_precaution')
                .in('brand_name', pendingNames);

            if (remoteMatches && remoteMatches.length > 0) {
                const remoteMap = new Map(remoteMatches.map((r: any) => [r.brand_name.toUpperCase(), r]));
                finalCanonical = c6.map(drug => {
                    if (drug.review_status === 'approved') return drug;
                    const ref = remoteMap.get(drug.name.toUpperCase()) as any;
                    if (!ref) return drug;
                    resolvedCount++;
                    const strength = drug.variants[0]?.strength || 'unspecified';
                    const comps: string[] = Array.isArray(ref.components) ? ref.components : (ref.generic_name ? [ref.generic_name] : []);
                    return {
                        ...drug,
                        components: comps,
                        ingredients: comps.map((c: string) => ({ name: c, strength, category: ref.category ?? '', atc_code: ref.atc_code ?? '' })),
                        category: ref.category ?? null,
                        atc_code: ref.atc_code ?? null,
                        renal_precaution: ref.renal_precaution ?? false,
                        cdsco_schedule: ref.cdsco_schedule ?? null,
                        review_status: 'approved' as const,
                        is_combo: false,
                    };
                });
                logs.push(`[Step 6+] Supabase fallback resolved ${remoteMatches.length} additional drug(s).`);
            }
        } catch { /* non-critical — continue with local results */ }
    }

    steps[6].status = 'running'; await tick();
    const { log: l7 } = step7_output(finalCanonical);
    report(6, finalCanonical.length, l7);

    return { steps, normalized, canonical: finalCanonical, resolvedCount, pendingReviewCount: finalCanonical.filter(d => d.review_status === 'pending_review').length, logs };
}
