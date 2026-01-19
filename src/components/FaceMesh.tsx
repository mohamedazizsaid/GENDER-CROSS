import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TRIANGULATION } from '../utils/triangulation';

interface FaceMeshProps {
    landmarks: any[];
    transformationIntensity: number;
    targetGender: 'male' | 'female';
    videoRef: React.RefObject<HTMLVideoElement | null>;
}

// Landmark groups for morphing
const JAWLINE = [58, 172, 136, 150, 149, 148, 152, 377, 378, 379, 365, 397, 288];
const CHEEKBONES = [205, 425, 123, 352];
const BROW_RIDGE = [107, 336, 105, 334];
const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];

export const FaceMesh: React.FC<FaceMeshProps> = ({ landmarks, transformationIntensity, targetGender, videoRef }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const geometryRef = useRef<THREE.BufferGeometry>(null);

    const positions = useMemo(() => new Float32Array(468 * 3), []);
    const uvs = useMemo(() => new Float32Array(468 * 2), []);

    const videoTexture = useMemo(() => {
        if (!videoRef.current) return null;
        const texture = new THREE.VideoTexture(videoRef.current);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.format = THREE.RGBAFormat;
        return texture;
    }, [videoRef]);

    useFrame(() => {
        if (!landmarks || !geometryRef.current) return;

        const posAttr = geometryRef.current.attributes.position as THREE.BufferAttribute;
        const uvAttr = geometryRef.current.attributes.uv as THREE.BufferAttribute;

        for (let i = 0; i < landmarks.length; i++) {
            // Original coordinates for UV mapping (0 to 1)
            const origX = landmarks[i].x;
            const origY = landmarks[i].y;

            // Mapping to 3D space (-1 to 1)
            let x = origX * 2 - 1;
            let y = -(origY * 2 - 1);
            let z = landmarks[i].z * -1;

            // UVs should match the original video frame coordinates
            uvAttr.setXY(i, origX, 1 - origY);

            // Transformation Logic
            const intensity = transformationIntensity;

            if (targetGender === 'female') {
                // 1. Thinning the Jawline (more aggressive)
                if (JAWLINE.includes(i)) {
                    x *= (1 - 0.08 * intensity);
                    y += 0.02 * intensity;
                }
                // 2. Lifting Cheekbones
                if (CHEEKBONES.includes(i)) {
                    y += 0.025 * intensity;
                    z += 0.015 * intensity;
                }
                // 3. Refining Lips (fuller and slightly higher)
                if (LIPS.includes(i)) {
                    z += 0.01 * intensity;
                    y += 0.005 * intensity;
                }
            } else {
                // 4. Broadening Jawline
                if (JAWLINE.includes(i)) {
                    x *= (1 + 0.08 * intensity);
                    y -= 0.01 * intensity;
                }
                // 5. Lowering Brow Ridge
                if (BROW_RIDGE.includes(i)) {
                    y -= 0.015 * intensity;
                }
            }

            posAttr.setXYZ(i, x, y, z);
        }

        posAttr.needsUpdate = true;
        uvAttr.needsUpdate = true;
        geometryRef.current.computeVertexNormals();
    });

    return (
        <mesh ref={meshRef} scale={[1, 1, 1]}>
            <bufferGeometry ref={geometryRef}>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
                <bufferAttribute
                    attach="attributes-uv"
                    args={[uvs, 2]}
                />
                {TRIANGULATION.length > 0 && (
                    <bufferAttribute
                        attach="index"
                        args={[TRIANGULATION, 1]}
                    />
                )}
            </bufferGeometry>
            {videoTexture && (
                <meshStandardMaterial
                    map={videoTexture}
                    side={THREE.DoubleSide}
                    transparent={true}
                    opacity={1.0}
                    roughness={0.3}
                    metalness={0.0}
                />
            )}
        </mesh>
    );
};
