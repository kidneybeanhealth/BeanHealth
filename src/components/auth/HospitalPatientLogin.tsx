import React, { useState } from 'react';
import { AuthService } from '../../services/authService';
import { toast } from 'react-hot-toast';

interface HospitalPatientLoginProps {
    onSwitchToChooser: () => void;
}

type Step = 'phone' | 'verify' | 'loading';

interface PatientMatch {
    patient_id: string;
    patient_name: string;
    hospital_name: string;
    age: number;
    created_at: string;
}

const HospitalPatientLogin: React.FC<HospitalPatientLoginProps> = ({ onSwitchToChooser }) => {
    const [step, setStep] = useState<Step>('phone');
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [patients, setPatients] = useState<PatientMatch[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<PatientMatch | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePhoneLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10) {
            setError('Please enter a valid 10-digit phone number');
            return;
        }

        setIsLoading(true);
        try {
            const results = await AuthService.findHospitalPatientsByPhone(digits);
            if (results.length === 0) {
                setError('No patient records found for this phone number. Please check the number you provided at the hospital.');
                return;
            }
            setPatients(results);
            setStep('verify');
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyAndLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Please enter your full name as registered');
            return;
        }

        setError('');
        setStep('loading');

        try {
            const result = await AuthService.signInAsHospitalPatient(phone, name);
            if (result.success) {
                toast.success(
                    result.isNewAccount
                        ? 'Welcome to BeanHealth! Your account has been created.'
                        : 'Welcome back!',
                    { duration: 3000 }
                );
                // Auth state change will handle redirect automatically
            } else {
                setError(result.error || 'Verification failed. Please check your name matches what was given at registration.');
                setStep('verify');
            }
        } catch (err) {
            setError('Something went wrong. Please try again.');
            setStep('verify');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-orange-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-semibold mb-1 !text-gray-900">
                    {step === 'phone' ? 'Hospital Patient Login' : step === 'verify' ? 'Verify Your Identity' : 'Signing In...'}
                </h2>
                <p className="text-sm !text-gray-500">
                    {step === 'phone'
                        ? 'Enter the phone number you gave at the hospital'
                        : step === 'verify'
                            ? 'Enter your name exactly as registered'
                            : 'Creating your BeanHealth account'}
                </p>
            </div>

            {/* Step 1: Phone Entry */}
            {step === 'phone' && (
                <form onSubmit={handlePhoneLookup} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Phone Number</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">+91</span>
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="98765 43210"
                                className="w-full pl-14 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900 text-lg tracking-wide"
                                autoFocus
                                maxLength={15}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || phone.replace(/\D/g, '').length < 10}
                        className="w-full py-3.5 rounded-full font-bold text-base transition-all duration-200 bg-orange-500 hover:bg-orange-600 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Looking up...
                            </span>
                        ) : 'Find My Records'}
                    </button>
                </form>
            )}

            {/* Step 2: Verify Identity */}
            {step === 'verify' && (
                <form onSubmit={handleVerifyAndLogin} className="space-y-4">
                    {/* Show matched hospital info */}
                    {patients.length > 0 && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <p className="text-sm font-bold text-green-800">Records Found!</p>
                            </div>
                            {patients.map((p, i) => (
                                <div key={i} className="flex items-center justify-between text-sm pl-7">
                                    <span className="text-green-700">
                                        {p.patient_name.charAt(0)}{'***'} · {p.hospital_name}
                                    </span>
                                    <span className="text-green-500 text-xs">
                                        {new Date(p.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">
                            Your Full Name (as given at registration)
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Enter your full name"
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!name.trim()}
                        className="w-full py-3.5 rounded-full font-bold text-base transition-all duration-200 bg-orange-500 hover:bg-orange-600 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Verify & Sign In
                    </button>

                    <button
                        type="button"
                        onClick={() => { setStep('phone'); setError(''); setPatients([]); }}
                        className="w-full flex items-center justify-center gap-2 py-2 text-gray-500 hover:text-orange-500 transition-colors text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Use a different number
                    </button>
                </form>
            )}

            {/* Step 3: Loading */}
            {step === 'loading' && (
                <div className="py-8 flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                    <p className="text-sm text-gray-500">Setting up your account...</p>
                </div>
            )}

            {/* Back Button */}
            {step !== 'loading' && (
                <button
                    onClick={onSwitchToChooser}
                    className="w-full flex items-center justify-center gap-2 py-3 transition-colors !text-gray-500 hover:text-orange-500"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="text-sm">Back to role selection</span>
                </button>
            )}
        </div>
    );
};

export default HospitalPatientLogin;
