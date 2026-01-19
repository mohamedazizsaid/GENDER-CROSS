import * as faceapi from '@vladmandic/face-api';

export class GenderClassificationService {
    private static instance: GenderClassificationService;
    private initialized = false;

    private constructor() { }

    public static getInstance(): GenderClassificationService {
        if (!GenderClassificationService.instance) {
            GenderClassificationService.instance = new GenderClassificationService();
        }
        return GenderClassificationService.instance;
    }

    public async initialize() {
        if (this.initialized) return;

        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
        ]);

        this.initialized = true;
    }

    public async classify(video: HTMLVideoElement) {
        if (!this.initialized) return null;

        const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withAgeAndGender();

        return result || null;
    }
}
