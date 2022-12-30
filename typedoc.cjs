const packageJson = require("./package.json");
// Pop last value out: packages/tests
packageJson.workspaces.pop();

module.exports = {
  entryPointStrategy: "packages",
  entryPoints: packageJson.workspaces,
  out: "docs",
  exclude: ["**/*.spec.ts"],
  excludeInternal: true,
  validation: {
    invalidLink: true,
    notExported: true,
  },
};
packageJson.workspaces;
