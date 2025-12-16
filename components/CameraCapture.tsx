import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CameraIcon } from './icons/CameraIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XIcon } from './icons/XIcon';

interface CameraCaptureProps {
  onPhotoTaken: (file: File) => void;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onPhotoTaken, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please ensure permissions are granted and try again.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPhotoDataUrl(dataUrl);
        stopCamera();
      }
    }
  };
  
  const handleRetake = () => {
    setPhotoDataUrl(null);
    startCamera();
  };

  const handleUsePhoto = () => {
    if (photoDataUrl && canvasRef.current) {
      canvasRef.current.toBlob(blob => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onPhotoTaken(file);
        }
      }, 'image/jpeg');
    }
  };

  return (
    <div className="bg-gray-800 text-white p-4 rounded-lg shadow-2xl w-full max-w-2xl relative">
      <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full bg-black/30 hover:bg-black/50 z-10">
        <XIcon className="h-6 w-6"/>
      </button>

      {error ? (
        <div className="p-8 text-center">
            <h3 className="text-xl font-bold text-red-400 mb-2">Camera Error</h3>
            <p className="text-gray-300">{error}</p>
        </div>
      ) : (
        <div className="relative">
            {photoDataUrl ? (
                <img src={photoDataUrl} alt="Captured" className="w-full h-auto rounded-md" />
            ) : (
                <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-md" />
            )}
            
            <canvas ref={canvasRef} className="hidden" />

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                {photoDataUrl ? (
                    <>
                        <button onClick={handleRetake} className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-full font-semibold transition-colors">
                            <RefreshIcon className="h-5 w-5"/>
                            Retake
                        </button>
                        <button onClick={handleUsePhoto} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-full font-semibold transition-colors">
                            <CheckIcon className="h-5 w-5"/>
                            Use Photo
                        </button>
                    </>
                ) : (
                    <button onClick={handleCapture} className="p-4 rounded-full bg-white/30 backdrop-blur-sm ring-4 ring-white/50 hover:bg-white/50 transition-all">
                        <CameraIcon className="h-8 w-8 text-white"/>
                    </button>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;
