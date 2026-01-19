import { useState, useCallback, useRef, useEffect } from 'react';

export const useWebcam = () => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const startWebcam = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            setError('Failed to access webcam. Please ensure camera permissions are granted.');
            console.error('Webcam access error:', err);
        }
    }, []);

    const stopWebcam = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }, [stream]);

    useEffect(() => {
        return () => {
            stopWebcam();
        };
    }, [stopWebcam]);

    return {
        stream,
        error,
        videoRef,
        startWebcam,
        stopWebcam
    };
};
