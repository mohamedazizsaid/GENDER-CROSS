import cv2
import numpy as np
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
import onnxruntime
import os
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    print("Startup: Listing Routes...")
    for route in app.routes:
        print(f"Route: {route.path} {route.name}")
    print("Startup: Routes Listed.")

@app.get("/")
def read_root():
    return {"status": "running"}

# Initialize MediaPipe Face Landmarker (Tasks API)
start_time_timestamp = 0
try:
    base_options = python.BaseOptions(model_asset_path='face_landmarker.task')
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
        num_faces=1)
    detector = vision.FaceLandmarker.create_from_options(options)
    print("MediaPipe FaceLandmarker loaded successfully.")
except Exception as e:
    print(f"Error loading MediaPipe FaceLandmarker: {e}")
    detector = None

# Face Analysis Helper
class FaceSwapper:
    def __init__(self, swap_model_path, arcface_model_path, reference_image_path):
        self.swap_session = onnxruntime.InferenceSession(swap_model_path, providers=['CPUExecutionProvider'])
        self.arcface_session = onnxruntime.InferenceSession(arcface_model_path, providers=['CPUExecutionProvider'])
        self.source_embedding = self._get_embedding(reference_image_path)
        
        # Standard 5 landmarks for 112x112 alignment (ArcFace)
        self.kps_standard = np.array([
            [38.2946, 51.6963],
            [73.5318, 51.5014],
            [56.0252, 71.7366],
            [41.5493, 92.3655],
            [70.7299, 92.2041]
        ], dtype=np.float32)

    def _get_embedding(self, image_path):
        img = cv2.imread(image_path)
        if img is None:
            print("Error loading reference image")
            return np.zeros((512,), dtype=np.float32)

        blob = cv2.resize(img, (112, 112))
        blob = blob.transpose((2, 0, 1)) # C,H,W
        blob = np.expand_dims(blob, axis=0).astype(np.float32)
        blob = (blob - 127.5) / 128.0
        
        input_name = self.arcface_session.get_inputs()[0].name
        embedding = self.arcface_session.run(None, {input_name: blob})[0]
        
        embedding = embedding.flatten()
        norm = np.linalg.norm(embedding)
        return embedding / norm

    def process(self, target_img, landmarks):
        # MP indices: Left Eye: 33, Right Eye: 263, Nose: 1, Mouth Left: 61, Mouth Right: 291
        kp_indices = [33, 263, 1, 61, 291]
        kps_target = []
        h, w = target_img.shape[:2]
        for idx in kp_indices:
            lm = landmarks[idx] # Tasks API returns list of NormalizedLandmark
            kps_target.append([lm.x * w, lm.y * h])
        kps_target = np.array(kps_target, dtype=np.float32)
        
        M = self._estimate_norm(kps_target, 128)
        
        aligned_face = cv2.warpAffine(target_img, M, (128, 128))
        
        test_blob = aligned_face.transpose((2, 0, 1))
        test_blob = np.expand_dims(test_blob, axis=0).astype(np.float32)
        test_blob /= 255.0 
        
        input_names = [i.name for i in self.swap_session.get_inputs()]
        source_emb = self.source_embedding.reshape((1, 512))
        
        pred = self.swap_session.run(None, {
            input_names[0]: test_blob, 
            input_names[1]: source_emb
        })[0]
        
        res_face = pred[0].transpose((1, 2, 0)) * 255.0
        res_face = np.clip(res_face, 0, 255).astype(np.uint8)
        
        img_white = np.ones((128, 128), dtype=np.uint8) * 255
        mask = cv2.warpAffine(img_white, M, (w, h), flags=cv2.WARP_INVERSE_MAP)
        inv_face = cv2.warpAffine(res_face, M, (w, h), flags=cv2.WARP_INVERSE_MAP)
        
        # Soft blending
        mask = cv2.GaussianBlur(mask, (5, 5), 0)
        
        target_img = target_img.astype(np.float32)
        inv_face = inv_face.astype(np.float32)
        
        # Normalize mask to 0-1
        alpha = mask.astype(np.float32) / 255.0
        
        # Ensure alpha is 3D for broadcasting against (H,W,3) images
        if len(alpha.shape) == 2:
            alpha = np.expand_dims(alpha, axis=-1)
            
        try:
            target_img = (1.0 - alpha) * target_img + alpha * inv_face
        except Exception as e:
            print(f"Swap Error: {e} | Shapes -> alpha:{alpha.shape}, target:{target_img.shape}, inv:{inv_face.shape}")
            return target_img.astype(np.uint8) # Return original on failure
        
        return target_img.astype(np.uint8)

    def _estimate_norm(self, lm, image_size=112):
        src = lm
        dst = self.kps_standard * (image_size / 112.0)
        M, _ = cv2.estimateAffinePartial2D(src, dst)
        return M

# Initialize global swapper
swapper = None
try:
    SWAP_MODEL = "inswapper_128.onnx"
    ARCFACE_MODEL = "w600k_r50.onnx"
    # Update this path if needed to be absolute, or ensure CWD is correct
    REF_IMG = r"C:/Users/user/Desktop/Gender_React/python_backend/female_reference_face_1768852709765.png"
    
    if os.path.exists(SWAP_MODEL) and os.path.exists(ARCFACE_MODEL):
        print("Initializing AI Models...")
        swapper = FaceSwapper(SWAP_MODEL, ARCFACE_MODEL, REF_IMG)
        print("AI Models Ready.")
    else:
        print(f"AI Models not found. Swap: {os.path.exists(SWAP_MODEL)}, Arc: {os.path.exists(ARCFACE_MODEL)}")
except Exception as e:
    print(f"Failed to load AI models: {e}")

# Thin Plate Spline implementation
def apply_tps_morph(image, src_points, dst_points):
    try:
        h, w = image.shape[:2]
        matches = []
        for i in range(len(src_points)):
            matches.append(cv2.DMatch(i, i, 0))
        tps = cv2.createThinPlateSplineShapeTransformer()
        src_pts_arr = np.array(src_points, np.float32).reshape(1, -1, 2)
        dst_pts_arr = np.array(dst_points, np.float32).reshape(1, -1, 2)
        tps.estimateTransformation(dst_pts_arr, src_pts_arr, matches)
        return tps.warpImage(image)
    except Exception as e:
        print(f"TPS Error: {e}")
        return image

def morph_face(image, landmarks, target_gender, intensity):
    h, w, _ = image.shape
    src_points = []
    dst_points = []
    
    # Tasks API: landmarks is a list of NormalizedLandmark objects
    for i, lm in enumerate(landmarks):
        x = int(lm.x * w)
        y = int(lm.y * h)
        src_points.append([x, y])
        dst_points.append([x, y]) 
    
    moves = {}
    if target_gender == 'female':
        for idx in [365, 379, 361, 288, 397]: 
            moves[idx] = (-0.03 * intensity * w, -0.01 * intensity * h) 
        for idx in [136, 150, 132, 58, 172]: 
            moves[idx] = (0.03 * intensity * w, -0.01 * intensity * h)
        moves[205] = (-0.01 * intensity * w, -0.02 * intensity * h)
        moves[123] = (0.01 * intensity * w, -0.02 * intensity * h)
        moves[159] = (0, -0.015 * intensity * h) 
        moves[386] = (0, -0.015 * intensity * h)

    elif target_gender == 'male':
        for idx in [365, 379, 361, 288, 397]: 
            moves[idx] = (0.04 * intensity * w, 0.01 * intensity * h)
        for idx in [136, 150, 132, 58, 172]: 
            moves[idx] = (-0.04 * intensity * w, 0.01 * intensity * h)
        moves[107] = (0, 0.015 * intensity * h)
        moves[70] = (0, 0.015 * intensity * h)
        moves[300] = (0, 0.015 * intensity * h)

    for idx, (dx, dy) in moves.items():
        if idx < len(dst_points):
            dst_points[idx][0] += int(dx)
            dst_points[idx][1] += int(dy)

    border_points = [
        [0, 0], [w//2, 0], [w-1, 0], [0, h//2], [w-1, h//2],
        [0, h-1], [w//2, h-1], [w-1, h-1]
    ]
    for p in border_points:
        src_points.append(p)
        dst_points.append(p)

    image = apply_tps_morph(image, src_points, dst_points)

    if target_gender == 'female':
        smooth = cv2.bilateralFilter(image, 9, 75, 75)
        image = cv2.addWeighted(image, 0.6, smooth, 0.4, 0)
    elif target_gender == 'male':
        kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
        sharpened = cv2.filter2D(image, -1, kernel)
        image = cv2.addWeighted(image, 0.8, sharpened, 0.2, 0)
    return image

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            image_data = message.get("image")
            target_gender = message.get("gender", "female")
            intensity = message.get("intensity", 0.5)
            use_ai_model = message.get("use_ai_model", False)
            
            # Decode image
            encoded_data = image_data.split(',')[1]
            nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                print("Error: Failed to decode image")
                continue # Skip this frame

            
            # Process Frame with MP Tasks API
            if detector:
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
                
                # Use detect() for image mode (simplest for avoiding timestamp issues in async loop)
                # Or use detect_async() but that requires callback.
                # For websocket loop, synchronous detect() is fine for now on single frame.
                detection_result = detector.detect(mp_image)
                
                if detection_result.face_landmarks:
                    for face_landmarks in detection_result.face_landmarks:
                        # face_landmarks is a list of NormalizedLandmark
                        if use_ai_model and swapper and target_gender == 'female':
                            try:
                                frame = swapper.process(frame, face_landmarks)
                            except Exception as e:
                                print(f"Swap Error: {e}")
                                frame = morph_face(frame, face_landmarks, target_gender, intensity)
                        else:
                            frame = morph_face(frame, face_landmarks, target_gender, intensity)
            
            # Encode back to base64
            _, buffer = cv2.imencode('.jpg', frame)
            processed_image_str = base64.b64encode(buffer).decode('utf-8')
            
            await websocket.send_text(json.dumps({
                "processed": f"data:image/jpeg;base64,{processed_image_str}"
            }))
            
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
