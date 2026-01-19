import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceDetectionService } from '../services/FaceDetectionService';
import { GenderClassificationService } from '../services/GenderClassificationService';

export const useFaceDetection = (videoRef: React.RefObject<HTMLVideoElement | null>) => {
    const [landmarks, setLandmarks] = useState<any>(null);
    const [gender, setGender] = useState<{ gender: string; probability: number } | null>(null);
    const [isReady, setIsReady] = useState(false);
    const requestRef = useRef<number | null>(null);

    const initialize = useCallback(async () => {
        const faceService = FaceDetectionService.getInstance();
        const genderService = GenderClassificationService.getInstance();

        await Promise.all([
            faceService.initialize(),
            genderService.initialize()
        ]);

        setIsReady(true);
    }, []);

    const detect = useCallback(async () => {
        if (!videoRef.current || !isReady) return;

        const video = videoRef.current;
        if (video.readyState < 2) {
            requestRef.current = requestAnimationFrame(detect);
            return;
        }

        const faceService = FaceDetectionService.getInstance();
        const genderService = GenderClassificationService.getInstance();

        const timestamp = performance.now();
        const detectionResult = faceService.detect(video, timestamp);

        if (detectionResult && detectionResult.faceLandmarks.length > 0) {
            setLandmarks(detectionResult.faceLandmarks[0]);

            // Gender detection can be less frequent for performance
            if (Math.random() > 0.95) {
                const gResult = await genderService.classify(video);
                if (gResult) {
                    setGender({ gender: gResult.gender, probability: gResult.genderProbability });
                }
            }
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

    return { landmarks, gender, isReady };
};
