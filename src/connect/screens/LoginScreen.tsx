/**
 * Sign in to a centre. One account per centre, created by BeanHealth — there is
 * no self sign-up, because a centre on Connect is a paying customer whose
 * voice-call number and protocol are set up with them first.
 */
import React, { useState } from 'react';
import { useConnectSession } from '../session';
import { Button, Field, Wordmark, inputCls } from '../ui/kit';

const LoginScreen: React.FC = () => {
    const { signIn } = useConnectSession();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await signIn(email, password);
        } catch (err: any) {
            setError(err?.message || 'Could not sign in');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#F0F9E6] via-white to-white px-4 py-10">
            <div className="w-full max-w-sm">
                <div className="mb-6 flex justify-center"><Wordmark /></div>
                <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h1 className="text-lg font-bold text-gray-900">Sign in to your centre</h1>
                    <p className="mt-1 text-xs text-gray-500">Follow-up calls for your patients, in their language.</p>
                    <div className="mt-5 space-y-3">
                        <Field label="Email">
                            <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                        </Field>
                        <Field label="Password">
                            <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
                        </Field>
                    </div>
                    {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
                    <Button tone="primary" type="submit" disabled={busy || !email || !password} className="mt-5 w-full">
                        {busy ? 'Signing in…' : 'Sign in'}
                    </Button>
                </form>
                <p className="mt-4 text-center text-[11px] text-gray-400">
                    Need an account for your centre? Write to harish@beanhealth.in
                </p>
            </div>
        </div>
    );
};

export default LoginScreen;
