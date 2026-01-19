import { useState, useCallback, useRef, useEffect } from 'react';

export const useWebcam = () => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const stopWebcam = useCallback(() => {
        console.log("useWebcam: stopWebcam called");
        if (streamRef.current) {
            console.log("useWebcam: Stopping tracks...");
            streamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log(`Track ${track.kind} stopped`);
            });
            streamRef.current = null;
        }
        setStream(null);
    }, []);

    const startWebcam = useCallback(async () => {
        if (streamRef.current) {
            console.log("useWebcam: Webcam already started");
            return;
        }

        console.log("useWebcam: startWebcam called");
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            });

            console.log("useWebcam: Received MediaStream", mediaStream.id);
            streamRef.current = mediaStream;
            setStream(mediaStream);

            if (videoRef.current) {
                const video = videoRef.current;
                video.srcObject = mediaStream;
                video.onloadedmetadata = () => {
                    console.log(`useWebcam: metadata loaded ${video.videoWidth}x${video.videoHeight}`);
                    video.play().catch(e => console.error("Video play error:", e));
                };
            }
        } catch (err) {
            setError('Failed to access webcam. Please ensure camera permissions are granted.');
            console.error('Webcam access error:', err);
        }
    }, []);

    useEffect(() => {
        return () => {
            console.log("useWebcam: useEffect cleanup (unmount or dep change)");
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
