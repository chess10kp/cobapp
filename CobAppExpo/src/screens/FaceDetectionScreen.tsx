import React, {useCallback, useRef, useState, useEffect} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {CameraView, useCameraPermissions, useMicrophonePermissions} from 'expo-camera';
import {useFaceDetection} from '../hooks/useFaceDetection';
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
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const {faces, isProcessing, error, detectFaces} = useFaceDetection();

  const handleVideoRecorded = useCallback(
    async (videoUri: string) => {
      try {
        const {uri, width, height} = await VideoThumbnails.getThumbnailAsync(
          videoUri,
          {time: 0},
        );
        setCapturedPhoto({uri, width, height});
        await detectFaces(uri);
        setScreenState('result');
      } catch (err) {
        console.error('Failed to extract video thumbnail:', err);
        setCapturedPhoto({uri: videoUri, width: 0, height: 0});
        await detectFaces(videoUri);
        setScreenState('result');
      }
    },
    [detectFaces],
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
    return (
      <View style={styles.container}>
        <View style={styles.resultContainer}>
          <View style={styles.imageWrapper}>
            <Image
              source={{uri: capturedPhoto.uri}}
              style={styles.capturedImage}
              resizeMode="contain"
            />
            {faces.map((face, index) => (
              <FaceBox
                key={index}
                bounds={face.bounds}
                imageWidth={capturedPhoto.width}
                imageHeight={capturedPhoto.height}
                viewWidth={capturedPhoto.width}
                viewHeight={capturedPhoto.height}
              />
            ))}
          </View>
          <View style={styles.resultOverlay}>
            <Text style={styles.resultText}>
              {faces.length === 0
                ? 'No faces detected'
                : `${faces.length} face${faces.length > 1 ? 's' : ''} detected`}
            </Text>
            <Pressable style={styles.retakeButton} onPress={handleRetake}>
              <Text style={styles.retakeButtonText}>Retake</Text>
            </Pressable>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  retakeButton: {
    backgroundColor: '#00FF00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retakeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
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
