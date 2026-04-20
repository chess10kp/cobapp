import React from 'react';
import {StyleSheet, View} from 'react-native';
import {FaceFeatureBounds} from 'expo-face-detector';

interface FaceBoxProps {
  bounds: FaceFeatureBounds;
  imageWidth: number;
  imageHeight: number;
  viewWidth: number;
  viewHeight: number;
  offsetX?: number;
  offsetY?: number;
}

export function FaceBox({
  bounds,
  imageWidth,
  imageHeight,
  viewWidth,
  viewHeight,
  offsetX = 0,
  offsetY = 0,
}: FaceBoxProps) {
  const scaleX = viewWidth / imageWidth;
  const scaleY = viewHeight / imageHeight;

  const scaledLeft = bounds.origin.x * scaleX + offsetX;
  const scaledTop = bounds.origin.y * scaleY + offsetY;
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