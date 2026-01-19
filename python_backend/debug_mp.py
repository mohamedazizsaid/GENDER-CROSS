import sys
import os

print(f"Python executable: {sys.executable}")
print(f"Python version: {sys.version}")

try:
    import mediapipe as mp
    print(f"MediaPipe version: {mp.__version__}")
    
    if hasattr(mp, 'tasks'):
        print("mp.tasks found")
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision
        
        FaceLandmarker = vision.FaceLandmarker
        FaceLandmarkerOptions = vision.FaceLandmarkerOptions
        BaseOptions = python.BaseOptions
        VisionRunningMode = vision.RunningMode
        print("Successfully imported FaceLandmarker classes from mp.tasks")
    else:
        print("mp.tasks NOT found")

    if hasattr(mp, 'solutions'):
        print("mp.solutions found")
    else:
        print("mp.solutions NOT found")

except Exception as e:
    print(f"Error: {e}")
