const packageJson = require("./package.json");

let entryPoints = [];
for (const entryPoint of packageJson.workspaces) {
  if (!["packages/tests", "packages/build-utils"].includes(entryPoint))
    entryPoints.push(entryPoint);
}

module.exports = {
  entryPointStrategy: "packages",
  entryPoints,
  out: "docs",
  exclude: ["**/*.spec.ts"],
  excludeInternal: true,
  treatWarningsAsErrors: true,
  excludeExternals: true,
  validation: {
    invalidLink: true,
    notExported: true,
  },
};
