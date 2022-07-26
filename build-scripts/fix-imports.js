import path from "path";
import fs from "fs";

const START_PATH = path.join(process.cwd(), "dist/");
const IMPORT_REGEXP =
  /^((import|export) [^';]* from "(\.[^@";]*\/[^";]*)[^";]*)"/g;
const JUST_ADD_AN_EXTENSION = '$1.js"';
const ADD_INDEX_FILE = '$1/index.js"';
const JS_EXT = ".js";

function fixImportsAtFolder(rootPath) {
  const entries = fs.readdirSync(rootPath);

  entries.forEach((entry) => {
    const entryPath = path.join(rootPath, entry);
    if (entry.endsWith(JS_EXT)) {
      fixImportsAtFile(entryPath);
    } else {
      const extName = path.extname(entry);
      if (!extName) {
        const stat = fs.statSync(entryPath);
        if (stat.isDirectory()) {
          fixImportsAtFolder(entryPath);
        }
      }
    }
  });
}

function fixImportsAtFile(filePath) {
  const content = fs.readFileSync(filePath).toString("utf8");
  const lines = content.split("\n");
  const fixedLines = lines.map((l) => {
    if (!l.match(IMPORT_REGEXP)) {
      return l;
    }

    const [_, importPath] = l.split(`"`);
    let exists;
    let fullPath;
    if (importPath.startsWith(".")) {
      fullPath = path.join(filePath, "..", importPath);
      exists = fs.existsSync(fullPath);
    } else {
      fullPath = path.join(process.cwd(), "node_modules", importPath);
      exists = fs.existsSync(fullPath);
    }

    if (exists === false) {
      console.log("Update ", l);
      return l.replace(IMPORT_REGEXP, JUST_ADD_AN_EXTENSION);
    }

    const stat = fs.statSync(fullPath);
    const isDirectory = stat.isDirectory();
    if (isDirectory === true) {
      console.log("Update ", l);
      return l.replace(IMPORT_REGEXP, ADD_INDEX_FILE);
    }

    return l;
  });
  const withFixedImports = fixedLines.join("\n");
  fs.writeFileSync(filePath, withFixedImports);
}

fixImportsAtFolder(START_PATH);
console.log("imports fixed...");
console.log("================");
