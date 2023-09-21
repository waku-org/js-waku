const packageJson = require("./package.json");

module.exports = {
  "treatWarningsAsErrors": false,
  "entryPointStrategy": "packages",
  "entryPoints": packageJson.workspaces,
  "out": "docs",
  "excludeInternal": true,
  "excludeExternals": true,
  "excludeReferences": true,
  "exclude": ["**/*.spec.ts", "packages/build-utils", "packages/tests"],
  "validation": {
    "invalidLink": true,
    "notExported": true,
  }
};
