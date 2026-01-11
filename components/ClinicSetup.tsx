import React, { useState } from 'react';
import { ClinicService } from '../services/clinicService';

interface ClinicProfile {
    name: string;
    logo: string | null;
    location: string;
    address: string;
    numberOfDoctors: number;
    phone: string;
    emergencyContact: string;
    appointmentContact: string;
    email: string;
    setupComplete: boolean;
}

interface ClinicSetupProps {
    onComplete: (profile: ClinicProfile) => void;
}

const ClinicSetup: React.FC<ClinicSetupProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [profile, setProfile] = useState<ClinicProfile>({
        name: '',
        logo: null,
        location: '',
        address: '',
        numberOfDoctors: 1,
        phone: '',
        emergencyContact: '',
        appointmentContact: '',
        email: '',
        setupComplete: false
    });
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setProfile({ ...profile, logo: base64 });
                setLogoPreview(base64);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleComplete = async () => {
        try {
            // Register with backend to get real Clinic ID
            const clinicId = await ClinicService.registerClinic({
                name: profile.name,
                email: profile.email,
                location: profile.location
            });

            const finalProfile = { ...profile, setupComplete: true, id: clinicId };
            localStorage.setItem('clinicProfile', JSON.stringify(finalProfile));

            // Update session with ID
            const session = {
                email: profile.email,
                clinicName: profile.name,
                clinicId: clinicId,
                role: 'admin',
                loggedInAt: new Date().toISOString()
            };
            localStorage.setItem('clinicSession', JSON.stringify(session));

            onComplete(finalProfile);
        } catch (error) {
            console.error("Failed to register clinic", error);
            alert("Failed to register clinic. Please try again.");
        }
    };

    const isStep1Valid = profile.name.trim() !== '' && profile.location.trim() !== '';
    const isStep2Valid = profile.phone.trim() !== '';

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 text-primary-600 mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Set Up Your Clinic</h1>
                    <p className="text-gray-500">Complete your clinic profile to get started</p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${s < step ? 'bg-primary-500 text-white' :
                                s === step ? 'bg-primary-500 text-white' :
                                    'bg-gray-200 text-gray-500'
                                }`}>
                                {s < step ? '✓' : s}
                            </div>
                            {s < 3 && <div className={`w-12 h-1 mx-1 ${s < step ? 'bg-primary-500' : 'bg-gray-200'}`} />}
                        </div>
                    ))}
                </div>

                {/* Step 1: Basic Info */}
                {step === 1 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>

                        {/* Logo Upload */}
                        <div className="flex flex-col items-center gap-4 mb-6">
                            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden hover:border-primary-400 transition-colors cursor-pointer relative group">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                                ) : (
                                    <div className="flex flex-col items-center text-gray-400">
                                        <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-sm font-medium">Upload Logo</span>
                                    </div>
                                )}
                                <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Name</label>
                            <input
                                type="text"
                                value={profile.name}
                                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                placeholder="e.g. Apollo Chengalpattu"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Email (Login ID)</label>
                            <input
                                type="email"
                                value={profile.email}
                                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                placeholder="e.g. admin@apollo.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Location / City</label>
                            <input
                                type="text"
                                value={profile.location}
                                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                placeholder="e.g. Chengalpattu"
                            />
                        </div>
                        <button
                            onClick={() => setStep(2)}
                            disabled={!isStep1Valid || !profile.email}
                            className="w-full mt-4 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next Step
                        </button>
                    </div>
                )}

                {/* Step 2: Contact Details */}
                {step === 2 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Details</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Phone Number</label>
                            <input
                                type="tel"
                                value={profile.phone}
                                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                placeholder="+91 99999 99999"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
                            <textarea
                                value={profile.address}
                                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                rows={3}
                                placeholder="Street address, Area, Pincode"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setStep(1)}
                                className="py-3 px-4 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                disabled={!isStep2Valid}
                                className="py-3 px-4 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next Step
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Additional Info */}
                {step === 3 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Final Details</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Doctors</label>
                            <input
                                type="number"
                                min="1"
                                value={profile.numberOfDoctors}
                                onChange={(e) => setProfile({ ...profile, numberOfDoctors: parseInt(e.target.value) || 1 })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact (Optional)</label>
                            <input
                                type="tel"
                                value={profile.emergencyContact}
                                onChange={(e) => setProfile({ ...profile, emergencyContact: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                placeholder="For urgent cases"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <button
                                onClick={() => setStep(2)}
                                className="py-3 px-4 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleComplete}
                                className="py-3 px-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
                            >
                                Complete Setup
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClinicSetup;
