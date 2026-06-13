import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // Tests, test utilities, and Node-run config files: allow Node globals and
  // relax the Fast-Refresh "components only" rule (these export helpers, not UI).
  {
    files: [
      'src/test/**/*.{ts,tsx}',
      'src/**/*.test.{ts,tsx}',
      'e2e/**/*.{ts,tsx}',
      'vitest.config.ts',
      'playwright.config.ts',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Entry file + components that intentionally co-locate shared design constants
  // (toneText/toneBar, the pipeline STAGES). react-refresh is a dev-only HMR
  // granularity rule; relaxing it here keeps imports stable instead of fragmenting
  // these tightly-coupled modules.
  {
    files: ['src/main.tsx', 'src/components/ui.tsx', 'src/components/PipelineDiagram.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
