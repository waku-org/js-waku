module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  plugins: ["import"],
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },
  rules: {
    // Disable rules that might cause issues with this package
    "no-undef": "off"
  },
  ignorePatterns: [
    "node_modules",
    "build",
    "coverage"
  ],
  overrides: [
    {
      files: ["*.spec.ts", "**/test_utils/*.ts", "*.js", "*.cjs"],
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off",
        "import/no-extraneous-dependencies": ["error", { "devDependencies": true }]
      }
    }
  ]
};
