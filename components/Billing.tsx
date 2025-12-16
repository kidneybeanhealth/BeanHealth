import React, { useState } from 'react';
import { Patient, SubscriptionTier } from '../types';
import { BillingIcon } from './icons/BillingIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { AlertIcon } from './icons/AlertIcon';

interface BillingProps {
    patient: Patient;
    onPurchaseCredits: (amount: number) => void;
    onUpgradeSubscription: (tier: 'Paid') => void;
}

const FeatureListItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="flex items-start space-x-3">
        <CheckCircleIcon className="h-5 w-5 text-gray-700 dark:text-gray-400 flex-shrink-0 mt-0.5" />
        <span className="text-gray-700 dark:text-gray-300">{children}</span>
    </li>
);

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
        <div className="space-y-8 sm:space-y-12 max-w-7xl mx-auto px-4 sm:px-6 animate-fadeIn">
            <div className="flex items-center space-x-3">
                <BillingIcon className="h-8 w-8 text-gray-700 dark:text-gray-400" />
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">Billing & Subscription</h2>
            </div>

            {/* Current Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-3xl border border-gray-300/60 dark:border-gray-700/60">
                    <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">Current Plan</h3>
                    <p className={`text-2xl sm:text-3xl font-semibold ${patient.subscriptionTier === 'Paid' ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'}`}>{currentPlanName}</p>
                    {isTrialActive && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">You have <span className="font-semibold text-secondary-700 dark:text-secondary-400">{trialDaysLeft} days</span> left in your trial.</p>}
                    {isTrialExpired && <p className="text-sm text-red-500 dark:text-red-400 font-semibold mt-1">Your free trial has expired.</p>}
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-3xl border border-gray-300/60 dark:border-gray-700/60">
                    <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">Urgent Credits</h3>
                    <p className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white flex items-center">
                        <SparklesIcon className="mr-2 h-7 w-7"/> {patient.urgentCredits}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Credits for priority messages to your doctor.</p>
                </div>
            </div>

            {/* Subscription Plans */}
            <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-6">Manage Subscription</h3>
                {isTrialExpired && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 p-4 rounded-2xl mb-6 flex items-center">
                        <AlertIcon className="h-6 w-6 mr-3 flex-shrink-0" />
                        <div>
                           <h4 className="font-semibold">Your Trial Has Ended</h4>
                           <p className="text-sm">Please upgrade to the Paid Plan to continue using premium features like AI summaries and record uploads.</p>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                    {/* Free Trial Plan */}
                    <div className={`p-6 sm:p-8 rounded-3xl border ${patient.subscriptionTier === 'FreeTrial' ? 'border-secondary-700 dark:border-white bg-white dark:bg-gray-800' : 'bg-white dark:bg-gray-800 border-gray-300/60 dark:border-gray-700/60'}`}>
                        <h4 className="text-xl font-semibold text-gray-900 dark:text-white">Free Trial</h4>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">Explore all features for one month.</p>
                        <p className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white mb-4">Free</p>
                        <ul className="space-y-2 mb-6">
                            <FeatureListItem>Vitals Tracking & Progress Charts</FeatureListItem>
                            <FeatureListItem>Unlimited Record Uploads & AI Summaries</FeatureListItem>
                            <FeatureListItem>Secure Doctor Messaging</FeatureListItem>
                        </ul>
                         <button disabled className="w-full text-center py-3 px-4 rounded-xl font-semibold bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed">
                           {isTrialActive ? 'Active Trial' : (isTrialExpired ? 'Trial Expired' : 'Not Active')}
                        </button>
                    </div>
                    {/* Paid Plan */}
                    <div className={`p-6 sm:p-8 rounded-3xl border ${patient.subscriptionTier === 'Paid' ? 'border-secondary-700 dark:border-white bg-white dark:bg-gray-800' : 'bg-white dark:bg-gray-800 border-gray-300/60 dark:border-gray-700/60'}`}>
                        <h4 className="text-xl font-semibold text-gray-900 dark:text-white">Paid Plan</h4>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">For comprehensive insights and support.</p>
                        <p className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">₹2000<span className="text-base font-medium text-gray-600 dark:text-gray-400">/month</span></p>
                        <ul className="space-y-2 mb-6">
                           <FeatureListItem>Advanced Vitals Tracking & Progress Charts</FeatureListItem>
                           <FeatureListItem>Unlimited Record Uploads & AI Summaries</FeatureListItem>
                           <FeatureListItem>Secure Doctor Messaging</FeatureListItem>
                           <FeatureListItem>Purchase & Use Urgent Message Credits</FeatureListItem>
                        </ul>
                        {patient.subscriptionTier === 'Paid' ? (
                            <button disabled className="w-full text-center py-3 px-4 rounded-xl font-semibold bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400">Current Plan</button>
                        ) : (
                            <button
                                onClick={() => handleUpgrade('Paid')}
                                disabled={!!isProcessing}
                                className="w-full text-center py-3 px-4 rounded-xl font-semibold bg-secondary-700 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                {isProcessing === 'upgrade' ? 'Processing...' : 'Upgrade to Paid Plan'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Purchase Credits */}
            <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-6">Purchase Urgent Credits</h3>
                 {patient.subscriptionTier === 'FreeTrial' ? (
                     <div className="text-center p-6 sm:p-8 bg-gray-100 dark:bg-gray-800 rounded-3xl border border-gray-300/60 dark:border-gray-700/60">
                        <p className="text-gray-700 dark:text-gray-300">Upgrade to the <span className="font-semibold text-gray-900 dark:text-white">Paid Plan</span> to purchase and use urgent credits.</p>
                     </div>
                 ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {creditPacks.map(pack => (
                            <div key={pack.amount} className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-3xl border border-gray-300/60 dark:border-gray-700/60 text-center">
                                <p className="text-3xl sm:text-4xl font-semibold text-gray-900 dark:text-white flex items-center justify-center">
                                    <SparklesIcon className="mr-2 h-8 w-8"/> {pack.amount}
                                </p>
                                <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">Credits</p>
                                <button
                                    onClick={() => handlePurchase(pack.amount)}
                                    disabled={!!isProcessing}
                                    className="w-full text-center py-3 px-4 rounded-xl font-semibold bg-secondary-700 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                                >
                                    {isProcessing === pack.amount ? 'Processing...' : `Purchase for ₹${pack.price}`}
                                </button>
                            </div>
                        ))}
                    </div>
                 )}
            </div>
        </div>
    );
};

export default Billing;


