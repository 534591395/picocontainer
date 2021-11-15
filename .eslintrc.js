module.exports = {
  parser: '@typescript-eslint/parser', // babel-eslint
  plugins: ['@typescript-eslint', 'jest'],
  env: {
    browser: true,
    node: true,
    jest: true,
    es6: true
  },
  parserOptions: {
    ecmaVersion: 2020
  },
  globals: {},
  rules: {
    '@typescript-eslint/explicit-function-return-type': 0,
  }
}
