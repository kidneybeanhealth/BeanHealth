import React, { useState, useEffect } from 'react';
import { printerService } from '../services/BluetoothPrinterService';
import { toast } from 'react-hot-toast';
import { LogoIcon } from './icons/LogoIcon';
import PrinterPreview, { PrinterPreviewData } from './PrinterPreview';

interface PrinterSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnected: () => void;
    settings: { spacing: number; alignment: 'left' | 'center' | 'right' };
    onSettingsChange: (settings: { spacing: number; alignment: 'left' | 'center' | 'right' }) => void;
    isSavingSettings?: boolean;
}

const PrinterSetupModal: React.FC<PrinterSetupModalProps> = ({
    isOpen,
    onClose,
    onConnected,
    settings,
    onSettingsChange,
    isSavingSettings = false
}) => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [deviceName, setDeviceName] = useState<string | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isSupported, setIsSupported] = useState(true);
    const [showSandbox, setShowSandbox] = useState(false);

    // Sandbox state for remote debugging
    const [sandboxToken, setSandboxToken] = useState('48');
    const [sandboxPatient, setSandboxPatient] = useState('ANTONY. M C');

    const previewData: PrinterPreviewData = {
        tokenNumber: sandboxToken,
        patientName: sandboxPatient,
        doctorName: 'A. Prabhakar',
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        settings: settings
    };

    useEffect(() => {
        // Check if Web Bluetooth is supported
        setIsSupported(printerService.isSupported());
        setIsConnected(printerService.isConnected());
        setDeviceName(printerService.getDeviceName());
    }, [isOpen]);

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            await printerService.connect();
            setIsConnected(true);
            setDeviceName(printerService.getDeviceName());
            toast.success('Printer connected successfully!');
            onConnected();
        } catch (error: any) {
            console.error('Connection error:', error);
            if (error.message?.includes('cancelled')) {
                // User cancelled - don't show error
            } else {
                toast.error(error.message || 'Failed to connect to printer');
            }
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            await printerService.disconnect();
            setIsConnected(false);
            setDeviceName(null);
            toast.success('Printer disconnected');
        } catch (error: any) {
            toast.error('Failed to disconnect');
        }
    };

    const handleTestPrint = async () => {
        setIsPrinting(true);
        try {
            await printerService.printTestPage();
            toast.success('Test page sent to printer!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to print test page');
        } finally {
            setIsPrinting(false);
        }
    };

    // Simple test - just line feeds to check if connection works
    const handleSimpleTest = async () => {
        setIsPrinting(true);
        try {
            await printerService.printSimpleTest();
            toast.success('Line feeds sent - paper should move!');
        } catch (error: any) {
            toast.error(error.message || 'Simple test failed');
        } finally {
            setIsPrinting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Printer Setup</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Offline Sandbox Toggle */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🏃</span>
                                <h4 className="font-bold text-blue-900 text-sm">Offline Layout Sandbox</h4>
                            </div>
                            <button
                                onClick={() => setShowSandbox(!showSandbox)}
                                className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg shadow hover:bg-blue-700 transition-colors"
                            >
                                {showSandbox ? 'Hide Preview' : 'Show Preview'}
                            </button>
                        </div>

                        {showSandbox && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Test Token</label>
                                        <input
                                            type="text"
                                            value={sandboxToken}
                                            onChange={(e) => setSandboxToken(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g. 48"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Test Patient</label>
                                        <input
                                            type="text"
                                            value={sandboxPatient}
                                            onChange={(e) => setSandboxPatient(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Patient Name"
                                        />
                                    </div>
                                </div>
                                <div className="border border-blue-100 rounded-lg overflow-hidden bg-white">
                                    <PrinterPreview
                                        data={previewData}
                                        isSandbox={true}
                                        onSettingsChange={onSettingsChange}
                                        isSaving={isSavingSettings}
                                    />
                                </div>
                                <p className="text-[10px] text-blue-600 italic">
                                    This simulates exactly how it will appear on the 58mm Rugtek BP02 printer dots.
                                </p>
                            </div>
                        )}
                    </div>

                    {!isSupported ? (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <h4 className="font-bold text-red-800">Browser Not Supported</h4>
                                    <p className="text-sm text-red-700 mt-1">
                                        Web Bluetooth is not supported in this browser. Please use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Connection Status */}
                            <div className={`flex items-center justify-between p-4 rounded-xl ${isConnected ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                                    <div>
                                        <p className={`font-semibold ${isConnected ? 'text-green-800' : 'text-gray-600'}`}>
                                            {isConnected ? 'Connected' : 'Not Connected'}
                                        </p>
                                        {deviceName && (
                                            <p className="text-sm text-green-700">{deviceName}</p>
                                        )}
                                    </div>
                                </div>
                                {isConnected && (
                                    <button
                                        onClick={handleDisconnect}
                                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                                    >
                                        Disconnect
                                    </button>
                                )}
                            </div>

                            {/* Instructions */}
                            {!isConnected && (
                                <div className="space-y-3">
                                    <h4 className="font-semibold text-gray-900">Setup Instructions:</h4>
                                    <ol className="space-y-2 text-sm text-gray-600">
                                        <li className="flex items-start gap-2">
                                            <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                            <span>Turn on your <strong>Rugtek BP02</strong> printer</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                            <span>Enable Bluetooth on this computer</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                                            <span>Click "Scan for Printer" below</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                                            <span>Select your printer from the list</span>
                                        </li>
                                    </ol>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="space-y-3">
                                {!isConnected ? (
                                    <button
                                        onClick={handleConnect}
                                        disabled={isConnecting}
                                        className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${isConnecting
                                            ? 'bg-blue-400 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40'
                                            }`}
                                    >
                                        {isConnecting ? (
                                            <>
                                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Scanning...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                                </svg>
                                                Scan for Printer
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        <button
                                            onClick={handleTestPrint}
                                            disabled={isPrinting}
                                            className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${isPrinting
                                                ? 'bg-green-400 cursor-not-allowed'
                                                : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/25'
                                                }`}
                                        >
                                            {isPrinting ? (
                                                <>
                                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Printing...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                    </svg>
                                                    Print Test Page
                                                </>
                                            )}
                                        </button>

                                        {/* Simple Test Button - for debugging */}
                                        <button
                                            onClick={handleSimpleTest}
                                            disabled={isPrinting}
                                            className={`w-full py-2.5 rounded-lg font-medium text-gray-700 flex items-center justify-center gap-2 transition-all border-2 ${isPrinting
                                                ? 'bg-gray-100 cursor-not-allowed border-gray-200'
                                                : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-gray-400'
                                                }`}
                                        >
                                            🔧 Simple Test (paper feed only)
                                        </button>

                                        <p className="text-xs text-gray-500 text-center">
                                            If Test Page fails, try Simple Test first
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-500 text-center">
                        Compatible with Rugtek BP02 and similar Bluetooth thermal printers
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PrinterSetupModal;
