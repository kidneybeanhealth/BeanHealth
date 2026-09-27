/**
 * Connect shell — sign-in, then one screen per step of the pipeline:
 *
 *   Today       the worklist the protocol engine produces, and the calls
 *   Attendance  mark dialysis sessions, the engine's main input
 *   Patients    the list, added by hand or imported (CSV / Excel / WhatsApp)
 *   Alerts      red flags and callback requests from calls
 *   Reports     the dashboard and the monthly outcome report
 *   Settings    the protocol rules and who gets alerts
 */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useConnectSession } from './session';
import { ALERTS_CHANGED, fetchAlerts } from './services/alerts';
import { Button, Spinner, Wordmark, cx, readOperator, writeOperator } from './ui/kit';
import LoginScreen from './screens/LoginScreen';

const TodayScreen = lazy(() => import('./screens/TodayScreen'));
const AttendanceScreen = lazy(() => import('./screens/AttendanceScreen'));
const PatientsScreen = lazy(() => import('./screens/PatientsScreen'));
const AlertsScreen = lazy(() => import('./screens/AlertsScreen'));
const ReportsScreen = lazy(() => import('./screens/ReportsScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));

const TABS = [
    { to: '/today', label: 'Today' },
    { to: '/attendance', label: 'Attendance' },
    { to: '/patients', label: 'Patients' },
    { to: '/alerts', label: 'Alerts' },
    { to: '/reports', label: 'Reports' },
    { to: '/settings', label: 'Settings' },
];

const OperatorName: React.FC = () => {
    const [name, setName] = useState(readOperator());
    const [editing, setEditing] = useState(!readOperator());
    if (!editing) {
        return (
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-gray-500 hover:text-gray-800" title="Who is working — signs calls and attendance">
                Working: <span className="font-semibold text-gray-800">{name}</span>
            </button>
        );
    }
    return (
        <form
            onSubmit={e => { e.preventDefault(); if (name.trim()) { writeOperator(name); setEditing(false); } }}
            className="flex items-center gap-1.5"
        >
            <input
                value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                className="h-8 w-32 rounded-lg border border-gray-200 px-2 text-xs outline-none focus:border-[#5FA01F]"
            />
            <Button size="sm" tone="primary" type="submit" disabled={!name.trim()}>Save</Button>
        </form>
    );
};

const Shell: React.FC = () => {
    const { centre, signOut } = useConnectSession();
    const location = useLocation();
    const [openAlerts, setOpenAlerts] = useState(0);

    // The open-alert count is the one number that must be visible from every
    // tab: a red flag is not something to find by going to look for it.
    useEffect(() => {
        if (!centre) return;
        let alive = true;
        const tick = () => fetchAlerts(centre.id, { status: ['open'] })
            .then(a => { if (alive) setOpenAlerts(a.length); })
            .catch(() => { /* the Alerts screen reports its own errors */ });
        tick();
        const t = window.setInterval(tick, 60_000);
        window.addEventListener(ALERTS_CHANGED, tick);
        return () => { alive = false; window.clearInterval(t); window.removeEventListener(ALERTS_CHANGED, tick); };
    }, [centre, location.pathname]);

    return (
        <div className="min-h-screen bg-[#F7F8F5]">
            <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
                    <Wordmark />
                    {/* Its own line on a phone, where it would otherwise be squeezed to "S…". */}
                    <div className="order-last min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-1">
                        <p className="truncate text-sm font-bold text-gray-900">{centre?.name}</p>
                    </div>
                    <div className="flex-1 sm:hidden" />
                    <OperatorName />
                    <Button size="sm" tone="ghost" onClick={signOut}>Sign out</Button>
                </div>
                <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
                    {TABS.map(t => (
                        <NavLink
                            key={t.to} to={t.to}
                            className={({ isActive }) => cx(
                                'relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                                isActive ? 'bg-[#F0F9E6] text-[#3F7A12]' : 'text-gray-600 hover:bg-gray-100',
                            )}
                        >
                            {t.label}
                            {t.to === '/alerts' && openAlerts > 0 && (
                                <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                                    {openAlerts}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-5">
                <Suspense fallback={<Spinner label="Loading…" />}>
                    <Routes>
                        <Route path="/today" element={<TodayScreen />} />
                        <Route path="/attendance" element={<AttendanceScreen />} />
                        <Route path="/patients" element={<PatientsScreen />} />
                        <Route path="/alerts" element={<AlertsScreen />} />
                        <Route path="/reports" element={<ReportsScreen />} />
                        <Route path="/settings" element={<SettingsScreen />} />
                        <Route path="*" element={<Navigate to="/today" replace />} />
                    </Routes>
                </Suspense>
            </main>
        </div>
    );
};

const ConnectApp: React.FC = () => {
    const { status, centre, email, error, signOut, reloadCentre } = useConnectSession();

    useEffect(() => {
        document.title = centre && status === 'ready' ? `${centre.name} · BeanHealth Connect` : 'BeanHealth Connect';
    }, [centre, status]);

    if (status === 'loading') return <Spinner label="Opening Connect…" />;
    if (status === 'signed_out') {
        return (
            <Routes>
                <Route path="*" element={<LoginScreen />} />
            </Routes>
        );
    }
    if (status === 'wrong_product' || status === 'error') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F7F8F5] p-4">
                <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                    <div className="mb-4 flex justify-center"><Wordmark /></div>
                    {status === 'wrong_product' ? (
                        <>
                            <p className="text-base font-bold text-gray-900">This account is not a Connect centre</p>
                            <p className="mt-2 text-sm text-gray-600">
                                {email} is signed in{centre ? ` as ${centre.name}` : ''}, which uses a different BeanHealth product.
                                Sign in with your centre's Connect account.
                            </p>
                            <p className="mt-2 text-xs text-gray-400">Signing out here also signs this browser out of that account.</p>
                        </>
                    ) : (
                        <>
                            <p className="text-base font-bold text-gray-900">Could not open your centre</p>
                            <p className="mt-2 text-sm text-gray-600">{error}</p>
                        </>
                    )}
                    <div className="mt-5 flex justify-center gap-2">
                        {status === 'error' && <Button onClick={reloadCentre}>Try again</Button>}
                        <Button tone="primary" onClick={signOut}>Sign out</Button>
                    </div>
                </div>
            </div>
        );
    }
    return <Shell />;
};

export default ConnectApp;
