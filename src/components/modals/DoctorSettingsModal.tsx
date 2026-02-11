import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../lib/canvasUtils';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface DoctorSettingsModalProps {
    doctor: any;
    onClose: () => void;
    onUpdate: () => void; // Callback to refresh doctor data
}

const DoctorSettingsModal: React.FC<DoctorSettingsModalProps> = ({ doctor, onClose, onUpdate }) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [currentSignature, setCurrentSignature] = useState<string | null>(null);

    // Camera States
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    // Fetch current signature on mount
    useEffect(() => {
        if (doctor?.signature_url) {
            setCurrentSignature(doctor.signature_url);
        }
    }, [doctor]);

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => setImageSrc(reader.result as string));
            reader.readAsDataURL(file);
        }
    };

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    // Attach stream to video element when it becomes available
    useEffect(() => {
        if (showCamera && stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [showCamera, stream]);

    const startCamera = async () => {
        try {
            // Try back camera first
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                setStream(mediaStream);
                setShowCamera(true);
            } catch (envError) {
                console.warn("Environment camera not found, trying default...", envError);
                // Fallback to any available camera
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: true
                });
                setStream(mediaStream);
                setShowCamera(true);
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            toast.error("Could not access camera. Please check permissions.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setShowCamera(false);
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0);
                setImageSrc(canvas.toDataURL('image/png'));
                stopCamera();
            }
        }
    };

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    const uploadSignature = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        setIsUploading(true);
        const toastId = toast.loading('Processing signature...');

        try {
            // 1. Get cropped image blob
            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            if (!croppedImageBlob) throw new Error('Could not crop image');

            // 2. Define path
            const filePath = `signatures/${doctor.id}-${Date.now()}.png`;

            // 3. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('doctor-signatures')
                .upload(filePath, croppedImageBlob, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 4. Get Public URL
            const { data } = supabase.storage
                .from('doctor-signatures')
                .getPublicUrl(filePath);

            const signatureUrl = data.publicUrl;

            // 5. Update Doctor Profile
            const { error: updateError } = await (supabase
                .from('hospital_doctors') as any)
                .update({ signature_url: signatureUrl })
                .eq('id', doctor.id);

            if (updateError) throw updateError;

            toast.success('Signature updated successfully!', { id: toastId });
            onUpdate(); // Refresh parent
            onClose();

        } catch (error: any) {
            console.error('Error uploading signature:', error);
            toast.error(error.message || 'Failed to upload signature', { id: toastId });
        } finally {
            setIsUploading(false);
        }
    };

    const deleteSignature = async () => {
        if (!confirm('Are you sure you want to remove your signature?')) return;

        setIsUploading(true);
        try {
            const { error } = await (supabase
                .from('hospital_doctors') as any)
                .update({ signature_url: null })
                .eq('id', doctor.id);

            if (error) throw error;

            toast.success('Signature removed');
            setCurrentSignature(null);
            onUpdate();
        } catch (error: any) {
            console.error('Error removing signature:', error);
            toast.error('Failed to remove signature');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Doctor Settings</h3>
                        <p className="text-sm text-gray-500">Manage your digital signature</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {/* Current Signature Display */}
                    {!imageSrc && (
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Current Signature</label>
                            <div className="h-32 w-full border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden relative group">
                                {currentSignature ? (
                                    <>
                                        <img src={currentSignature} alt="Current Signature" className="h-full object-contain p-2" />
                                        <button
                                            onClick={deleteSignature}
                                            disabled={isUploading}
                                            className="absolute top-2 right-2 p-2 bg-white/90 text-red-600 rounded-lg shadow-sm hover:bg-red-50 transition-colors border border-red-100"
                                            title="Remove Signature"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </>
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        <p className="text-sm font-medium">No signature uploaded</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Editor / Uploader / Camera */}
                    {showCamera ? (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    onLoadedMetadata={() => videoRef.current?.play()}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={stopCamera}
                                    className="flex-1 px-4 py-3 border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={capturePhoto}
                                    className="flex-1 px-4 py-3 bg-white border-4 border-blue-500 text-blue-600 font-bold rounded-full hover:bg-blue-50 transition-all flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                                    Capture
                                </button>
                            </div>
                        </div>
                    ) : imageSrc ? (
                        <div className="space-y-4">
                            <div className="relative w-full h-64 bg-gray-900 rounded-xl overflow-hidden border border-gray-200">
                                <Cropper
                                    image={imageSrc}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={3 / 1} // Signature aspect ratio (Width:Height)
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                    objectFit="contain"
                                    showGrid={true}
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <span className="text-xs font-bold text-gray-500 uppercase">Zoom</span>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    aria-labelledby="Zoom"
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setImageSrc(null)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={uploadSignature}
                                    disabled={isUploading}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isUploading ? 'Saving...' : 'Save Signature'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="cursor-pointer group relative">
                                <input type="file" accept="image/*" onChange={onFileChange} className="hidden" />
                                <div className="h-32 bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl flex flex-col items-center justify-center text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-all">
                                    <svg className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    <span className="font-bold text-sm">Upload Image</span>
                                    <span className="text-[10px] text-blue-400 mt-1 uppercase tracking-wider">PNG / JPG</span>
                                </div>
                            </label>

                            <button
                                onClick={startCamera}
                                className="h-32 bg-purple-50 border-2 border-purple-200 border-dashed rounded-xl flex flex-col items-center justify-center text-purple-600 hover:bg-purple-100 hover:border-purple-300 transition-all group"
                            >
                                <svg className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <span className="font-bold text-sm">Use Camera</span>
                                <span className="text-[10px] text-purple-400 mt-1 uppercase tracking-wider">Take Photo</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DoctorSettingsModal;
