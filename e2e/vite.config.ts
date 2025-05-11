import { defineConfig } from 'vite';
import { fluent } from 'vite-plugin-fluent';

export default defineConfig({
  plugins: [fluent()],
});
