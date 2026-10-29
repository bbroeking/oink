import { Redirect, Stack, useRouter } from 'expo-router';
// Read-only gallery follows the existing prototype's development-only boundary.
const Gallery = __DEV__
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('@/components/prototypes/card-packs/HalloweenGalleryPage').default
  : () => <Redirect href="/(tabs)/shop" />;
export default function HalloweenGalleryRoute() {
  const router = useRouter();
  return <><Stack.Screen options={{ headerShown: false }}/><Gallery onBack={() => router.canGoBack() ? router.back() : router.replace('/card-packs-prototype')}/></>;
}
