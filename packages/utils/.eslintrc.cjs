module.exports = {
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "./tsconfig.dev.json"
  },
  overrides: [
    {
      files: ["src/logger/index.ts"],
      rules: {
        "no-console": "off"
      }
    }
  ]
};
