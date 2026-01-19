import React, { useRef, useState, useEffect } from 'react';
import { useWebcam } from './hooks/useWebcam';
import { useFaceDetection } from './hooks/useFaceDetection';
import { TransformationCanvas } from './components/TransformationCanvas';
import { Settings, Camera, Zap, User, UserCheck } from 'lucide-react';
import './App.css';

const App: React.FC = () => {
  const { videoRef, startWebcam, error: webcamError } = useWebcam();
  const { landmarks, gender, isReady } = useFaceDetection(videoRef);
  const [intensity, setIntensity] = useState(0.5);
  const [targetGender, setTargetGender] = useState<'male' | 'female'>('female');

  useEffect(() => {
    startWebcam();
  }, [startWebcam]);

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
          {gender && (
            <span className="gender-pill">
              Detected: {gender.gender} ({Math.round(gender.probability * 100)}%)
            </span>
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
            className="hidden-video"
          />
          <TransformationCanvas
            landmarks={landmarks}
            transformationIntensity={intensity}
            targetGender={targetGender}
          />

          {!isReady && (
            <div className="loading-overlay">
              <div className="loader"></div>
              <p>Loading Deep Learning Models...</p>
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
