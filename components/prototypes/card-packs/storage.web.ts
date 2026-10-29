const KEY = 'ttp.card-experience.demo.v1';
export async function readCardDemo(): Promise<unknown> {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}
export async function writeCardDemo(value: unknown): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify(value));
}
