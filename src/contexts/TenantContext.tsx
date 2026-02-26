import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface HospitalConfig {
    prescription: 'kkc' | 'standard' | string;
    receipt: 'kkc' | 'standard' | string;
    show_religious_header: boolean;
    religious_header_text?: string | null;
    enable_bilingual_prescription: boolean;
    doctor_sort_order: string[];
}

export interface HospitalProfile {
    id: string;
    // Old columns — kept as-is since live code writes to these
    hospital_name: string;
    contact_number: string | null;
    // New multi-tenant columns
    display_name: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    emergency_phone: string | null;
    working_hours: string | null;
    avatar_url: string | null;
    primary_color: string;
    footer_phone: string | null;
    footer_instagram: string | null;
    setup_completed: boolean;
    config: HospitalConfig;
}

// Fallback config — used only if DB row is missing or fetch fails for a new hospital
const DEFAULT_CONFIG: HospitalConfig = {
    prescription: 'standard',
    receipt: 'standard',
    show_religious_header: false,
    religious_header_text: null,
    enable_bilingual_prescription: false,
    doctor_sort_order: [],
};

// Helper: get the best available display name (prefers new display_name, falls back to hospital_name)
export function getTenantDisplayName(tenant: HospitalProfile): string {
    return tenant.display_name || tenant.hospital_name || '';
}

// Helper: get the best available phone (prefers new phone, falls back to contact_number)
export function getTenantPhone(tenant: HospitalProfile): string {
    return tenant.phone || tenant.contact_number || '';
}

// ── Context ────────────────────────────────────────────────────────────────────
interface TenantContextType {
    tenant: HospitalProfile | null;
    loading: boolean;
    refetch: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({
    tenant: null,
    loading: true,
    refetch: async () => {},
});

export const useTenant = () => useContext(TenantContext);

// ── Provider ────────────────────────────────────────────────────────────────────
interface TenantProviderProps {
    hospitalId: string;
    children: React.ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ hospitalId, children }) => {
    const [tenant, setTenant] = useState<HospitalProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async () => {
        if (!hospitalId) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('hospital_profiles')
                .select('*')
                .eq('id', hospitalId)
                .single();

            if (error || !data) {
                console.error('[TenantContext] Failed to load hospital profile:', error?.message);
                setLoading(false);
                return;
            }

            // Merge DB config with defaults to fill any missing fields gracefully
            const mergedProfile: HospitalProfile = {
                ...(data as Record<string, unknown>),
                primary_color: (data as any).primary_color ?? '#1a56db',
                config: { ...DEFAULT_CONFIG, ...((data as any).config ?? {}) },
            } as HospitalProfile;

            setTenant(mergedProfile);
        } catch (err) {
            console.error('[TenantContext] Unexpected error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hospitalId]);

    return (
        <TenantContext.Provider value={{ tenant, loading, refetch: fetchProfile }}>
            {children}
        </TenantContext.Provider>
    );
};
