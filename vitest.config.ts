import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/**
 * Vitest does not read `.env` on its own and the security suite needs the
 * Supabase URL and publishable key. Parsed here rather than adding a dotenv
 * dependency for two variables.
 */
function loadDotEnv(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync('.env', 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const eq = line.indexOf('=');
          return [
            line.slice(0, eq).trim(),
            line
              .slice(eq + 1)
              .trim()
              .replace(/^["']|["']$/g, ''),
          ];
        })
        .filter(([key]) => key)
    );
  } catch {
    return {};
  }
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The security suite reads live database state; keep files serial so they
    // cannot race each other.
    fileParallelism: false,
    env: loadDotEnv(),
  },
});
