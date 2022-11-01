module.exports = {
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "./tsconfig.json",
  },
  rules: {
    "@typescript-eslint/no-non-null-assertion": "off",
  },
};
