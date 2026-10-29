import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY = 'ttp.card-experience.demo.v1';
export async function readCardDemo(): Promise<unknown> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}
export async function writeCardDemo(value: unknown): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(value));
}
