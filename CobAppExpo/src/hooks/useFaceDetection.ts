import {useCallback, useState} from 'react';
import * as FaceDetector from 'expo-face-detector';
import {FaceFeature} from 'expo-face-detector';
import * as VideoThumbnails from 'expo-video-thumbnails';

export interface FrameDetectionResult {
  timestamp: number;
  faces: FaceFeature[];
  thumbnailUri: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
  isRotated: boolean;
}

interface UseFaceDetectionReturn {
  faces: FaceFeature[];
  isProcessing: boolean;
  error: string | null;
  detectFaces: (imagePath: string) => Promise<void>;
  clearFaces: () => void;
  detectFacesInVideo: (
    videoUri: string,
    durationMs: number,
    onProgress?: (progress: number) => void,
  ) => Promise<FrameDetectionResult[]>;
  frameResults: FrameDetectionResult[];
  isProcessingVideo: boolean;
  videoProgress: number;
}

export function useFaceDetection(): UseFaceDetectionReturn {
  const [faces, setFaces] = useState<FaceFeature[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameResults, setFrameResults] = useState<FrameDetectionResult[]>([]);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  const detectFaces = useCallback(async (imagePath: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await FaceDetector.detectFacesAsync(imagePath, {
        mode: FaceDetector.FaceDetectorMode.accurate,
      });
      setFaces(result.faces);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed');
      setFaces([]);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const detectFacesInVideo = useCallback(
    async (
      videoUri: string,
      durationMs: number,
      onProgress?: (progress: number) => void,
    ): Promise<FrameDetectionResult[]> => {
      setIsProcessingVideo(true);
      setIsProcessing(true);
      setError(null);
      setFrameResults([]);
      setVideoProgress(0);

      const intervalMs = 500;
      const timestamps: number[] = [];
      for (let t = 0; t < durationMs; t += intervalMs) {
        timestamps.push(t);
      }

      const results: FrameDetectionResult[] = [];
      let completed = 0;

      try {
        for (const timestamp of timestamps) {
          const {uri, width, height} =
            await VideoThumbnails.getThumbnailAsync(videoUri, {time: timestamp});

          const isRotated = width > height;
          const displayWidth = isRotated ? height : width;
          const displayHeight = isRotated ? width : height;

          const result = await FaceDetector.detectFacesAsync(uri, {
            mode: FaceDetector.FaceDetectorMode.accurate,
          });

          const adjustedFaces = result.faces.map(face => {
            if (isRotated) {
              return {
                ...face,
                bounds: {
                  origin: {x: face.bounds.origin.y, y: displayWidth - face.bounds.origin.x - face.bounds.size.width},
                  size: {width: face.bounds.size.height, height: face.bounds.size.width},
                },
              };
            }
            return face;
          });

          results.push({
            timestamp,
            faces: adjustedFaces,
            thumbnailUri: uri,
            thumbnailWidth: displayWidth,
            thumbnailHeight: displayHeight,
            isRotated,
          });
          completed++;
          const progress = completed / timestamps.length;
          setVideoProgress(progress);
          onProgress?.(progress);
        }
        setFrameResults(results);
        return results;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Video analysis failed');
        return results;
      } finally {
        setIsProcessingVideo(false);
        setIsProcessing(false);
      }
    },
    [],
  );

  const clearFaces = useCallback(() => {
    setFaces([]);
    setError(null);
    setFrameResults([]);
    setVideoProgress(0);
  }, []);

  return {
    faces,
    isProcessing,
    error,
    detectFaces,
    clearFaces,
    detectFacesInVideo,
    frameResults,
    isProcessingVideo,
    videoProgress,
  };
}