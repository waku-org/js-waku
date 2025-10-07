module.exports = {
    root: true,
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module"
    },
    env: {
        node: true,
        browser: true,
        es2021: true
    },
    plugins: ["import"],
    extends: ["eslint:recommended"],
    rules: {
        "no-unused-vars": ["error", { "argsIgnorePattern": "^_", "ignoreRestSiblings": true }]
    },
    globals: {
        process: true
    },
    overrides: [
        {
            files: ["*.spec.ts", "**/test_utils/*.ts"],
            rules: {
                "@typescript-eslint/no-non-null-assertion": "off",
                "@typescript-eslint/no-explicit-any": "off",
                "no-console": "off",
                "import/no-extraneous-dependencies": ["error", { "devDependencies": true }]
            }
        },
        {
            files: ["*.ts"],
            parser: "@typescript-eslint/parser",
            parserOptions: {
                tsconfigRootDir: __dirname,
                project: "./tsconfig.dev.json"
            }
        },
        {
            files: ["*.d.ts"],
            rules: {
                "no-unused-vars": "off"
            }
        }
    ]
};
