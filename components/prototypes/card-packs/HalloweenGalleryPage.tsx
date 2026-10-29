import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { SPACE, WHIMSY } from '@/constants/theme';
import HalloweenGallery from './HalloweenGallery';

export default function HalloweenGalleryPage({ onBack }: { onBack?: () => void }) {
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><HalloweenGallery onBack={onBack}/></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: WHIMSY.cream },
  content: { padding: SPACE.lg, paddingBottom: SPACE.xxl },
});
