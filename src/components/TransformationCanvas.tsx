import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { FaceMesh } from './FaceMesh';

interface TransformationCanvasProps {
    landmarks: any;
    transformationIntensity: number;
    targetGender: 'male' | 'female';
}

export const TransformationCanvas: React.FC<TransformationCanvasProps> = ({
    landmarks,
    transformationIntensity,
    targetGender
}) => {
    return (
        <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
            <Canvas>
                <PerspectiveCamera makeDefault position={[0, 0, 2]} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />

                <Suspense fallback={null}>
                    {landmarks && (
                        <FaceMesh
                            landmarks={landmarks}
                            transformationIntensity={transformationIntensity}
                            targetGender={targetGender}
                        />
                    )}
                </Suspense>

                {/* <OrbitControls /> */}
            </Canvas>
        </div>
    );
};
