/**
 * feedbackPhoto — a camera frame or a gallery file, made fit to upload
 *
 * Every photo is re-drawn through a canvas and re-encoded as a JPEG before it
 * leaves the phone. Two reasons, and the second is the one that matters:
 *
 *   · size: a phone photo is 3–8 MB, the bucket takes 5, and hospital wifi
 *     drops. 1600px on the long edge is plenty to see a dirty floor or a
 *     broken rail, and lands around 200–500 KB.
 *   · privacy: a gallery photo carries EXIF, often with the GPS position it was
 *     taken at. The form promises "we do not store your location", so the
 *     original file is never uploaded — only pixels drawn into a fresh canvas,
 *     which has no EXIF at all. If a photo cannot be decoded and re-drawn, it
 *     is refused rather than sent as it was.
 *
 * Orientation: browsers apply the EXIF rotation when they decode an <img>
 * (Chrome 81+, Safari 13.1+, Firefox 77+), and naturalWidth/naturalHeight
 * already reflect it, so a portrait photo stays portrait after re-drawing.
 */
import type { FeedbackPhoto } from '../../services/feedbackService';

export const PHOTO_MAX_EDGE = 1600;
const QUALITY = 0.82;
const QUALITY_FALLBACK = 0.6;
/** Under the bucket's 5 MB, with room to spare. */
const MAX_BYTES = 4.5 * 1024 * 1024;

export type PhotoErrorCode = 'unreadable' | 'encode';

export class PhotoError extends Error {
    code: PhotoErrorCode;
    constructor(code: PhotoErrorCode, message: string) {
        super(message);
        this.name = 'PhotoError';
        this.code = code;
    }
}

/** Scale (w, h) down to fit `max` on the long edge. Never scales up. */
export function fitWithin(w: number, h: number, max: number = PHOTO_MAX_EDGE): { width: number; height: number } {
    if (!(w > 0) || !(h > 0)) return { width: 0, height: 0 };
    const scale = Math.min(1, max / Math.max(w, h));
    return {
        width: Math.max(1, Math.round(w * scale)),
        height: Math.max(1, Math.round(h * scale)),
    };
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
    new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));

async function encode(source: CanvasImageSource, srcW: number, srcH: number): Promise<FeedbackPhoto> {
    const { width, height } = fitWithin(srcW, srcH);
    if (!width || !height) throw new PhotoError('unreadable', 'The photo has no size');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PhotoError('encode', 'Could not prepare the photo');
    // A transparent PNG would otherwise turn black in a JPEG.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    let blob = await toBlob(canvas, QUALITY);
    if (blob && blob.size > MAX_BYTES) blob = await toBlob(canvas, QUALITY_FALLBACK);
    // Release the bitmap now; on a low-end phone a few of these add up.
    canvas.width = 0;
    canvas.height = 0;
    if (!blob || blob.size === 0 || blob.size > MAX_BYTES) throw new PhotoError('encode', 'Could not prepare the photo');
    return { blob, width, height };
}

/** A file from the gallery (or the phone's own camera app). */
export async function photoFromFile(file: File): Promise<FeedbackPhoto> {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            // HEIC on a browser that cannot decode it, a PDF picked by mistake.
            i.onerror = () => reject(new PhotoError('unreadable', 'This photo could not be opened'));
            i.src = url;
        });
        return await encode(img, img.naturalWidth, img.naturalHeight);
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** The frame a live camera preview is showing right now. */
export async function photoFromVideo(video: HTMLVideoElement): Promise<FeedbackPhoto> {
    return encode(video, video.videoWidth, video.videoHeight);
}
