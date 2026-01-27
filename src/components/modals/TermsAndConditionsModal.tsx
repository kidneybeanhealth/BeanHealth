import React, { useState, useRef, useEffect } from 'react';

interface TermsAndConditionsModalProps {
    isOpen: boolean;
    onAccept: () => Promise<void>;
    userName?: string;
    viewOnly?: boolean;
}

const TermsAndConditionsModal: React.FC<TermsAndConditionsModalProps> = ({
    isOpen,
    onAccept,
    userName,
    viewOnly = false
}) => {
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const [isChecked, setIsChecked] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Track scroll position
    const handleScroll = () => {
        if (contentRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                setHasScrolledToBottom(true);
            }
        }
    };

    useEffect(() => {
        if (contentRef.current && isOpen) {
            const { scrollHeight, clientHeight } = contentRef.current;
            if (scrollHeight <= clientHeight) {
                setHasScrolledToBottom(true);
            }
        }
    }, [isOpen]);

    const handleAccept = async () => {
        if (!isChecked || !hasScrolledToBottom) return;
        setIsLoading(true);
        try {
            await onAccept();
        } catch (error) {
            console.error('Error accepting terms:', error);
            alert('Failed to accept terms. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: '#e8f0e0' }}>
            <div className="bg-[#f5f9f2] rounded-2xl shadow-lg max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden border border-[#8AC43C]/20">
                {/* Header with Logo */}
                <div className="px-6 pt-6 pb-4 flex-shrink-0 text-center">
                    <div className="flex flex-col items-center mb-4">
                        <img 
                            src="/beanhealth-logo.png" 
                            alt="BeanHealth" 
                            className="h-48 w-auto object-contain"
                        />
                        <div style={{ marginTop: '-70px' }}>
                            <span style={{ color: '#3a2524', fontWeight: 600, fontSize: '18px' }}>Bean </span>
                            <span style={{ color: '#8AC43C', fontWeight: 600, fontSize: '18px' }}>Health</span>
                        </div>
                        <p style={{ color: '#5a5a5a', fontSize: '11px', fontStyle: 'italic', marginTop: '2px' }}>
                            Continuous. Connected. Complete.
                        </p>
                    </div>
                    <h1 className="text-xl font-normal tracking-tight" style={{ color: '#1f2937' }}>
                        Terms & Conditions
                    </h1>
                    {userName && (
                        <p className="mt-2 text-sm font-light" style={{ color: '#6b7280' }}>
                            Hi {userName}, please review and accept to continue.
                        </p>
                    )}
                </div>

                {/* Scrollable Content */}
                <div
                    ref={contentRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto px-6 pb-4"
                >
                    {/* Your Agreement Section */}
                    <div className="mb-6">
                        <h2 className="text-sm font-medium mb-3" style={{ color: '#374151' }}>
                            Your Agreement
                        </h2>
                        <p className="text-xs font-light leading-relaxed" style={{ color: '#6b7280' }}>
                            By using this App, you agree to be bound by, and to comply with, these Terms and Conditions. If you do not agree to these Terms and Conditions, please do not use this app.
                        </p>
                    </div>

                    {/* Terms Content */}
                    <div className="space-y-5 text-xs font-light leading-relaxed" style={{ color: '#6b7280' }}>
                        <p>
                            PLEASE NOTE: We reserve the right, at our sole discretion, to change, modify or otherwise alter these Terms and Conditions at any time. Unless otherwise indicated, amendments will become effective immediately. Please review these Terms and Conditions periodically. Your continued use of the App following the posting of changes and/or modifications will constitute your acceptance of the revised Terms and Conditions.
                        </p>

                        <div>
                            <h3 className="text-xs font-medium mb-2" style={{ color: '#374151' }}>
                                1. Medical Disclaimer
                            </h3>
                            <p>
                                The BeanHealth App is NOT a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read or accessed through this App. If you think you may have a medical emergency, call your doctor or emergency services immediately.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xs font-medium mb-2" style={{ color: '#374151' }}>
                                2. Account Security
                            </h3>
                            <p>
                                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account. You must ensure that the information you provide is accurate and up-to-date.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xs font-medium mb-2" style={{ color: '#374151' }}>
                                3. Privacy & Data Protection
                            </h3>
                            <p>
                                Your privacy is important to us. By using the App, you consent to the collection of health-related data you enter, storage of your medical records, sharing of your health data with your designated healthcare providers, and use of anonymized data for improving our services. We implement industry-standard security measures including encryption and secure data storage.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xs font-medium mb-2" style={{ color: '#374151' }}>
                                4. User Responsibilities
                            </h3>
                            <p>
                                You agree to provide accurate and truthful health information, use the App only for its intended purpose, not share your account with others, not attempt to access other users' data, and not use the App for any unlawful purpose.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xs font-medium mb-2" style={{ color: '#374151' }}>
                                5. Healthcare Provider Relationship
                            </h3>
                            <p>
                                The App facilitates communication between you and your healthcare providers. We are not responsible for the advice or treatment provided by healthcare providers. The doctor-patient relationship is between you and your healthcare provider, not with BeanHealth. For urgent medical needs, contact your healthcare provider directly or visit an emergency room.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xs font-medium mb-2" style={{ color: '#374151' }}>
                                6. AI-Powered Features
                            </h3>
                            <p>
                                The App uses artificial intelligence to provide health insights and summaries. AI-generated content is for informational purposes only and should not replace professional medical judgment. AI features may occasionally produce inaccurate results. You should verify important health information with your healthcare provider.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xs font-medium mb-2" style={{ color: '#374151' }}>
                                7. Limitation of Liability
                            </h3>
                            <p>
                                To the maximum extent permitted by law, BeanHealth Pvt Ltd shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, service interruptions, errors in the App, or any decisions made based on App information.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xs font-medium mb-2" style={{ color: '#374151' }}>
                                8. Governing Law
                            </h3>
                            <p>
                                These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts in Bangalore, Karnataka.
                            </p>
                        </div>

                        <div className="pt-2">
                            <p className="text-[10px]" style={{ color: '#9ca3af' }}>
                                Version 1.0 | Last updated: December 2025
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-5 border-t border-[#8AC43C]/20 flex-shrink-0 bg-[#eef6e6]">
                    {viewOnly ? (
                        /* View Only Mode - Just a Close button */
                        <button
                            onClick={() => onAccept()}
                            className="w-full px-8 py-2.5 bg-[#8AC43C] hover:bg-[#7ab332] text-white text-sm font-medium rounded-full transition-all duration-200"
                        >
                            Close
                        </button>
                    ) : (
                        <>
                            {/* Checkbox */}
                            <label className="flex items-start gap-3 cursor-pointer mb-5">
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => setIsChecked(e.target.checked)}
                                    disabled={!hasScrolledToBottom}
                                    className="w-4 h-4 mt-0.5 rounded border-gray-400 text-[#8AC43C] focus:ring-[#8AC43C] focus:ring-offset-0 disabled:opacity-40"
                                />
                                <span 
                                    className="text-xs font-light leading-relaxed"
                                    style={{ color: hasScrolledToBottom ? '#4b5563' : '#9ca3af' }}
                                >
                                    I have read and agree to the Terms and Conditions
                                </span>
                            </label>

                            {/* Buttons */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleAccept}
                                    disabled={!isChecked || !hasScrolledToBottom || isLoading}
                                    className="px-8 py-2.5 bg-[#8AC43C] hover:bg-[#7ab332] text-white text-sm font-medium rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                            <span>Please wait...</span>
                                        </>
                                    ) : (
                                        <span>Agree</span>
                                    )}
                                </button>

                                {!hasScrolledToBottom && (
                                    <span className="text-xs font-light" style={{ color: '#9ca3af' }}>
                                        Please scroll to read all terms
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TermsAndConditionsModal;
