import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // The icon's own background fills the rounded corners, so these come out full bleed.
    // Maskable: coins shrunk into the safe zone. Apple: unpadded; iOS rounds it.
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.12,
      resizeOptions: { background: '#262422' },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
      resizeOptions: { background: '#262422' },
    },
  },
  images: ['public/icon.svg'],
});
