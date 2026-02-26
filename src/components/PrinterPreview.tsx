import React, { useState, useEffect } from 'react';
import { HospitalProfile, getTenantDisplayName, getTenantPhone } from '../contexts/TenantContext';

export interface PrinterPreviewData {
    hospitalName?: string;
    tokenNumber: string;
    patientName: string;
    mrNumber?: string;
    doctorName: string;
    department?: string;
    date: string;
    time: string;
    settings?: {
        spacing: number;
        alignment: 'left' | 'center' | 'right';
    };
}

interface PrinterPreviewProps {
    data: PrinterPreviewData;
    tenant?: HospitalProfile | null;
    isSandbox?: boolean;
    onSettingsChange?: (settings: { spacing: number; alignment: 'left' | 'center' | 'right' }) => void;
    isSaving?: boolean;
}

const PrinterPreview: React.FC<PrinterPreviewProps> = ({
    data,
    tenant,
    isSandbox = false,
    onSettingsChange,
    isSaving = false
}) => {
    // Rugtek BP02 Constants:
    // Printing width: 48mm = 384 dots
    // Standard char (Font A): 12x24 dots -> 32 characters per line

    // Local state to decoupled live preview from backend persistence
    const [localSettings, setLocalSettings] = useState(data.settings || { spacing: 1, alignment: 'center' });

    // Sync with external settings prop changes
    useEffect(() => {
        if (data.settings) {
            setLocalSettings(data.settings);
        }
    }, [data.settings]);

    const dividerDouble = "=".repeat(32);
    const dividerSingle = "-".repeat(32);

    const formatDoctorName = (name: string) => {
        if (!name) return "";
        let cleanName = name.replace(/^(dr\.?\s*)/i, "").trim();
        return `Dr. ${cleanName}`;
    };

    // Clean token number
    const tokenDisplay = data.tokenNumber.replace(/^[A-Za-z-]+/, '');
    // Spaced token based on LOCAL settings for instant feedback
    const spacer = " ".repeat(localSettings.spacing);
    const spacedToken = tokenDisplay.split('').join(spacer);

    return (
        <div className={`flex flex-col items-center w-full ${isSandbox ? 'my-2' : ''}`}>
            {isSandbox && (
                <div className="w-full max-w-[384px] mb-4 space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <h4 className="text-xs font-bold text-gray-700 uppercase">Layout Controls</h4>
                            <p className="text-[8px] text-gray-400">Settings save to backend</p>
                        </div>
                        {onSettingsChange && (
                            <button
                                onClick={() => onSettingsChange(localSettings)}
                                disabled={isSaving}
                                className="px-3 py-1 bg-green-600 text-white text-[10px] font-bold rounded-lg shadow hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-2 h-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : 'Save Layout'}
                            </button>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Digit Spacing ({localSettings.spacing} spaces)</label>
                                <span className="text-[10px] font-mono text-gray-400">{localSettings.spacing * 12} dots</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="8"
                                value={localSettings.spacing}
                                onChange={(e) => setLocalSettings({ ...localSettings, spacing: parseInt(e.target.value) })}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Token Alignment</label>
                            <div className="flex gap-2">
                                {(['left', 'center', 'right'] as const).map((align) => (
                                    <button
                                        key={align}
                                        onClick={() => setLocalSettings({ ...localSettings, alignment: align })}
                                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${localSettings.alignment === align
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        {align.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* The "Paper" Container */}
            <div className="relative group">
                {/* Visual width guide for 58mm */}
                <div className="absolute -top-6 left-0 right-0 flex justify-between items-center px-1 text-[8px] text-gray-400 uppercase tracking-tighter pointer-events-none">
                    <span>| Start (0)</span>
                    <span className="h-[1px] flex-1 bg-gray-200 mx-1"></span>
                    <span>384 Dots (48mm)</span>
                    <span className="h-[1px] flex-1 bg-gray-200 mx-1"></span>
                    <span>End (384) |</span>
                </div>

                {/* The "Paper" */}
                <div
                    style={{ width: '384px' }}
                    className="bg-[#fafafa] shadow-xl border border-gray-300 p-4 font-mono text-black overflow-hidden relative"
                >
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-gray-100/5 to-transparent opacity-50" />

                    <div className="relative z-10 space-y-0 leading-none" style={{ fontSize: '12px' }}>

                        {/* Header */}
                        {tenant ? (
                            tenant.config?.show_religious_header && tenant.config?.religious_header_text ? (
                                <div className="text-center w-full uppercase py-1">
                                    {tenant.config.religious_header_text}
                                </div>
                            ) : null
                        ) : (
                            <div className="text-center w-full uppercase py-1">
                                ~~~ Om Muruga ~~~
                            </div>
                        )}
                        <div className="text-center w-full font-extrabold py-1">
                            {tenant ? getTenantDisplayName(tenant).toUpperCase() : (data.hospitalName || 'KONGUNAD KIDNEY CENTRE')}
                        </div>

                        <div className="text-center w-full py-1 text-xs">
                            {dividerDouble}
                        </div>

                        {/* Token Number - Dynamic Alignment & Spacing */}
                        <div className="py-6 flex flex-col w-full">
                            <div
                                className="font-bold whitespace-pre w-full"
                                style={{
                                    fontSize: '48px',
                                    lineHeight: '1',
                                    textAlign: localSettings.alignment as any,
                                    transform: 'scaleY(1.2)',
                                    transformOrigin: localSettings.alignment
                                }}
                            >
                                {spacedToken}
                            </div>
                        </div>

                        <div className="text-center w-full py-1 text-xs">{dividerSingle}</div>

                        {/* Details */}
                        <div className="space-y-1 text-left px-1">
                            <div><span className="font-bold">Patient: </span>{data.patientName}</div>
                            {data.mrNumber && <div><span className="font-bold">MR. NO: </span>{data.mrNumber}</div>}
                            <div><span className="font-bold">Doctor: </span>{formatDoctorName(data.doctorName)}</div>
                        </div>

                        <div className="text-center w-full py-1 text-xs">{dividerSingle}</div>
                        <div className="text-center w-full py-1">{data.date}  {data.time}</div>
                        <div className="text-center w-full py-1 text-xs">{dividerDouble}</div>

                        <div className="text-center w-full space-y-1 py-1">
                            <div>For feedback &amp; queries</div>
                            <div className="font-bold">Ph: {tenant ? getTenantPhone(tenant) : '8056391682'}</div>
                            {(tenant ? tenant.footer_instagram : '@kongunad_kidney_centre') && (
                                <div>IG: {tenant ? tenant.footer_instagram : '@kongunad_kidney_centre'}</div>
                            )}
                        </div>

                        <div className="text-center w-full py-1 text-xs">{dividerDouble}</div>
                        <div className="text-center w-full pt-2 opacity-60">BeanHealth</div>

                        <div className="h-12 w-full flex items-center justify-center">
                            <div className="w-full border-b border-dashed border-gray-300 relative">
                                <span className="absolute left-1/2 -translate-x-1/2 -top-2 px-2 bg-[#fafafa] text-[8px] text-gray-400 uppercase font-sans">
                                    (Partial Cut)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isSandbox && (
                <div className="mt-2 text-[10px] text-gray-400 italic">
                    Width: 384 dots (48mm printable / 58mm paper)
                </div>
            )}
        </div>
    );
};

export default PrinterPreview;
