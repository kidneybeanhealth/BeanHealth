import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthService } from '../../services/authService';
import { ReferralService } from '../../services/referralService';
import { UserRole, CKDStage } from '../../types';

// Multi-step patient registration flow
type PatientStep = 'basic-info' | 'referral-code' | 'consent' | 'medical-info';

const ProfileSetup: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [role, setRole] = useState<UserRole>('patient');
  const [loading, setLoading] = useState(false);
  
  // Common fields
  const [name, setName] = useState(user?.user_metadata?.full_name || '');
  
  // Doctor fields
  const [specialty, setSpecialty] = useState('');
  const [referralCodeGenerated, setReferralCodeGenerated] = useState<string | null>(null);
  
  // Patient fields - Step 1: Basic Info
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [contact, setContact] = useState('');
  
  // Patient fields - Step 2: Referral Code
  const [referralCode, setReferralCode] = useState('');
  const [referralValidating, setReferralValidating] = useState(false);
  const [referralValid, setReferralValid] = useState(false);
  const [referralDoctorName, setReferralDoctorName] = useState('');
  const [referralError, setReferralError] = useState('');
  
  // Patient fields - Step 3: Consent
  const [consentAccepted, setConsentAccepted] = useState(false);
  
  // Patient fields - Step 4: Medical Info (optional)
  const [diagnosisYear, setDiagnosisYear] = useState('');
  const [ckdStage, setCkdStage] = useState<CKDStage | ''>('');
  const [hasDM, setHasDM] = useState(false);
  const [hasHTN, setHasHTN] = useState(false);
  const [otherComorbidity, setOtherComorbidity] = useState('');
  
  // Current step for patient flow
  const [currentStep, setCurrentStep] = useState<PatientStep>('basic-info');

  // Validate referral code when entered
  useEffect(() => {
    if (role === 'patient' && referralCode.length >= 6) {
      validateReferralCode();
    } else {
      setReferralValid(false);
      setReferralDoctorName('');
      setReferralError('');
    }
  }, [referralCode, role]);

  const validateReferralCode = async () => {
    setReferralValidating(true);
    setReferralError('');
    
    try {
      const result = await ReferralService.validateReferralCode(referralCode);
      
      if (result.valid) {
        setReferralValid(true);
        setReferralDoctorName(result.doctorName || '');
        setReferralError('');
      } else {
        setReferralValid(false);
        setReferralDoctorName('');
        setReferralError(result.errorMessage || 'Invalid referral code');
      }
    } catch (error) {
      console.error('Error validating referral code:', error);
      setReferralValid(false);
      setReferralError('Unable to validate referral code');
    } finally {
      setReferralValidating(false);
    }
  };

  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const profileData = {
        id: user.id,
        email: user.email!,
        name,
        role: 'doctor' as UserRole,
        specialty,
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      };
      
      console.log('[ProfileSetup] Creating doctor profile');
      await AuthService.createOrUpdateProfile(profileData);
      
      // Fetch the generated referral code
      const generatedCode = await ReferralService.getDoctorReferralCode(user.id);
      if (generatedCode) {
        setReferralCodeGenerated(generatedCode);
      }
      
      // Don't refresh immediately - show the referral code first
      console.log('[ProfileSetup] Doctor profile created successfully');
      
    } catch (error: any) {
      console.error('[ProfileSetup] Error setting up doctor profile:', error);
      alert(`Error: ${error.message || 'Failed to set up profile. Please try again.'}`);
      setLoading(false);
    }
  };

  const handlePatientNextStep = () => {
    // Validate current step before proceeding
    if (currentStep === 'basic-info') {
      if (!name || !age || !gender || !contact) {
        alert('Please fill in all required fields');
        return;
      }
      setCurrentStep('referral-code');
    } else if (currentStep === 'referral-code') {
      if (!referralValid) {
        alert('Please enter a valid referral code from your doctor');
        return;
      }
      setCurrentStep('consent');
    } else if (currentStep === 'consent') {
      if (!consentAccepted) {
        alert('You must accept the consent agreement to continue');
        return;
      }
      setCurrentStep('medical-info');
    }
  };

  const handlePatientPreviousStep = () => {
    if (currentStep === 'referral-code') {
      setCurrentStep('basic-info');
    } else if (currentStep === 'consent') {
      setCurrentStep('referral-code');
    } else if (currentStep === 'medical-info') {
      setCurrentStep('consent');
    }
  };

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Build comorbidities array
      const comorbidities: string[] = [];
      if (hasDM) comorbidities.push('Diabetes Mellitus (DM)');
      if (hasHTN) comorbidities.push('Hypertension (HTN)');
      if (otherComorbidity.trim()) comorbidities.push(otherComorbidity.trim());

      console.log('[ProfileSetup] Registering patient with referral');
      const result = await ReferralService.registerPatientWithReferral({
        userId: user.id,
        email: user.email!,
        name,
        age: parseInt(age),
        gender,
        contact,
        referralCode,
        consentAccepted,
        diagnosisYear: diagnosisYear ? parseInt(diagnosisYear) : undefined,
        ckdStage: ckdStage || undefined,
        comorbidities: comorbidities.length > 0 ? comorbidities : undefined
      });

      if (!result.success) {
        throw new Error(result.errorMessage || 'Registration failed');
      }

      console.log('[ProfileSetup] Patient registered successfully:', result.patientUid);
      
      // Refresh the profile in AuthContext
      await refreshProfile();
      
    } catch (error: any) {
      console.error('[ProfileSetup] Error setting up patient profile:', error);
      alert(`Error: ${error.message || 'Failed to set up profile. Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorContinue = async () => {
    console.log('[ProfileSetup] Doctor continuing to dashboard');
    await refreshProfile();
  };

  const handleCopyReferralCode = async () => {
    if (referralCodeGenerated) {
      const success = await ReferralService.copyToClipboard(referralCodeGenerated);
      if (success) {
        alert('Referral code copied to clipboard!');
      } else {
        alert('Failed to copy. Please copy manually: ' + referralCodeGenerated);
      }
    }
  };

  // If doctor referral code has been generated, show success screen
  if (role === 'doctor' && referralCodeGenerated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Welcome, Dr. {name}!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Your profile has been created successfully
              </p>
            </div>

            <div className="bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-800 rounded-xl p-6 mb-6">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Your Referral Code
              </p>
              <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg p-4 mb-3">
                <span className="text-2xl font-bold font-mono text-rose-900 dark:text-rose-400">
                  {referralCodeGenerated}
                </span>
                <button
                  onClick={handleCopyReferralCode}
                  className="ml-4 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Copy to clipboard"
                >
                  <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Share this code with your patients so they can register under your care
              </p>
            </div>

            <button
              onClick={handleDoctorContinue}
              className="w-full py-3 px-6 rounded-xl text-white font-bold bg-rose-900 hover:bg-rose-800 transition-colors"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-gray-900 dark:text-gray-100 mb-3">
              Complete Your Profile
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Tell us a bit about yourself to personalize your experience
            </p>
          </div>

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              I am a...
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={`relative flex flex-col items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                role === 'patient' 
                  ? 'border-rose-900 bg-rose-50 dark:bg-rose-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="patient"
                  checked={role === 'patient'}
                  onChange={(e) => {
                    setRole(e.target.value as UserRole);
                    setCurrentStep('basic-info');
                  }}
                  className="sr-only"
                />
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                  role === 'patient'
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className={`text-sm font-semibold ${
                  role === 'patient'
                    ? 'text-rose-900 dark:text-rose-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>Patient</span>
              </label>

              <label className={`relative flex flex-col items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                role === 'doctor' 
                  ? 'border-secondary-700 bg-secondary-50 dark:bg-secondary-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="doctor"
                  checked={role === 'doctor'}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="sr-only"
                />
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                  role === 'doctor'
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className={`text-sm font-semibold ${
                  role === 'doctor'
                    ? 'text-secondary-700 dark:text-secondary-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>Doctor</span>
              </label>
            </div>
          </div>

          {/* Doctor Form */}
          {role === 'doctor' && (
            <form onSubmit={handleDoctorSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Full Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-900 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-gray-100"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="specialty" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Specialization *
                </label>
                <input
                  id="specialty"
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  required
                  placeholder="e.g., Nephrology, Cardiology"
                  className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-900 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-gray-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-xl text-base font-bold text-white bg-rose-900 hover:bg-rose-800 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-900 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? 'Creating Profile...' : 'Complete Setup'}
              </button>
            </form>
          )}

          {/* Patient Multi-Step Form */}
          {role === 'patient' && (
            <>
              {/* Progress Indicator */}
              <div className="mb-8">
                <div className="flex justify-between items-center">
                  {['Basic Info', 'Referral', 'Consent', 'Medical'].map((step, idx) => {
                    const steps: PatientStep[] = ['basic-info', 'referral-code', 'consent', 'medical-info'];
                    const currentIdx = steps.indexOf(currentStep);
                    const isActive = idx === currentIdx;
                    const isCompleted = idx < currentIdx;
                    
                    return (
                      <div key={step} className="flex-1 relative">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                            isActive ? 'bg-rose-900 text-white' :
                            isCompleted ? 'bg-green-500 text-white' :
                            'bg-gray-200 dark:bg-gray-700 text-gray-500'
                          }`}>
                            {isCompleted ? '✓' : idx + 1}
                          </div>
                          <span className="text-xs mt-1 text-gray-600 dark:text-gray-400">{step}</span>
                        </div>
                        {idx < 3 && (
                          <div className={`absolute top-4 left-1/2 w-full h-0.5 ${
                            isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                          }`} style={{ zIndex: -1 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handlePatientSubmit} className="space-y-6">
                {/* Step 1: Basic Info */}
                {currentStep === 'basic-info' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Age *
                        </label>
                        <input
                          type="number"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          required
                          min="1"
                          max="120"
                          className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100"
                          placeholder="Age"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Gender *
                        </label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          required
                          className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100"
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Contact Number *
                      </label>
                      <input
                        type="tel"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        required
                        className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100"
                        placeholder="Enter your contact number"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handlePatientNextStep}
                      className="w-full py-3 px-6 rounded-xl text-white font-bold bg-rose-900 hover:bg-rose-800"
                    >
                      Next
                    </button>
                  </div>
                )}

                {/* Step 2: Referral Code */}
                {currentStep === 'referral-code' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        <strong>Important:</strong> Please enter the referral code provided by your doctor. This ensures your medical records are shared with the correct healthcare provider.
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Doctor's Referral Code *
                      </label>
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        required
                        maxLength={10}
                        className={`block w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 rounded-xl text-gray-900 dark:text-gray-100 font-mono text-lg ${
                          referralCode.length >= 6 ? (
                            referralValid ? 'border-green-500' : 'border-red-500'
                          ) : 'border-gray-200 dark:border-gray-700'
                        }`}
                        placeholder="DOC-XXXXXX"
                      />
                      {referralValidating && (
                        <p className="mt-2 text-sm text-gray-600">Validating...</p>
                      )}
                      {referralError && (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{referralError}</p>
                      )}
                      {referralValid && referralDoctorName && (
                        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                          ✓ Valid code for Dr. {referralDoctorName}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handlePatientPreviousStep}
                        className="flex-1 py-3 px-6 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handlePatientNextStep}
                        disabled={!referralValid}
                        className="flex-1 py-3 px-6 rounded-xl text-white font-bold bg-rose-900 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Consent */}
                {currentStep === 'consent' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 rounded-xl p-6 max-h-96 overflow-y-auto">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                        Consent & Data Sharing Agreement
                      </h3>
                      
                      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                        <section>
                          <h4 className="font-semibold mb-2">1. Medical Data Usage</h4>
                          <p>By registering, you consent to BeanHealth collecting, storing, and processing your medical information including vitals, medications, and medical records for the purpose of providing healthcare services.</p>
                        </section>
                        
                        <section>
                          <h4 className="font-semibold mb-2">2. Doctor Access</h4>
                          <p>You authorize your referring doctor (Dr. {referralDoctorName}) and any doctors you connect with through BeanHealth to access your medical records, vitals, medications, and health information.</p>
                        </section>
                        
                        <section>
                          <h4 className="font-semibold mb-2">3. Data Security</h4>
                          <p>We implement industry-standard security measures to protect your data. All communications are encrypted, and access is limited to authorized healthcare providers.</p>
                        </section>
                        
                        <section>
                          <h4 className="font-semibold mb-2">4. Your Rights</h4>
                          <p>You have the right to access, modify, or delete your data at any time. You may also revoke consent, though this may limit access to certain features.</p>
                        </section>
                        
                        <section>
                          <h4 className="font-semibold mb-2">5. HIPAA Compliance</h4>
                          <p>BeanHealth is committed to HIPAA compliance and protects your health information in accordance with federal regulations.</p>
                        </section>
                      </div>
                    </div>
                    
                    <label className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-800 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consentAccepted}
                        onChange={(e) => setConsentAccepted(e.target.checked)}
                        required
                        className="mt-1 w-5 h-5 text-rose-900 rounded focus:ring-rose-900"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        <strong>I have read and accept the Consent & Data Sharing Agreement.</strong> I understand that my medical information will be shared with my healthcare providers through BeanHealth.
                      </span>
                    </label>
                    
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handlePatientPreviousStep}
                        className="flex-1 py-3 px-6 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handlePatientNextStep}
                        disabled={!consentAccepted}
                        className="flex-1 py-3 px-6 rounded-xl text-white font-bold bg-rose-900 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 4: Medical Info */}
                {currentStep === 'medical-info' && (
                  <div className="space-y-4 animate-fade-in">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Please provide your medical information. These fields are optional but help us provide better care.
                    </p>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Year of CKD Diagnosis (Optional)
                      </label>
                      <input
                        type="number"
                        value={diagnosisYear}
                        onChange={(e) => setDiagnosisYear(e.target.value)}
                        min="1900"
                        max={new Date().getFullYear()}
                        className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100"
                        placeholder="e.g., 2020"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        CKD Stage (Optional)
                      </label>
                      <select
                        value={ckdStage}
                        onChange={(e) => setCkdStage(e.target.value as CKDStage | '')}
                        className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100"
                      >
                        <option value="">Select stage</option>
                        <option value="Stage 1">Stage 1</option>
                        <option value="Stage 2">Stage 2</option>
                        <option value="Stage 3">Stage 3</option>
                        <option value="Stage 4">Stage 4</option>
                        <option value="Stage 5">Stage 5</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Comorbidities (Optional)
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                          <input
                            type="checkbox"
                            checked={hasDM}
                            onChange={(e) => setHasDM(e.target.checked)}
                            className="w-4 h-4 text-rose-900 rounded focus:ring-rose-900"
                          />
                          <span className="text-sm text-gray-800 dark:text-gray-200">Diabetes Mellitus (DM)</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                          <input
                            type="checkbox"
                            checked={hasHTN}
                            onChange={(e) => setHasHTN(e.target.checked)}
                            className="w-4 h-4 text-rose-900 rounded focus:ring-rose-900"
                          />
                          <span className="text-sm text-gray-800 dark:text-gray-200">Hypertension (HTN)</span>
                        </label>
                        <input
                          type="text"
                          value={otherComorbidity}
                          onChange={(e) => setOtherComorbidity(e.target.value)}
                          className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100"
                          placeholder="Other (specify)"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={handlePatientPreviousStep}
                        className="flex-1 py-3 px-6 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-3 px-6 rounded-xl text-white font-bold bg-rose-900 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Registering...' : 'Complete Registration'}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
