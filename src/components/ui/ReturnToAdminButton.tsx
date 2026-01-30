/**
 * ReturnToAdminButton Component
 * 
 * A floating button that appears when an admin is impersonating another user.
 * Allows the admin to return to their original session.
 */

import React, { useState } from 'react'
import { ImpersonationService } from '../../services/impersonationService'

const ReturnToAdminButton: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)

    const state = ImpersonationService.getState()

    if (!state?.isImpersonating) {
        return null
    }

    const handleReturn = async () => {
        setIsLoading(true)
        const result = await ImpersonationService.endImpersonation()
        if (!result.success) {
            alert(`Failed to return to admin: ${result.error}`)
            setIsLoading(false)
        }
        // If successful, the page will reload
    }

    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-6 right-6 z-[100] p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-105"
                title="Show impersonation controls"
            >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
            </button>
        )
    }

    return (
        <div className="fixed bottom-6 right-6 z-[100] animate-fade-in">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl shadow-2xl p-4 max-w-sm border border-amber-400/50">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/20 rounded-lg">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <span className="text-white font-semibold text-sm">Impersonating</span>
                    </div>
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                        title="Minimize"
                    >
                        <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                {/* User Info */}
                <div className="bg-white/10 rounded-xl p-3 mb-3">
                    <p className="text-white/80 text-xs mb-1">Viewing as:</p>
                    <p className="text-white font-semibold truncate">{state.targetName}</p>
                    <p className="text-white/70 text-sm truncate">{state.targetEmail}</p>
                    <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${state.targetRole === 'patient'
                            ? 'bg-rose-500/30 text-rose-100'
                            : 'bg-blue-500/30 text-blue-100'
                        }`}>
                        {state.targetRole}
                    </span>
                </div>

                {/* Return Button */}
                <button
                    onClick={handleReturn}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-100 text-amber-600 font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Returning...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                            </svg>
                            <span>Return to Admin</span>
                        </>
                    )}
                </button>

                {/* Admin info footnote */}
                <p className="text-white/60 text-xs mt-2 text-center">
                    Logged in as: {state.adminName}
                </p>
            </div>
        </div>
    )
}

export default ReturnToAdminButton
