import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceDetectionService } from '../services/FaceDetectionService';

export const useFaceDetection = (videoRef: React.RefObject<HTMLVideoElement | null>) => {
    const [landmarks, setLandmarks] = useState<any>(null);
    const [isReady, setIsReady] = useState(false);
    const requestRef = useRef<number | null>(null);

    const initialize = useCallback(async () => {
        const faceService = FaceDetectionService.getInstance();
        await faceService.initialize();
        setIsReady(true);
    }, []);

    const detect = useCallback(async () => {
        if (!videoRef.current || !isReady) return;

        const video = videoRef.current;
        if (video.readyState < 2 || video.videoWidth <= 2) {
            requestRef.current = requestAnimationFrame(detect);
            return;
        }

        const faceService = FaceDetectionService.getInstance();
        const timestamp = performance.now();
        const detectionResult = faceService.detect(video, timestamp);

        if (detectionResult && detectionResult.faceLandmarks.length > 0) {
            setLandmarks(detectionResult.faceLandmarks[0]);
        } else {
            setLandmarks(null);
        }

        requestRef.current = requestAnimationFrame(detect);
    }, [isReady, videoRef]);

    useEffect(() => {
        initialize();
    }, [initialize]);

    useEffect(() => {
        if (isReady) {
            requestRef.current = requestAnimationFrame(detect);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isReady, detect]);

    return { landmarks, isReady };
};
