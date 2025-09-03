module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended','plugin:@typescript-eslint/recommended'],
  env: { es2021: true, node: true, browser: true },
  ignorePatterns: ['dist','public/assets','node_modules'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off'
  }
};