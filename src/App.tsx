import React, { useState, useEffect } from 'react';
import { useWebcam } from './hooks/useWebcam';
import { useFaceDetection } from './hooks/useFaceDetection';
import { TransformationCanvas } from './components/TransformationCanvas';
import { Settings, Zap, User, UserCheck } from 'lucide-react';
import './App.css';

const App: React.FC = () => {
  const { videoRef, startWebcam, error: webcamError } = useWebcam();
  const { landmarks, isReady } = useFaceDetection(videoRef);
  const [intensity, setIntensity] = useState(0.5);
  const [targetGender, setTargetGender] = useState<'male' | 'female'>('female');
  const [usePythonBackend, setUsePythonBackend] = useState(false);
  const [useAIModel, setUseAIModel] = useState(false);
  const [pythonImage, setPythonImage] = useState<string | null>(null);
  const socketRef = React.useRef<WebSocket | null>(null);

  useEffect(() => {
    startWebcam();
  }, [startWebcam]);

  useEffect(() => {
    if (usePythonBackend) {
      // Connect to WebSocket
      const ws = new WebSocket('ws://localhost:8000/ws');
      ws.onopen = () => console.log('Connected to Python Backend');
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.processed) {
          setPythonImage(data.processed);
        }
      };
      socketRef.current = ws;

      const interval = setInterval(() => {
        if (videoRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            socketRef.current.send(JSON.stringify({
              image: base64,
              gender: targetGender,
              intensity: intensity,
              use_ai_model: useAIModel
            }));
          }
        }
      }, useAIModel ? 200 : 50);

      return () => {
        clearInterval(interval);
        ws.close();
      };
    } else {
      setPythonImage(null);
    }
  }, [usePythonBackend, targetGender, intensity, useAIModel]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <Zap size={24} className="icon-zap" />
          <h1>GenderMorpher AI</h1>
        </div>
        <div className="status-bar">
          <span className={`status-pill ${isReady ? 'ready' : 'loading'}`}>
            {isReady ? 'System Ready' : 'Initializing AI...'}
          </span>
          {usePythonBackend && (
            <span className="status-pill ready" style={{ color: '#6366f1' }}>Python Active</span>
          )}
        </div>
      </header>

      <main className="viewport-container">
        <div className="video-viewport">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={usePythonBackend ? "hidden-video" : "hidden-video"}
            style={{ opacity: 1 }}
          />
          {usePythonBackend && pythonImage ? (
            <img src={pythonImage} alt="Processed" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute' }} />
          ) : (
            <TransformationCanvas
              landmarks={landmarks}
              transformationIntensity={intensity}
              targetGender={targetGender}
              videoRef={videoRef}
            />
          )}

          {!isReady && (
            <div className="loading-overlay">
              <div className="loader"></div>
              <p>Loading Deep Learning Models...</p>
            </div>
          )}

          {isReady && !landmarks && !webcamError && (
            <div className="no-face-overlay">
              <p>No Face Detected. Please look at the camera.</p>
            </div>
          )}

          {webcamError && (
            <div className="error-overlay">
              <p>{webcamError}</p>
            </div>
          )}
        </div>

        <aside className="controls-panel">
          <section className="control-group">
            <h3><Settings size={18} /> Transformation Controls</h3>
            <div className="control-item">
              <label>Target Gender</label>
              <div className="gender-switch">
                <button
                  className={targetGender === 'male' ? 'active' : ''}
                  onClick={() => setTargetGender('male')}
                >
                  <User size={16} /> Male
                </button>
                <button
                  className={targetGender === 'female' ? 'active' : ''}
                  onClick={() => setTargetGender('female')}
                >
                  <UserCheck size={16} /> Female
                </button>
              </div>
            </div>
            <div className="control-item">
              <label>Intensity: {Math.round(intensity * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={intensity}
                onChange={(e) => setIntensity(parseFloat(e.target.value))}
              />
            </div>
            <div className="control-item">
              <label>Processing Mode</label>
              <div className="gender-switch">
                <button
                  className={!usePythonBackend ? 'active' : ''}
                  onClick={() => setUsePythonBackend(false)}
                >
                  Client (WebGL)
                </button>
                <button
                  className={usePythonBackend && !useAIModel ? 'active' : ''}
                  onClick={() => {
                    setUsePythonBackend(true);
                    setUseAIModel(false);
                  }}
                >
                  Geo Morph
                </button>
                <button
                  className={usePythonBackend && useAIModel ? 'active' : ''}
                  onClick={() => {
                    setUsePythonBackend(true);
                    setUseAIModel(true);
                  }}
                >
                  AI Swap (ONNX)
                </button>
              </div>
            </div>
          </section>

          <section className="info-panel">
            <h3>AI Statistics</h3>
            <div className="stat-item">
              <span>Resolution:</span>
              <span>1280x720</span>
            </div>
            <div className="stat-item">
              <span>Tracking Points:</span>
              <span>468 Landmarks</span>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
};

export default App;
