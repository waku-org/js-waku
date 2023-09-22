module.exports = {
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: "./tsconfig.dev.json"
    },
    env: {
        node: true,
    },
    rules: {},
    globals: {
        process: true
    }
};
  