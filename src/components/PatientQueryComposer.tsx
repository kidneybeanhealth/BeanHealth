import React, { useState, useRef } from 'react';
import { AlertIcon } from './icons/AlertIcon';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { DocumentUploadIcon } from './icons/DocumentUploadIcon';
import { InlineAudioRecorder } from './InlineAudioRecorder';

interface Attachment {
    id: string;
    file: File;
    type: 'image' | 'document';
    preview?: string;
}

interface PatientQueryComposerProps {
    recipientName: string;
    urgentCredits: number;
    hasCredits: boolean;
    isUploading: boolean;
    onSendQuery: (data: {
        text: string;
        audioBlob?: Blob;
        audioDuration?: number;
        attachments: File[];
        isUrgent: boolean;
    }) => Promise<void>;
    onCancel?: () => void;
}

export const PatientQueryComposer: React.FC<PatientQueryComposerProps> = ({
    recipientName,
    urgentCredits,
    hasCredits,
    isUploading,
    onSendQuery,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [complaintText, setComplaintText] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; duration: number } | null>(null);
    const [isSending, setIsSending] = useState(false);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const documentInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setAttachments(prev => [...prev, {
                        id: Date.now().toString() + Math.random(),
                        file,
                        type: 'image',
                        preview: event.target?.result as string
                    }]);
                };
                reader.readAsDataURL(file);
            }
        });
        e.target.value = '';
    };

    const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            setAttachments(prev => [...prev, {
                id: Date.now().toString() + Math.random(),
                file,
                type: 'document'
            }]);
        });
        e.target.value = '';
    };

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    const handleRecordingComplete = (blob: Blob, duration: number) => {
        setRecordedAudio({ blob, duration });
        setIsRecording(false);
    };

    const removeRecording = () => {
        setRecordedAudio(null);
    };

    const handleSubmit = async () => {
        // Need at least text, audio, or attachments
        if (!complaintText.trim() && !recordedAudio && attachments.length === 0) {
            return;
        }

        setIsSending(true);
        try {
            await onSendQuery({
                text: complaintText.trim(),
                audioBlob: recordedAudio?.blob,
                audioDuration: recordedAudio?.duration,
                attachments: attachments.map(a => a.file),
                isUrgent
            });

            // Reset form and collapse after successful send
            setComplaintText('');
            setRecordedAudio(null);
            setAttachments([]);
            setIsUrgent(false);
            setIsExpanded(false);
        } catch (error) {
            console.error('Error sending query:', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleClose = () => {
        // Reset form and collapse
        setComplaintText('');
        setRecordedAudio(null);
        setAttachments([]);
        setIsUrgent(false);
        setIsRecording(false);
        setIsExpanded(false);
    };

    const canSend = (complaintText.trim() || recordedAudio || attachments.length > 0) && !isSending && !isUploading;

    // Collapsed state - just show a button
    if (!isExpanded) {
        return (
            <div className="px-3 sm:px-4 py-2 sm:py-3 bg-[#F0F2F5] dark:bg-[#202C33] border-t border-gray-100 dark:border-[#2A3942]">
                <button
                    onClick={() => setIsExpanded(true)}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#1EBE5A] hover:to-[#0E7A6B] text-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 font-semibold"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>New Query to Dr. {recipientName}</span>
                </button>
            </div>
        );
    }

    // Expanded state - show full form
    return (
        <div className="bg-white dark:bg-[#1F2C34] border-t border-gray-200 dark:border-[#2A3942] max-h-[60vh] overflow-y-auto">
            {/* Header with Close Button */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-[#2A3942] bg-gradient-to-r from-[#25D366]/10 to-[#128C7E]/10 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-[#111B21] dark:text-[#E9EDEF]">
                                Send Query to Dr. {recipientName}
                            </h3>
                            <p className="text-[10px] text-[#667781] dark:text-[#8696A0]">
                                Add text, voice, or attachments
                            </p>
                        </div>
                    </div>
                    {/* Close Button */}
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#2A3942] transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5 text-[#667781] dark:text-[#8696A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="p-3 space-y-3">
                {/* Complaint Text Area - Compact */}
                <div>
                    <textarea
                        value={complaintText}
                        onChange={(e) => setComplaintText(e.target.value)}
                        placeholder="Describe your symptoms or concern..."
                        className="w-full h-16 px-3 py-2 text-sm bg-[#F0F2F5] dark:bg-[#2A3942] border-0 rounded-xl text-[#111B21] dark:text-[#E9EDEF] placeholder-[#667781] dark:placeholder-[#8696A0] focus:outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
                        disabled={isSending}
                    />
                </div>

                {/* Voice Recording - Compact */}
                {isRecording ? (
                    <InlineAudioRecorder
                        onRecordingComplete={handleRecordingComplete}
                        onCancel={() => setIsRecording(false)}
                    />
                ) : recordedAudio ? (
                    <div className="flex items-center gap-2 p-2 bg-[#DCF8C6] dark:bg-[#005C4B] rounded-lg">
                        <MicrophoneIcon className="w-4 h-4 text-[#25D366]" />
                        <span className="text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] flex-1">
                            Voice: {Math.floor(recordedAudio.duration / 60)}:{String(Math.floor(recordedAudio.duration % 60)).padStart(2, '0')}
                        </span>
                        <button onClick={removeRecording} className="text-red-500 hover:text-red-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ) : null}

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Voice Record Button */}
                    {!recordedAudio && !isRecording && (
                        <button
                            onClick={() => setIsRecording(true)}
                            disabled={isSending}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#F0F2F5] dark:bg-[#2A3942] hover:bg-[#E4E6E9] dark:hover:bg-[#374045] rounded-lg text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] transition-colors disabled:opacity-50"
                        >
                            <MicrophoneIcon className="w-4 h-4 text-[#25D366]" />
                            <span>Voice</span>
                        </button>
                    )}

                    {/* Image Button */}
                    <button
                        onClick={() => imageInputRef.current?.click()}
                        disabled={isSending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#F0F2F5] dark:bg-[#2A3942] hover:bg-[#E4E6E9] dark:hover:bg-[#374045] rounded-lg text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] transition-colors disabled:opacity-50"
                    >
                        <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Image</span>
                    </button>

                    {/* Document Button */}
                    <button
                        onClick={() => documentInputRef.current?.click()}
                        disabled={isSending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#F0F2F5] dark:bg-[#2A3942] hover:bg-[#E4E6E9] dark:hover:bg-[#374045] rounded-lg text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] transition-colors disabled:opacity-50"
                    >
                        <DocumentUploadIcon className="w-4 h-4 text-purple-500" />
                        <span>Document</span>
                    </button>

                    {/* Urgent Toggle - Compact */}
                    <button
                        onClick={() => {
                            if (!hasCredits && !isUrgent) return;
                            setIsUrgent(!isUrgent);
                        }}
                        disabled={!hasCredits && !isUrgent}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isUrgent
                                ? 'bg-red-500 text-white'
                                : 'bg-[#F0F2F5] dark:bg-[#2A3942] text-[#111B21] dark:text-[#E9EDEF] hover:bg-[#E4E6E9] dark:hover:bg-[#374045]'
                            } ${!hasCredits && !isUrgent ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <AlertIcon className={`w-4 h-4 ${isUrgent ? 'text-white' : 'text-red-500'}`} />
                        <span>{isUrgent ? 'Urgent ✓' : `Urgent (${urgentCredits})`}</span>
                    </button>
                </div>

                {/* Attachment Previews */}
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {attachments.map(attachment => (
                            <div key={attachment.id} className="relative group">
                                {attachment.type === 'image' ? (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                                        <img src={attachment.preview} alt="Attachment" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-[#F0F2F5] dark:bg-[#2A3942] flex flex-col items-center justify-center">
                                        <DocumentUploadIcon className="w-5 h-5 text-[#667781]" />
                                        <span className="text-[7px] text-[#667781] mt-0.5">
                                            {attachment.file.name.split('.').pop()?.toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <button
                                    onClick={() => removeAttachment(attachment.id)}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                <input ref={documentInputRef} type="file" accept=".pdf,.doc,.docx,.txt" multiple className="hidden" onChange={handleDocumentSelect} />

                {/* Send Button */}
                <button
                    onClick={handleSubmit}
                    disabled={!canSend}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${canSend
                            ? 'bg-[#25D366] hover:bg-[#1EBE5A] text-white shadow-md hover:shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        }`}
                >
                    {isSending || isUploading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Sending...
                        </span>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                            </svg>
                            Send Query
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default PatientQueryComposer;
