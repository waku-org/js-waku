#!/usr/bin/env node
import "dotenv-flow/config";
import { execSync } from "child_process";
import path from "path";

import { __dirname, readJSON } from "./utils.js";

const ROOT_PATH = path.resolve(__dirname, "../../../");
const JS_WAKU_PACKAGES = readWorkspaces();

const EXAMPLE_NAME = process.env.EXAMPLE_NAME;
const EXAMPLE_TEMPLATE = process.env.EXAMPLE_TEMPLATE;
const EXAMPLE_PATH = path.resolve(__dirname, "..", EXAMPLE_NAME);

run();

function run() {
  cleanExampleIfExists();
  bootstrapExample();
  linkPackages();
}

function cleanExampleIfExists() {
  try {
    console.log("Cleaning previous example if exists.");
    execSync(`rm -rf ${EXAMPLE_PATH}`, { stdio: "ignore" });
  } catch (error) {
    console.error(`Failed to clean previous example: ${error.message}`);
    throw error;
  }
}

function bootstrapExample() {
  try {
    console.log("Bootstrapping example.");
    execSync(
      `npx @waku/create-app --template ${EXAMPLE_TEMPLATE} ${EXAMPLE_NAME}`,
      { stdio: "ignore" }
    );
  } catch (error) {
    console.error(`Failed to bootstrap example: ${error.message}`);
    throw error;
  }
}

function linkPackages() {
  const examplePackage = readJSON(`${EXAMPLE_PATH}/package.json`);

  // remove duplicates if any
  const dependencies = filterWakuDependencies({
    ...examplePackage.dependencies,
    ...examplePackage.devDependencies
  });

  Object.keys(dependencies).forEach(linkDependency);
}

function filterWakuDependencies(dependencies) {
  return Object.entries(dependencies)
    .filter((pair) => JS_WAKU_PACKAGES.includes(pair[0]))
    .reduce((acc, pair) => {
      acc[pair[0]] = pair[1];
      return acc;
    }, {});
}

function linkDependency(dependency) {
  try {
    console.log(`Linking dependency to example: ${dependency}`);
    const pathToDependency = path.resolve(ROOT_PATH, toFolderName(dependency));
    execSync(`npm link ${pathToDependency}`, { stdio: "ignore" });
  } catch (error) {
    console.error(
      `Failed to npm link dependency ${dependency} in example: ${error.message}`
    );
    throw error;
  }
}

function readWorkspaces() {
  const rootPath = path.resolve(ROOT_PATH, "package.json");
  const workspaces = readJSON(rootPath).workspaces;
  return workspaces.map(toPackageName);
}

function toPackageName(str) {
  // assumption is that package name published is always the same in `@waku/package` name
  return str.replace("packages", "@waku");
}

function toFolderName(str) {
  return str.replace("@waku", "packages");
}
