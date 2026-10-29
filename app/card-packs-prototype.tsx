import { Redirect, Stack } from 'expo-router';
// Development-only entry point with a production redirect.
const Screen = __DEV__
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('@/components/prototypes/card-packs/CardExperience').default
  : () => <Redirect href="/(tabs)/shop" />;
export default function CardPacksPrototype() {
  return <><Stack.Screen options={{ headerShown: false }} /><Screen /></>;
}
