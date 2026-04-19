import {useCallback, useState} from 'react';
import * as FaceDetector from 'expo-face-detector';
import {FaceFeature} from 'expo-face-detector';

interface UseFaceDetectionReturn {
  faces: FaceFeature[];
  isProcessing: boolean;
  error: string | null;
  detectFaces: (imagePath: string) => Promise<void>;
  clearFaces: () => void;
}

export function useFaceDetection(): UseFaceDetectionReturn {
  const [faces, setFaces] = useState<FaceFeature[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectFaces = useCallback(async (imagePath: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await FaceDetector.detectFacesAsync(imagePath, {
        mode: FaceDetector.FaceDetectorMode.fast,
      });
      setFaces(result.faces);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed');
      setFaces([]);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const clearFaces = useCallback(() => {
    setFaces([]);
    setError(null);
  }, []);

  return {faces, isProcessing, error, detectFaces, clearFaces};
}