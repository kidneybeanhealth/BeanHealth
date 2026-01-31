import React, { useState } from 'react';

interface TrialCodeVerificationProps {
    onVerified: () => void;
    onBack: () => void;
    role: 'patient' | 'doctor';
}

const TrialCodeVerification: React.FC<TrialCodeVerificationProps> = ({ onVerified, onBack, role }) => {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    // Trial codes from environment variable, fallback to hardcoded
    const validCodes = import.meta.env.VITE_TRIAL_CODES?.split(',').map((c: string) => c.trim()) || ['ENTERBEANHEALTH07'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsVerifying(true);

        // Simulate brief verification delay for better UX
        setTimeout(() => {
            if (validCodes.includes(code.trim())) {
                // Store verification in sessionStorage (clears when tab closes)
                sessionStorage.setItem('beanhealth_trial_verified', 'true');
                onVerified();
            } else {
                setError('Invalid trial code. Please check your code and try again.');
                setIsVerifying(false);
            }
        }, 300);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary-50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-semibold mb-1 !text-gray-900">
                    Enter Trial Code
                </h2>
                <p className="text-sm !text-gray-500">
                    {role === 'patient' ? 'Patient' : 'Doctor'} access requires a trial code
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="trial-code" className="block text-sm font-medium !text-gray-700 mb-2">
                        Trial Code
                    </label>
                    <input
                        id="trial-code"
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="Enter your code"
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-secondary-500 focus:ring-0 outline-none transition-colors text-center font-mono text-lg tracking-wider !text-gray-900 uppercase"
                        disabled={isVerifying}
                        autoFocus
                    />
                    {error && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </p>
                    )}
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={!code.trim() || isVerifying}
                    className={`w-full py-3.5 rounded-full font-bold text-base transition-all duration-200 ${code.trim() && !isVerifying
                        ? 'bg-secondary-500 hover:bg-secondary-600 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                >
                    {isVerifying ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Verifying...
                        </span>
                    ) : (
                        'Continue'
                    )}
                </button>
            </form>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs !text-blue-800 leading-relaxed">
                    <strong>Need a trial code?</strong> Contact our team to request access. Trial codes are sent via email to approved users.
                </p>
            </div>

            {/* Back Button */}
            <button
                onClick={onBack}
                className="w-full py-3 text-sm font-medium !text-gray-600 hover:!text-gray-900 transition-colors flex items-center justify-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to role selection
            </button>
        </div>
    );
};

export default TrialCodeVerification;
