module.exports = {
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "./tsconfig.dev.json"
  },
  rules: {
    "@typescript-eslint/no-non-null-assertion": "off"
  },
  globals: {
    process: true
  }
};
