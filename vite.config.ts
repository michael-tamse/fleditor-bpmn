import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@camunda/feel-builtins': path.resolve(__dirname, 'src/feel/flowable-builtins.js')
    }
  }
});