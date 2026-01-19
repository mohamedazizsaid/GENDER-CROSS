import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export class FaceDetectionService {
    private faceLandmarker: FaceLandmarker | null = null;
    private static instance: FaceDetectionService;

    private constructor() { }

    public static getInstance(): FaceDetectionService {
        if (!FaceDetectionService.instance) {
            FaceDetectionService.instance = new FaceDetectionService();
        }
        return FaceDetectionService.instance;
    }

    public async initialize(): Promise<void> {
        if (this.faceLandmarker) return;

        const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            outputFaceBlendshapes: true,
            runningMode: "VIDEO",
            numFaces: 1
        });
    }

    public detect(video: HTMLVideoElement, timestamp: number) {
        if (!this.faceLandmarker) return null;
        return this.faceLandmarker.detectForVideo(video, timestamp);
    }
}
