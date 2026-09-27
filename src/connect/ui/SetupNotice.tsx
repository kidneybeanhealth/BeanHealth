/**
 * What every screen shows when a load fails. A missing migration reads as one
 * clear instruction rather than "relation does not exist" on six screens.
 */
import React from 'react';
import { SetupRequiredError } from '../services/db';

export const SetupNotice: React.FC<{ error: unknown }> = ({ error }) =>
    error instanceof SetupRequiredError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <p className="font-bold">Connect is not set up on this database yet</p>
            <p className="mt-1">Run <code className="rounded bg-white px-1 font-mono text-xs">sql/20260927d_connect.sql</code> in Supabase, then reload.</p>
        </div>
    ) : (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
            {(error as any)?.message || 'Something went wrong.'}
        </div>
    );
