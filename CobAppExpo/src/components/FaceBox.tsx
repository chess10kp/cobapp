import React from 'react';
import {StyleSheet, View} from 'react-native';
import {FaceFeatureBounds} from 'expo-face-detector';

interface FaceBoxProps {
  bounds: FaceFeatureBounds;
  imageWidth: number;
  imageHeight: number;
  viewWidth: number;
  viewHeight: number;
}

export function FaceBox({
  bounds,
  imageWidth,
  imageHeight,
  viewWidth,
  viewHeight,
}: FaceBoxProps) {
  const scaleX = viewWidth / imageWidth;
  const scaleY = viewHeight / imageHeight;

  const scaledLeft = bounds.origin.x * scaleX;
  const scaledTop = bounds.origin.y * scaleY;
  const scaledWidth = bounds.size.width * scaleX;
  const scaledHeight = bounds.size.height * scaleY;

  return (
    <View
      style={[
        styles.box,
        {
          left: scaledLeft,
          top: scaledTop,
          width: scaledWidth,
          height: scaledHeight,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#00FF00',
    borderRadius: 4,
  },
});