module.exports = {
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: "./tsconfig.dev.json"
    },
    env: {
        node: true,
    },
    rules: {
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-non-null-assertion": "off"
    },
    globals: {
        process: true
    }
};
  