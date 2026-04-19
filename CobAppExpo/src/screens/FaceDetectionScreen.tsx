import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {CameraView, useCameraPermissions} from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import {useFaceDetection} from '../hooks/useFaceDetection';
import {FaceBox} from '../components/FaceBox';

type ScreenState = 'camera' | 'result';

export function FaceDetectionScreen() {
  const [screenState, setScreenState] = useState<ScreenState>('camera');
  const [capturedPhoto, setCapturedPhoto] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const {faces, isProcessing, error, detectFaces} = useFaceDetection();

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo) {
        setCapturedPhoto({uri: photo.uri, width: photo.width, height: photo.height});
        await detectFaces(photo.uri);
        setScreenState('result');
      }
    } catch (err) {
      console.error('Failed to capture photo:', err);
    }
  }, [detectFaces]);

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
        <Text style={styles.text}>Camera permission required</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
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
        facing="back"
      />
      <View style={styles.controls}>
        {isProcessing ? (
          <ActivityIndicator size="large" color="#FFFFFF" />
        ) : (
          <Pressable style={styles.captureButton} onPress={handleCapture}>
            <View style={styles.captureButtonInner} />
          </Pressable>
        )}
      </View>
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
    alignItems: 'center',
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
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
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