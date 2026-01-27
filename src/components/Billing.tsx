import React, { useState } from 'react';
import { Patient, SubscriptionTier } from '../types';
import { BillingIcon } from './icons/BillingIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { AlertIcon } from './icons/AlertIcon';
import { useUrgentCredits } from '../contexts/UrgentCreditsContext';

interface BillingProps {
    patient: Patient;
    onPurchaseCredits: (amount: number) => void;
    onUpgradeSubscription: (tier: 'Paid') => void;
}

const FeatureListItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="flex items-start space-x-3">
        <CheckCircleIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
        <span className="text-gray-600 dark:text-gray-300">{children}</span>
    </li>
);

// Component to display urgent credits with real-time updates
const UrgentCreditsDisplay: React.FC<{ fallback: number }> = ({ fallback }) => {
    const { credits } = useUrgentCredits();
    const displayCredits = credits ?? fallback;

    return (
        <p className="text-2xl font-bold text-[#222222] dark:text-white flex items-center mb-1">
            <SparklesIcon className="mr-2 h-5 w-5 text-[#FF385C]" /> {displayCredits}
        </p>
    );
};

const Billing: React.FC<BillingProps> = ({ patient, onPurchaseCredits, onUpgradeSubscription }) => {
    const [isProcessing, setIsProcessing] = useState<string | number | null>(null);

    const creditPacks = [
        { amount: 10, price: 500 },
        { amount: 50, price: 1000 },
    ];

    const getTrialDaysLeft = () => {
        if (!patient.trialEndsAt) return 0;
        const trialEndDate = new Date(patient.trialEndsAt);
        const now = new Date();
        const diffTime = trialEndDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };
    const trialDaysLeft = getTrialDaysLeft();
    const isTrialActive = patient.subscriptionTier === 'FreeTrial' && trialDaysLeft > 0;
    const isTrialExpired = patient.subscriptionTier === 'FreeTrial' && trialDaysLeft <= 0;

    const handlePurchase = (amount: number) => {
        setIsProcessing(amount);
        setTimeout(() => {
            onPurchaseCredits(amount);
            setIsProcessing(null);
        }, 1000);
    };

    const handleUpgrade = (tier: 'Paid') => {
        setIsProcessing('upgrade');
        setTimeout(() => {
            onUpgradeSubscription(tier);
            setIsProcessing(null);
        }, 1000);
    };

    const currentPlanName = patient.subscriptionTier === 'FreeTrial' ? 'Free Trial' : 'Paid Plan';

    return (
        <div className="space-y-6 pb-8 animate-fade-in max-w-[1440px] mx-auto pt-0">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#222222] dark:text-white tracking-tight">
                        Billing & Subscription
                    </h1>
                    <p className="text-xs sm:text-sm text-[#717171] dark:text-[#a0a0a0] font-medium mt-0.5 sm:mt-1">Manage your plan and credits</p>
                </div>
            </div>

            {/* Current Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-5 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] border border-transparent dark:border-[#8AC43C]/20">
                    <h3 className="text-[10px] font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Current Plan</h3>
                    <p className="text-2xl font-bold text-[#222222] dark:text-white mb-1">{currentPlanName}</p>
                    {isTrialActive && <p className="text-xs text-[#717171] dark:text-[#a0a0a0]">You have <span className="font-bold text-emerald-600 dark:text-emerald-400">{trialDaysLeft} days</span> left.</p>}
                    {isTrialExpired && <p className="text-xs text-red-500 dark:text-red-400 font-bold">Free trial expired.</p>}
                </div>
                <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-5 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] border border-transparent dark:border-[#8AC43C]/20">
                    <h3 className="text-[10px] font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider mb-1">Urgent Credits</h3>
                    <UrgentCreditsDisplay fallback={patient.urgentCredits} />
                    <p className="text-xs text-[#717171] dark:text-[#a0a0a0]">Credits for priority messages.</p>
                </div>
            </div>

            {/* Subscription Plans */}
            <div>
                <h3 className="text-xl font-bold text-[#222222] dark:text-white mb-4">Manage Subscription</h3>
                {isTrialExpired && (
                    <div className="bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200/50 dark:border-yellow-700/50 text-yellow-800 dark:text-yellow-200 p-3 rounded-xl mb-4 flex items-center">
                        <AlertIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide">Trial Ended</p>
                            <p className="text-[10px] opacity-80 mt-0.5">Please upgrade to continue using premium features.</p>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                    {/* Free Trial Plan */}
                    <div className={`p-5 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] backdrop-blur-md transition-all ${patient.subscriptionTier === 'FreeTrial' ? 'border-2 border-[#222222] dark:border-white bg-white dark:bg-[#8AC43C]/[0.08]' : 'bg-white dark:bg-[#8AC43C]/[0.08] border border-transparent dark:border-[#8AC43C]/20'}`}>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">Free Trial</h4>
                        <p className="text-gray-500 dark:text-gray-400 mb-3 text-xs leading-relaxed">Basic healthcare tracking.</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Free</p>
                        <ul className="space-y-2 mb-6 text-xs">
                            <FeatureListItem>Vitals Tracking & Charts</FeatureListItem>
                            <FeatureListItem>Basic AI Summaries</FeatureListItem>
                            <FeatureListItem>Secure Messaging</FeatureListItem>
                        </ul>
                        <button disabled className="w-full text-center py-2.5 px-4 rounded-full font-bold bg-gray-100 dark:bg-gray-800 text-[#717171] dark:text-gray-400 cursor-not-allowed text-xs uppercase tracking-wide">
                            {isTrialActive ? 'Active' : (isTrialExpired ? 'Expired' : 'Not Active')}
                        </button>
                    </div>
                    {/* Paid Plan */}
                    <div className={`p-5 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] backdrop-blur-md transition-all ${patient.subscriptionTier === 'Paid' ? 'border-2 border-[#222222] dark:border-white bg-white dark:bg-[#8AC43C]/[0.08]' : 'bg-white dark:bg-[#8AC43C]/[0.08] border border-transparent dark:border-[#8AC43C]/20'}`}>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">Paid Plan</h4>
                        <p className="text-gray-500 dark:text-gray-400 mb-3 text-xs leading-relaxed">Full medical support package.</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-4">₹2000<span className="text-sm font-medium text-gray-400">/mo</span></p>
                        <ul className="space-y-2 mb-6 text-xs">
                            <FeatureListItem>Advanced Vitals & Charts</FeatureListItem>
                            <FeatureListItem>Unlimited record AI summaries</FeatureListItem>
                            <FeatureListItem>Premium Support Access</FeatureListItem>
                            <FeatureListItem>Urgent message credits ready</FeatureListItem>
                        </ul>
                        {patient.subscriptionTier === 'Paid' ? (
                            <button disabled className="w-full text-center py-2.5 px-4 rounded-full font-bold bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Current</button>
                        ) : (
                            <button
                                onClick={() => handleUpgrade('Paid')}
                                disabled={!!isProcessing}
                                className="w-full text-center py-2.5 px-6 rounded-full font-bold bg-[#222222] dark:bg-white text-white dark:text-[#222222] hover:opacity-90 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-wide"
                            >
                                {isProcessing === 'upgrade' ? '...' : 'Upgrade Now'}
                            </button>
                        )}
                    </div>
                </div>
            </div>


        </div>
    );
};

export default Billing;
