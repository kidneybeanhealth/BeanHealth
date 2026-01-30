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
    <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-8 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h3 className="text-xl font-extrabold text-[#222222] dark:text-white mb-2">
            Your Referral Code
          </h3>
          <p className="text-[#717171] dark:text-[#a0a0a0] font-medium">
            Share this with your patients to register under your care
          </p>
        </div>
        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 bg-gray-50 dark:bg-[#2a2a2a] rounded-xl px-6 py-4 border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-3xl font-extrabold font-mono text-[#222222] dark:text-white tracking-widest text-center">
            {referralCode}
          </p>
        </div>

        <button
          onClick={handleCopy}
          className="flex-shrink-0 p-4 rounded-xl bg-[#222222] dark:bg-white hover:opacity-90 transition-all duration-200 group relative shadow-md"
          title="Copy to clipboard"
        >
          {copied ? (
            <svg className="w-6 h-6 text-green-400 dark:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white dark:text-[#222222]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}

          {copied && (
            <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black dark:bg-white text-white dark:text-black text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
              Copied!
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black dark:border-t-white"></div>
            </div>
          )}
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3 text-sm font-medium text-[#717171] dark:text-[#a0a0a0]">
          <div className="w-6 h-6 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <span>Patients need this code to register and connect with you</span>
        </div>
      </div>
    </div>
  );
};

export default DoctorReferralCodeCard;
