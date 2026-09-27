/**
 * The Connect login — a lightweight session for one centre.
 *
 * Plain Supabase email + password, one account per centre, and nothing of the
 * main app's AuthProvider: no role routing, no onboarding, no terms flow. Once
 * signed in, the only question is "is this a Connect centre?" — a KKC reception
 * account signing in here is told so, rather than shown a dashboard built for
 * a different product.
 *
 * On connect.beanhealth.in the session is this origin's own. At /connect on a
 * preview or on beanhealth.in it shares the main app's storage, so the "wrong
 * product" screen says that signing out here signs out there too.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CONNECT_PRODUCTS, loadCentre, type Centre } from './services/centre';

type Status = 'loading' | 'signed_out' | 'wrong_product' | 'ready' | 'error';

interface SessionValue {
    status: Status;
    centre: Centre | null;
    email: string | null;
    error: string | null;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    reloadCentre: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export const ConnectSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<Status>('loading');
    const [centre, setCentre] = useState<Centre | null>(null);
    const [email, setEmail] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const userIdRef = useRef<string | null>(null);

    const resolve = useCallback(async (userId: string | null, userEmail: string | null) => {
        userIdRef.current = userId;
        setEmail(userEmail);
        if (!userId) { setCentre(null); setStatus('signed_out'); return; }
        try {
            const c = await loadCentre(userId);
            if (userIdRef.current !== userId) return; // signed out meanwhile
            if (!c || !CONNECT_PRODUCTS.includes(c.product)) { setCentre(c); setStatus('wrong_product'); return; }
            setCentre(c);
            setError(null);
            setStatus('ready');
        } catch (e: any) {
            setError(e?.message || 'Could not load the centre');
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        let alive = true;
        supabase.auth.getSession().then(({ data }) => {
            if (alive) resolve(data.session?.user?.id ?? null, data.session?.user?.email ?? null);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            // Token refreshes arrive constantly; only a change of user matters.
            if (event === 'TOKEN_REFRESHED' && session?.user?.id === userIdRef.current) return;
            resolve(session?.user?.id ?? null, session?.user?.email ?? null);
        });
        return () => { alive = false; sub.subscription.unsubscribe(); };
    }, [resolve]);

    const signIn = useCallback(async (em: string, password: string) => {
        const { error: e } = await supabase.auth.signInWithPassword({ email: em.trim(), password });
        if (e) throw new Error(e.message === 'Invalid login credentials' ? 'That email and password do not match a Connect centre.' : e.message);
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        resolve(null, null);
    }, [resolve]);

    const reloadCentre = useCallback(async () => {
        if (userIdRef.current) await resolve(userIdRef.current, email);
    }, [resolve, email]);

    return (
        <Ctx.Provider value={{ status, centre, email, error, signIn, signOut, reloadCentre }}>
            {children}
        </Ctx.Provider>
    );
};

export const useConnectSession = (): SessionValue => {
    const v = useContext(Ctx);
    if (!v) throw new Error('useConnectSession outside ConnectSessionProvider');
    return v;
};

/** The signed-in centre, for screens that only render once it is ready. */
export const useCentre = (): Centre => {
    const { centre } = useConnectSession();
    if (!centre) throw new Error('useCentre before the centre loaded');
    return centre;
};
