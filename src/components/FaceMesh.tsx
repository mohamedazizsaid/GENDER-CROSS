import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TRIANGULATION } from '../utils/triangulation';

interface FaceMeshProps {
    landmarks: any[];
    transformationIntensity: number;
    targetGender: 'male' | 'female';
}

// Landmark groups for morphing
const JAWLINE = [58, 172, 136, 150, 149, 148, 152, 377, 378, 379, 365, 397, 288];
const CHEEKBONES = [205, 425, 123, 352];
const BROW_RIDGE = [107, 336, 105, 334];
const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];

export const FaceMesh: React.FC<FaceMeshProps> = ({ landmarks, transformationIntensity, targetGender }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const geometryRef = useRef<THREE.BufferGeometry>(null);

    const positions = useMemo(() => new Float32Array(468 * 3), []);

    useFrame(() => {
        if (!landmarks || !geometryRef.current) return;

        const posAttr = geometryRef.current.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < landmarks.length; i++) {
            let x = landmarks[i].x * 2 - 1;
            let y = -(landmarks[i].y * 2 - 1);
            let z = landmarks[i].z * -1; // Depth

            // Transformation Logic
            const intensity = transformationIntensity;

            if (targetGender === 'female') {
                // 1. Thinning the Jawline
                if (JAWLINE.includes(i)) {
                    x *= (1 - 0.05 * intensity);
                    y += 0.01 * intensity;
                }
                // 2. Lifting Cheekbones
                if (CHEEKBONES.includes(i)) {
                    y += 0.015 * intensity;
                    z += 0.01 * intensity;
                }
                // 3. Refining Lips (slightly fuller)
                if (LIPS.includes(i)) {
                    // Pull lips slightly outwards/forwards
                    z += 0.005 * intensity;
                }
            } else {
                // 4. Broadening Jawline
                if (JAWLINE.includes(i)) {
                    x *= (1 + 0.05 * intensity);
                }
                // 5. Lowering Brow Ridge
                if (BROW_RIDGE.includes(i)) {
                    y -= 0.01 * intensity;
                }
            }

            posAttr.setXYZ(i, x, y, z);
        }

        posAttr.needsUpdate = true;
        geometryRef.current.computeVertexNormals();
    });

    return (
        <mesh ref={meshRef} scale={[1, 1, 1]}>
            <bufferGeometry ref={geometryRef}>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
                {/* We'll use the triangulation if provided, otherwise wireframe for now */}
                {TRIANGULATION.length > 0 && (
                    <bufferAttribute
                        attach="index"
                        args={[TRIANGULATION, 1]}
                    />
                )}
            </bufferGeometry>
            <meshStandardMaterial
                color={targetGender === 'female' ? "#ffdbac" : "#e0ac69"}
                roughness={0.4}
                metalness={0.1}
                transparent
                opacity={0.85}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
};
