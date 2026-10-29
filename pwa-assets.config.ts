import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Maskable icon: glyph padded into the safe zone on a full-bleed apricot background.
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: '#E59A66' },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: '#E59A66' },
    },
  },
  images: ['public/icon.svg'],
});
