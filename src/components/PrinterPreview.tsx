import React from 'react';

export interface PrinterPreviewData {
    hospitalName?: string;
    tokenNumber: string;
    patientName: string;
    mrNumber?: string;
    doctorName: string;
    department?: string;
    date: string;
    time: string;
}

interface PrinterPreviewProps {
    data: PrinterPreviewData;
    isSandbox?: boolean;
}

const PrinterPreview: React.FC<PrinterPreviewProps> = ({ data, isSandbox = false }) => {
    // Rugtek BP02 Constants:
    // Printing width: 48mm = 384 dots
    // Standard char (Font A): 12x24 dots -> 32 characters per line

    const dividerDouble = "=".repeat(32);
    const dividerSingle = "-".repeat(32);

    const formatDoctorName = (name: string) => {
        if (!name) return "";
        let cleanName = name.replace(/^(dr\.?\s*)/i, "").trim();
        return `Dr. ${cleanName}`;
    };

    // Clean token number
    const tokenDisplay = data.tokenNumber.replace(/^[A-Za-z-]+/, '');
    // Spaced token (matches tokenReceiptGenerator.ts)
    const spacedToken = tokenDisplay.split('').join('  ');

    return (
        <div className={`flex flex-col items-center ${isSandbox ? 'my-4' : ''}`}>
            {isSandbox && (
                <div className="mb-2 text-xs font-bold text-blue-600 uppercase tracking-widest">
                    Live Printer Preview (384 dots/58mm)
                </div>
            )}

            {/* The "Paper" */}
            <div
                style={{ width: '384px' }}
                className="bg-[#fafafa] shadow-inner border border-gray-200 p-4 font-mono text-black overflow-hidden relative"
            >
                {/* Subtle thermal paper texture/gradient */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-gray-100/5 to-transparent opacity-50" />

                <div className="relative z-10 space-y-0 leading-none" style={{ fontSize: '12px' }}>

                    {/* Header */}
                    <div className="text-center w-full uppercase py-1">
                        ~~~ Om Muruga ~~~
                    </div>
                    <div className="text-center w-full font-extrabold py-1">
                        {data.hospitalName || 'KONGUNAD KIDNEY CENTRE'}
                    </div>

                    <div className="text-center w-full py-1 text-xs">
                        {dividerDouble}
                    </div>

                    {/* Token Number - QUADRUPLE SIZE Simulation */}
                    <div className="py-6 flex flex-col items-center justify-center">
                        <div
                            className="font-bold text-center w-full whitespace-pre"
                            style={{
                                fontSize: '48px', // 12px * 4
                                lineHeight: '1',
                                letterSpacing: '2px',
                                transform: 'scaleY(1.2)', // Thermal printers often have slightly taller 4x fonts
                                transformOrigin: 'center'
                            }}
                        >
                            {spacedToken}
                        </div>
                    </div>

                    <div className="text-center w-full py-1 text-xs">
                        {dividerSingle}
                    </div>

                    {/* Details */}
                    <div className="space-y-1 text-left px-1">
                        <div>
                            <span className="font-bold">Patient: </span>
                            {data.patientName}
                        </div>
                        {data.mrNumber && (
                            <div>
                                <span className="font-bold">MR. NO: </span>
                                {data.mrNumber}
                            </div>
                        )}
                        <div>
                            <span className="font-bold">Doctor: </span>
                            {formatDoctorName(data.doctorName)}
                        </div>
                    </div>

                    <div className="text-center w-full py-1 text-xs">
                        {dividerSingle}
                    </div>

                    {/* Date/Time */}
                    <div className="text-center w-full py-1">
                        {data.date}  {data.time}
                    </div>

                    <div className="text-center w-full py-1 text-xs">
                        {dividerDouble}
                    </div>

                    {/* Footer */}
                    <div className="text-center w-full space-y-1 py-1">
                        <div>For feedback & queries</div>
                        <div className="font-bold">Ph: 8056391682</div>
                        <div>IG: @kongunad_kidney_centre</div>
                    </div>

                    <div className="text-center w-full py-1 text-xs">
                        {dividerDouble}
                    </div>

                    <div className="text-center w-full pt-2 opacity-60">
                        BeanHealth
                    </div>

                    {/* Feed lines and Cut indicator */}
                    <div className="h-12 w-full flex items-center justify-center">
                        <div className="w-full border-b border-dashed border-gray-300 relative">
                            <span className="absolute left-1/2 -translate-x-1/2 -top-2 px-2 bg-[#fafafa] text-[8px] text-gray-400 uppercase font-sans">
                                (Partial Cut)
                            </span>
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
