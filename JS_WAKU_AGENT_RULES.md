# Comprehensive Rules for Warp Agents in js-waku

Here are the comprehensive rules for Warp agents working in the js-waku repository, based on the provided project structure and development workflow requirements.

## 1. Package Structure and Naming Conventions

### Rule 1.1: Standard Package Layout
Each package within the `packages/` directory must adhere to the following structure:

```bash
packages/{package-name}/
├── src/                 # Source TypeScript files
│   ├── interfaces/      # Type definitions and interfaces
│   ├── utils/           # Utility functions (camelCase naming)
│   ├── components/      # Main components (PascalCase naming)
│   └── index.ts         # Main entry point
├── tests/               # Test files only
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
├── dist/                # Build outputs (generated, never commit)
├── package.json         # Package configuration
└── tsconfig.json        # TypeScript configuration
```

## 2. Version Control and Scripting

### Rule 2.1: Conventional Commit Messages
Commit messages MUST follow the Conventional Commits specification.

**Examples:**
```
feat: add new message filtering capability
fix: resolve connection timeout issue
chore: update dependencies to latest versions
docs: improve API documentation
test: add unit tests for message validation
refactor: restructure connection management
```

### Rule 2.2: Git Hooks Requirements
The following Git hooks MUST be configured using `husky`:
- **Pre-commit:** Run `lint-staged` for code quality checks on staged files.
- **Pre-push:** Run the full test suite to ensure repository health.

### Rule 2.3: npm Scripts Standards
Every package MUST include these standard npm scripts in its `package.json`:
```json
"scripts": {
  "build": "yarn clean && tsc && rollup -c",
  "clean": "rm -rf dist",
  "test": "mocha",
  "lint": "eslint . --ext .ts",
  "watch": "tsc --watch"
}
```

## 3. Testing Pattern Rules

### Rule 3.1: Test Framework
Use `mocha` and `chai` for all unit and integration tests.

```typescript
import { expect } from 'chai';

describe('ComponentName', () => {
  it('should perform its function correctly', () => {
    // Test logic here
    expect(true).to.be.true;
  });
});
```

### Rule 3.2: Test File Naming and Location
- Test files MUST be located in the `tests/` directory.
- Test files MUST mirror the source file structure.
- **Unit tests:** `tests/unit/ComponentName.spec.ts`
- **Integration tests:** `tests/integration/FeatureName.spec.ts`

### Rule 3.3: Integration Tests Requiring Waku Node
- Store tests requiring a Waku node instance in `packages/tests/integration/`.
- Each test file MUST include setup and teardown logic for the Waku node.
- Use a consistent and isolated test environment configuration.

### Rule 3.4: CI Pipeline Integration
- All tests MUST pass before a pull request can be merged.
- The CI pipeline MUST run tests automatically on every push event to any branch.
- Test coverage reporting MUST be included in the CI pipeline.

## 4. Build Process Rules

### Rule 4.1: TypeScript Configuration
Use a strict `tsconfig.json` to ensure type safety.
```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

### Rule 4.2: Rollup Configuration Requirements
- The build process MUST generate both ESM and CommonJS outputs.
- Configure module resolution to support both Node.js and browser environments.
- Tree-shaking MUST be enabled to optimize the final bundle size.

### Rule 4.3: Build Script Requirements
- `build`: Cleans the `dist/` directory, compiles TypeScript, and bundles with Rollup.
- `clean`: Removes all generated files in the `dist/` directory.
- `watch`: Enables development mode with automatic recompilation on file changes.

### Rule 4.4: Build Outputs
- The `dist/` directory MUST never be committed to version control.
- Ensure `dist/` is included in the root `.gitignore` file.
- Builds MUST be reproducible across all development and CI environments.

## 5. Dependency Management Rules

### Rule 5.1: Use Precise Versioning
Use tilde (`~`) for patch versions and caret (`^`) for minor versions to ensure consistency while allowing non-breaking updates.
```json
"dependencies": {
  "some-package": "^1.2.3",
  "another-package": "~2.4.1"
}
```

### Rule 5.2: Peer Dependencies Usage
- Use `peerDependencies` for libraries that are expected to be provided by the consuming application (e.g., `react`).
- Always specify a valid version range for peer dependencies.

### Rule 5.3: Dependency Audit and Updates
- Run `npm audit` regularly to identify and fix vulnerabilities.
- Update dependencies at least monthly.
- All changes from dependency updates MUST be thoroughly tested.

## 6. Code Quality and Style Rules

### Rule 6.1: TypeScript Best Practices
- `strict: true` MUST be enabled in `tsconfig.json`.
- The `any` type should be avoided. Use `unknown` with type guards instead.
- Use type guards for runtime validation of external data.

### Rule 6.2: Export Patterns
- Prefer named exports for utilities, types, and components.
- Use a single `index.ts` file in each major directory (`src/`, `src/components`, etc.) to expose the public API of that module.

### Rule 6.3: Implement Proper Error Handling
- Create and use typed error classes for different failure modes.
- Provide meaningful and descriptive error messages.
- Handle asynchronous operations correctly using `try-catch` blocks with `async/await`.

## 7. Documentation Rules

### Rule 7.1: Code Documentation Requirements
- All public APIs, functions, and classes MUST have JSDoc comments.
- Each package MUST contain a `README.md` with setup instructions and usage examples.
- Complex architectural components should be documented in a central location.

### Rule 7.2: API Documentation
- All public interfaces and types MUST be documented.
- Documentation MUST be kept up-to-date with any code changes.

## 8. Performance and Optimization Rules

### Rule 8.1: Bundle Optimization
- Use tree-shaking in the Rollup configuration.
- Regularly analyze the bundle size to identify and remove unnecessary dependencies.

### Rule 8.2: Memory Management
- Ensure resources (e.g., event listeners, subscriptions) are properly disposed of to prevent memory leaks.
- Use `WeakMap` or `WeakSet` for caching objects where appropriate.
- Monitor memory usage in long-running processes.

## 9. Security Rules

### Rule 9.1: Security Practices
- All external inputs MUST be validated and sanitized.
- Use cryptographically secure random number generation where needed.
- Regularly update dependencies to patch security vulnerabilities.

### Rule 9.2: Sensitive Data Handling
- Never commit secrets, private keys, or other sensitive data to the repository.
- Use environment variables for configuration and secrets management.

## 10. Debugging and Monitoring Rules

### Rule 10.1: Logging Standards
- Use a structured logging format (e.g., JSON).
- Include appropriate log levels (debug, info, warn, error).
- Never log sensitive information in plain text.

### Rule 10.2: Debugging Support
- Generate source maps in development builds to facilitate easier debugging.
- Provide clear error messages that include context about the failure.

## 11. Enforcement Rules

### Rule 11.1: Before any code changes:
1.  Check that the current project structure matches these rules.
2.  Verify that all naming conventions are being followed.
3.  Run linting and all tests to ensure the current state is clean.
4.  Review proposed changes against these established standards.

### Rule 11.2: When creating new files or packages:
1.  Follow the established directory and file structure.
2.  Use the appropriate naming conventions for files, components, and variables.
3.  Include necessary configuration files (`package.json`, `tsconfig.json`).
4.  Update relevant documentation.

### Rule 11.3: For dependency changes:
1.  Check for compatibility with the existing codebase.
2.  Update lock files (`package-lock.json` or `yarn.lock`) consistently.
3.  Test thoroughly across different environments.
4.  Document any breaking changes in the pull request and relevant READMEs.

