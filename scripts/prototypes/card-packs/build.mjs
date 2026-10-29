import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const output = path.join(root, 'artifacts/card-packs-preview');
await fs.mkdir(output, { recursive: true });
await build({
  entryPoints: ['scripts/prototypes/card-packs/entry.jsx'], bundle: true,
  outfile: path.join(output, 'app.js'), platform: 'browser', format: 'esm',
  jsx: 'automatic', sourcemap: true, alias: { 'react-native': 'react-native-web' },
  plugins: [{ name: 'preview-ui-primitives', setup(builder) { builder.onResolve({ filter: /^@\/components\/ui$/ }, () => ({ path: path.join(root, 'scripts/prototypes/card-packs/ui-preview.ts') })); } }],
  resolveExtensions: ['.web.tsx','.web.ts','.web.jsx','.web.js','.tsx','.ts','.jsx','.js','.json'],
  define: { __DEV__: 'true', 'process.env.NODE_ENV': '"development"', 'process.env.EXPO_OS': '"web"', 'process.env': '{}'  },
  loader: { '.png':'file','.jpg':'file','.jpeg':'file','.webp':'file','.riv':'file','.mp3':'file','.wav':'file','.ttf':'file' },
  assetNames: 'assets/[name]-[hash]', logLevel: 'info',
});
const fonts = [
  ['Fredoka_700Bold','fredoka/700Bold/Fredoka_700Bold.ttf'],
  ['Caprasimo_400Regular','caprasimo/400Regular/Caprasimo_400Regular.ttf'],
  ['Nunito_700Bold','nunito/700Bold/Nunito_700Bold.ttf'],
  ['Nunito_600SemiBold','nunito/600SemiBold/Nunito_600SemiBold.ttf'],
  ['Nunito_800ExtraBold','nunito/800ExtraBold/Nunito_800ExtraBold.ttf'],
  ['PatrickHand_400Regular','patrick-hand/400Regular/PatrickHand_400Regular.ttf'],
];
for (const [name, source] of fonts) await fs.copyFile(path.join(root,'node_modules/@expo-google-fonts',source),path.join(output,`${name}.ttf`));
await fs.writeFile(path.join(output,'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Rosie's Loadout · Card experience</title><style>${fonts.map(([name]) => `@font-face{font-family:'${name}';src:url('./${name}.ttf') format('truetype');font-display:swap;}`).join('')}html,body,#root{margin:0;height:100%;background:#fbeee2;overflow:hidden}#root{display:flex}*{box-sizing:border-box}button:focus-visible,[role=button]:focus-visible,input:focus-visible{outline:3px solid #a03e2f;outline-offset:4px}</style></head><body><div id="root"></div><script type="module" src="./app.js"></script></body></html>`);
console.log(`Preview built: ${output}`);
