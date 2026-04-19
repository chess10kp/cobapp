import React from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {FaceDetectionScreen} from './src/screens/FaceDetectionScreen';

function App() {
  return (
    <SafeAreaProvider>
      <FaceDetectionScreen />
    </SafeAreaProvider>
  );
}

export default App;