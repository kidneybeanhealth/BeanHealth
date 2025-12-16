import React, { useState, useEffect } from 'react';
import { ReferralService } from '../services/referralService';
import { useAuth } from '../contexts/AuthContext';

const DoctorReferralCodeCard: React.FC = () => {
  const { user, profile } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchReferralCode = async () => {
      if (user?.id && profile?.role === 'doctor') {
        // Try to get from profile first
        if (profile.referral_code || profile.referralCode) {
          setReferralCode(profile.referral_code || profile.referralCode || null);
          setLoading(false);
        } else {
          // Fetch from database
          const code = await ReferralService.getDoctorReferralCode(user.id);
          setReferralCode(code);
          setLoading(false);
        }
      }
    };

    fetchReferralCode();
  }, [user, profile]);

  const handleCopy = async () => {
    if (referralCode) {
      const success = await ReferralService.copyToClipboard(referralCode);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!referralCode) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-900/20 dark:to-orange-900/20 rounded-xl shadow-sm border-2 border-rose-200 dark:border-rose-800 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Your Referral Code
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Share this with your patients to register under your care
          </p>
        </div>
        <div className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg px-4 py-3 border-2 border-rose-300 dark:border-rose-700">
          <p className="text-2xl font-bold font-mono text-rose-900 dark:text-rose-400 tracking-wider text-center">
            {referralCode}
          </p>
        </div>
        
        <button
          onClick={handleCopy}
          className="flex-shrink-0 p-3 rounded-lg bg-white dark:bg-gray-900 border-2 border-rose-300 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all duration-200 group relative"
          title="Copy to clipboard"
        >
          {copied ? (
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-rose-700 dark:text-rose-400 group-hover:text-rose-900 dark:group-hover:text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          
          {copied && (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs px-3 py-1 rounded-lg whitespace-nowrap">
              Copied!
            </div>
          )}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-rose-200 dark:border-rose-800">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <svg className="w-4 h-4 text-rose-600 dark:text-rose-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>Patients need this code to register and connect with you</span>
        </div>
      </div>
    </div>
  );
};

export default DoctorReferralCodeCard;
