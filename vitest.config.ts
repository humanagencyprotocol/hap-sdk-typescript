import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
      // Coverage thresholds per testing plan
      lines: 85,
      functions: 85,
      branches: 85,
      statements: 85,
      // Per-module thresholds
      perFile: true,
    },
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
