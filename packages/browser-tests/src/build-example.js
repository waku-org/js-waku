#!/usr/bin/env node
import "dotenv-flow/config";
import { execSync } from "child_process";
import path from "path";

import { __dirname } from "./utils.js";

const EXAMPLE_NAME = process.env.EXAMPLE_NAME;
const EXAMPLE_PATH = path.resolve(__dirname, "..", EXAMPLE_NAME);

const BUILD_FOLDER = "build";
const BUILD_PATH = path.resolve(EXAMPLE_PATH, BUILD_FOLDER);

// required by web-chat example
const WEB_CHAT_BUILD_PATH = path.resolve(EXAMPLE_PATH, "web-chat");

run();

function run() {
  cleanPrevBuildIfExists();
  buildExample();
  renameBuildFolderForWebChat();
}

function cleanPrevBuildIfExists() {
  try {
    console.log("Cleaning previous build if exists.");
    execSync(`rm -rf ${BUILD_PATH}`, { stdio: "ignore" });
  } catch (error) {
    console.error(`Failed to clean previous build: ${error.message}`);
    throw error;
  }
}

function buildExample() {
  try {
    console.log("Building example at", EXAMPLE_PATH);
    execSync(`cd ${EXAMPLE_PATH} && npm run build`, { stdio: "pipe" });
  } catch (error) {
    console.error(`Failed to build example: ${error.message}`);
    throw error;
  }
}

function renameBuildFolderForWebChat() {
  try {
    console.log("Renaming example's build folder.");
    execSync(`mv ${BUILD_PATH} ${WEB_CHAT_BUILD_PATH}`, { stdio: "ignore" });
  } catch (error) {
    console.error(
      `Failed to rename build folder for web-chat: ${error.message}`
    );
    throw error;
  }
}
