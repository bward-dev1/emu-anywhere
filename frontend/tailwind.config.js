/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';
import daisyui from 'daisyui';

export default {
  content: [
    './src/**/*.{tsx,css}',
    './index.html'
  ],
  theme: {
    extend: {},
  },
  plugins: [
    typography,
    daisyui
  ],
  daisyui: {
    themes: [
      'light',
      'dark',
      'cupcake'
    ]
  }
};
