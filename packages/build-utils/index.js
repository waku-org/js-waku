export function extractExports(packageJson) {
  const exportsMap = packageJson.default.exports;

  let input = {};
  for (const exportPath in exportsMap) {
    const filePath = exportsMap[exportPath].import;

    let entry;
    if (exportPath === ".") {
      entry = "index";
    } else {
      if (!exportPath.startsWith("./")) {
        throw `export path should start with \`./\` but starts with ${exportPath}`;
      }
      entry = exportPath.substring(2);
    }
    input[entry] = filePath;
  }

  return input;
}
