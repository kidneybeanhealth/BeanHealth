import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthService } from '../../services/authService';
import { UserRole } from '../../types';

const ProfileSetup: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [role, setRole] = useState<UserRole>('patient');
  const [name, setName] = useState(user?.user_metadata?.full_name || '');

  // Doctor/Patient specific fields
  const [specialty, setSpecialty] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [condition, setCondition] = useState('');

  // Enterprise specific fields
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const profileData = {
        id: user.id,
        email: user.email!,
        name,
        role,
        // Doctor specific
        specialty: role === 'doctor' ? specialty : undefined,
        // Patient specific
        dateOfBirth: role === 'patient' ? dateOfBirth : undefined,
        condition: role === 'patient' ? condition : undefined,
        // Enterprise specific handled via notes buffer for now or custom fields if extended
        notes: role === 'enterprise' ? `Address: ${address}\nContact: ${contactNumber}` : undefined,
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      };

      console.log('Creating profile with data:', profileData);
      await AuthService.createOrUpdateProfile(profileData);

      // Refresh the profile in AuthContext
      console.log('Profile created successfully, refreshing auth state');
      await refreshProfile();

    } catch (error: any) {
      console.error('Error setting up profile:', error);

      // Show more specific error message
      let errorMessage = 'Failed to set up profile. Please try again.';
      if (error?.message) {
        errorMessage = `Error: ${error.message}`;
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-display font-bold text-gray-900 dark:text-gray-100 mb-3">
              Complete Profile
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {role === 'enterprise'
                ? 'Set up your Hospital Information'
                : 'Tell us a bit about yourself'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Account Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className={`relative flex flex-col items-center p-3 border-2 rounded-xl cursor-pointer transition-all duration-200 ${role === 'patient'
                    ? 'border-rose-900 bg-rose-50 dark:bg-rose-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}>
                  <input
                    type="radio"
                    name="role"
                    value="patient"
                    checked={role === 'patient'}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="sr-only"
                  />
                  <span className={`text-xs font-semibold ${role === 'patient' ? 'text-rose-900' : 'text-gray-700'}`}>Patient</span>
                </label>

                <label className={`relative flex flex-col items-center p-3 border-2 rounded-xl cursor-pointer transition-all duration-200 ${role === 'doctor'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}>
                  <input
                    type="radio"
                    name="role"
                    value="doctor"
                    checked={role === 'doctor'}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="sr-only"
                  />
                  <span className={`text-xs font-semibold ${role === 'doctor' ? 'text-indigo-700' : 'text-gray-700'}`}>Doctor</span>
                </label>

                <label className={`relative flex flex-col items-center p-3 border-2 rounded-xl cursor-pointer transition-all duration-200 ${role === 'enterprise'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}>
                  <input
                    type="radio"
                    name="role"
                    value="enterprise"
                    checked={role === 'enterprise'}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="sr-only"
                  />
                  <span className={`text-xs font-semibold ${role === 'enterprise' ? 'text-emerald-700' : 'text-gray-700'}`}>Hospital</span>
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {role === 'enterprise' ? 'Hospital Name' : 'Full Name'}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="block w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900 focus:border-transparent outline-none transition-all"
                placeholder={role === 'enterprise' ? "e.g. City General Hospital" : "Enter your full name"}
              />
            </div>

            {role === 'enterprise' && (
              <div className="space-y-6 animate-slide-up">
                <div>
                  <label htmlFor="address" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Hospital Address
                  </label>
                  <textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    rows={3}
                    className="block w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
                    placeholder="Street, City, State, Zip Code"
                  />
                </div>
                <div>
                  <label htmlFor="contact" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Contact Number
                  </label>
                  <input
                    id="contact"
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    required
                    className="block w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>
            )}

            {role === 'doctor' && (
              <div className="animate-slide-up">
                <label htmlFor="specialty" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Specialty
                </label>
                <input
                  id="specialty"
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  required
                  placeholder="e.g., Cardiology, Pediatrics"
                  className="block w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            )}

            {role === 'patient' && (
              <div className="space-y-6 animate-slide-up">
                <div>
                  <label htmlFor="dateOfBirth" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Date of Birth
                  </label>
                  <input
                    id="dateOfBirth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                    className="block w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="condition" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Primary Health Condition <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="condition"
                    type="text"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder="e.g., Diabetes, Hypertension"
                    className="block w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full py-4 px-6 border-none rounded-xl shadow-sm text-base font-bold text-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-8 ${role === 'enterprise' ? 'bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-700' :
                  role === 'doctor' ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-600' :
                    'bg-rose-900 hover:bg-rose-800 focus:ring-rose-900'
                }`}
            >
              <span className="relative z-10 flex items-center justify-center">
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Setting up...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;