import React, {useCallback, useRef, useState, useEffect} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {CameraView, useCameraPermissions, useMicrophonePermissions} from 'expo-camera';
import {useFaceDetection, FrameDetectionResult} from '../hooks/useFaceDetection';
import {FaceBox} from '../components/FaceBox';
import * as VideoThumbnails from 'expo-video-thumbnails';

type ScreenState = 'camera' | 'result';

export function FaceDetectionScreen() {
  const [screenState, setScreenState] = useState<ScreenState>('camera');
  const [capturedPhoto, setCapturedPhoto] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isUserScrubbing, setIsUserScrubbing] = useState(false);
  const [wrapperLayout, setWrapperLayout] = useState({width: 0, height: 0});
  const cameraRef = useRef<CameraView>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const computeImageDisplayRect = useCallback(
    (imgW: number, imgH: number, viewW: number, viewH: number) => {
      if (viewW === 0 || viewH === 0 || imgW === 0 || imgH === 0) {
        return {displayWidth: 0, displayHeight: 0, offsetX: 0, offsetY: 0};
      }
      const scale = Math.min(viewW / imgW, viewH / imgH);
      const displayWidth = imgW * scale;
      const displayHeight = imgH * scale;
      return {
        displayWidth,
        displayHeight,
        offsetX: (viewW - displayWidth) / 2,
        offsetY: (viewH - displayHeight) / 2,
      };
    },
    [],
  );

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const {
    faces,
    isProcessing,
    error,
    detectFaces,
    detectFacesInVideo,
    frameResults,
    isProcessingVideo,
    videoProgress,
  } = useFaceDetection();

  const handleVideoRecorded = useCallback(
    async (videoUri: string) => {
      const maxDuration = 15000;
      setVideoDuration(maxDuration);
      setCapturedPhoto({uri: videoUri, width: 0, height: 0});
      setScreenState('result');
      setCurrentFrameIndex(0);
      setIsAutoPlaying(false);
      await detectFacesInVideo(videoUri, maxDuration);
    },
    [detectFacesInVideo],
  );

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingTime(0);
  }, []);

  useEffect(() => {
    return () => clearRecordingTimer();
  }, [clearRecordingTimer]);

  useEffect(() => {
    if (animationTimerRef.current) {
      clearInterval(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    if (isAutoPlaying && frameResults.length > 0) {
      animationTimerRef.current = setInterval(() => {
        setCurrentFrameIndex(prev => {
          const next = prev + 1;
          if (next >= frameResults.length) {
            return 0;
          }
          return next;
        });
      }, 500);
    }
    return () => {
      if (animationTimerRef.current) {
        clearInterval(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [isAutoPlaying, frameResults.length]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isRecording) {
      return;
    }

    if (!micPermission?.granted) {
      const result = await requestMicPermission();
      if (!result?.granted) {
        return;
      }
    }

    setIsRecording(true);
    setRecordingTime(0);

    const intervalId = setInterval(() => {
      setRecordingTime(prev => (prev < 15 ? prev + 1 : prev));
    }, 1000);
    recordingTimerRef.current = intervalId;

    try {
      const video = await cameraRef.current.recordAsync({maxDuration: 15});
      if (video && video.uri) {
        handleVideoRecorded(video.uri);
      }
    } catch (err) {
      console.error('Failed to capture video:', err);
    } finally {
      clearRecordingTimer();
      setIsRecording(false);
    }
  }, [isRecording, handleVideoRecorded, clearRecordingTimer, micPermission, requestMicPermission]);

  const handleStopRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) {
      return;
    }
    if (recordingTime < 1) {
      return;
    }
    try {
      cameraRef.current.stopRecording();
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  }, [isRecording, recordingTime]);

  const handleFlipCamera = useCallback(() => {
    if (isRecording) {
      return;
    }
    setFacing(prev => (prev === 'back' ? 'front' : 'back'));
  }, [isRecording]);

  const handleRetake = useCallback(() => {
    setCapturedPhoto(null);
    setScreenState('camera');
    setCurrentFrameIndex(0);
    setIsAutoPlaying(false);
    if (animationTimerRef.current) {
      clearInterval(animationTimerRef.current);
      animationTimerRef.current = null;
    }
  }, []);

  const getCurrentFrame = useCallback((): FrameDetectionResult | null => {
    if (frameResults.length === 0) return null;
    const idx = Math.min(currentFrameIndex, frameResults.length - 1);
    return frameResults[idx];
  }, [frameResults, currentFrameIndex]);

  const handleScrubComplete = useCallback(
    async (value: number) => {
      setIsUserScrubbing(false);
      if (frameResults.length === 0) return;
      const targetIndex = Math.round(value * (frameResults.length - 1));
      setCurrentFrameIndex(targetIndex);
    },
    [frameResults],
  );

  const toggleAutoPlay = useCallback(() => {
    setIsAutoPlaying(prev => !prev);
  }, []);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Camera & microphone permissions required</Text>
        <Pressable
          style={styles.permissionButton}
          onPress={async () => {
            await requestPermission();
            await requestMicPermission();
          }}>
          <Text style={styles.permissionButtonText}>Grant Permissions</Text>
        </Pressable>
      </View>
    );
  }

  if (screenState === 'result' && capturedPhoto) {
    const currentFrame = getCurrentFrame();
    const totalFrames = frameResults.length;
    const facesDetectedCount = frameResults.filter(f => f.faces.length > 0).length;
    const faceDetectionRate =
      totalFrames > 0 ? Math.round((facesDetectedCount / totalFrames) * 100) : 0;

    if (isProcessingVideo) {
      const progressPercent = Math.round(videoProgress * 100);
      return (
        <View style={styles.container}>
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="large" color="#00FF00" />
            <Text style={styles.analyzingText}>Analyzing video...</Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {width: (progressPercent + '%') as import('react-native').DimensionValue},
                ]}
              />
            </View>
            <Text style={styles.progressText}>{progressPercent}%</Text>
          </View>
        </View>
      );
    }

    if (!currentFrame && frameResults.length === 0) {
      return (
        <View style={styles.container}>
          <View style={styles.centered}>
            <Text style={styles.text}>No frames analyzed</Text>
            <Pressable style={styles.retakeButton} onPress={handleRetake}>
              <Text style={styles.retakeButtonText}>Retake</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    const sliderValue = totalFrames > 1 ? currentFrameIndex / (totalFrames - 1) : 0;

    const currentThumb = currentFrame
      ? {w: currentFrame.thumbnailWidth, h: currentFrame.thumbnailHeight}
      : {w: capturedPhoto.width || 400, h: capturedPhoto.height || 400};
    const displayRect = computeImageDisplayRect(
      currentThumb.w,
      currentThumb.h,
      wrapperLayout.width,
      wrapperLayout.height,
    );

    return (
      <View style={styles.container}>
        <View style={styles.resultContainer}>
          <View
            style={styles.imageWrapper}
            onLayout={e =>
              setWrapperLayout({
                width: e.nativeEvent.layout.width,
                height: e.nativeEvent.layout.height,
              })
            }>
            <Image
              source={{uri: currentFrame?.thumbnailUri || capturedPhoto.uri}}
              style={styles.capturedImage}
              resizeMode="contain"
            />
            {currentFrame?.faces.map((face, index) => (
              <FaceBox
                key={index}
                bounds={face.bounds}
                imageWidth={currentThumb.w}
                imageHeight={currentThumb.h}
                viewWidth={displayRect.displayWidth || currentThumb.w}
                viewHeight={displayRect.displayHeight || currentThumb.h}
                offsetX={displayRect.offsetX}
                offsetY={displayRect.offsetY}
              />
            ))}
          </View>
          <View style={styles.resultOverlay}>
            <View style={styles.statsRow}>
              <Text style={styles.resultText}>
                {currentFrame
                  ? 't=' + (currentFrame.timestamp / 1000).toFixed(1) + 's'
                  : 'No data'}
              </Text>
              <Text style={styles.resultText}>
                {currentFrameIndex + 1} / {totalFrames}
              </Text>
            </View>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={sliderValue}
                onSlidingStart={() => setIsUserScrubbing(true)}
                onValueChange={val => {
                  if (frameResults.length > 1) {
                    setCurrentFrameIndex(Math.round(val * (frameResults.length - 1)));
                  }
                }}
                onSlidingComplete={handleScrubComplete}
                minimumTrackTintColor="#00FF00"
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor="#00FF00"
              />
            </View>
            <View style={styles.controlsRow}>
              <Pressable style={styles.playButton} onPress={toggleAutoPlay}>
                <Text style={styles.playButtonText}>
                  {isAutoPlaying ? '⏸' : '▶'}
                </Text>
              </Pressable>
              <View style={styles.statsBadge}>
                <Text style={styles.statsText}>
                  Face: {faceDetectionRate}% | {facesDetectedCount}/{totalFrames} frames
                </Text>
              </View>
              <Pressable style={styles.retakeButton} onPress={handleRetake}>
                <Text style={styles.retakeButtonText}>Retake</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
      />
      <View style={styles.controls}>
        <Pressable
          style={[
            styles.captureButton,
            isRecording && styles.captureButtonRecording,
          ]}
          onPress={isRecording ? handleStopRecording : handleCapture}>
          <View
            style={[
              isRecording
                ? styles.stopButtonInner
                : styles.captureButtonInner,
            ]}
          />
        </Pressable>
        <Pressable
          style={[styles.flipButton, isRecording && styles.flipButtonDisabled]}
          onPress={handleFlipCamera}
          disabled={isRecording}>
          <Text style={styles.flipButtonText}>↺</Text>
        </Pressable>
      </View>
      {isRecording && (
        <View style={styles.timerOverlay}>
          <View style={styles.timerBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.timerText}>{recordingTime}s / 15s</Text>
          </View>
        </View>
      )}
      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 12,
  },
  permissionButton: {
    backgroundColor: '#00FF00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonRecording: {
    borderColor: '#FF0000',
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  stopButtonInner: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#FF0000',
  },
  flipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  flipButtonDisabled: {
    opacity: 0.3,
  },
  flipButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  timerOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF0000',
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    flex: 1,
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  capturedImage: {
    width: '100%',
    height: '100%',
  },
  resultOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'stretch',
  },
  resultText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  retakeButton: {
    backgroundColor: '#00FF00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retakeButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  analyzingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  analyzingText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  progressBarContainer: {
    width: '80%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00FF00',
    borderRadius: 4,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sliderContainer: {
    marginBottom: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00FF00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: 20,
    color: '#000',
  },
  statsBadge: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  statsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  errorOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,0,0,0.8)',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
});
