module.exports = {
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "./tsconfig.dev.json"
  },
  overrides: [
    {
      files: ["src/logger.ts"],
      rules: {
        "no-console": "off",
        "no-restricted-imports": "off"
      }
    }
  ]
};
