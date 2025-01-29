import { exec, spawn } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure paths are absolute and relative to the package root
const PACKAGE_ROOT = resolve(__dirname, "..");
const getPackagePath = (path) => resolve(PACKAGE_ROOT, path);

const WAKUNODE_IMAGE = process.env.WAKUNODE_IMAGE || "wakuorg/nwaku:v0.31.0";

async function main() {
  try {
    await execAsync(`docker inspect ${WAKUNODE_IMAGE}`);
    console.log(`Using local image ${WAKUNODE_IMAGE}`);
  } catch (error) {
    console.log(`Pulling image ${WAKUNODE_IMAGE}`);
    await execAsync(`docker pull ${WAKUNODE_IMAGE}`);
    console.log("Image pulled");
  }

  const mochaArgs = [
    "mocha",
    "--require",
    "ts-node/register",
    "--project",
    "./tsconfig.dev.json"
  ];

  if (process.env.CI) {
    const reportsDir = getPackagePath("reports");
    const reportFile = resolve(reportsDir, "mocha-results.json");
    const configFile = resolve(reportsDir, "config.json");

    await mkdir(reportsDir, { recursive: true });

    // Create a clean reporter config
    const reporterConfig = {
      reporterEnabled: "spec",
      reporterOptions: {
        json: {
          stdout: false,
          options: {
            output: reportFile
          }
        }
      }
    };

    // Write the config file
    await writeFile(configFile, JSON.stringify(reporterConfig, null, 2));

    // Add a separate JSON reporter directly
    mochaArgs.push(
      "--reporter-option",
      `output=${reportFile}`,
      "--reporter",
      "json"
    );
  } else {
    // In non-CI environments, just use spec reporter
    mochaArgs.push("--reporter", "spec");
  }

  // Add test files
  const testFiles = process.argv.slice(2);
  if (testFiles.length === 0) {
    // Default to all test files if none specified
    testFiles.push("tests/**/*.spec.ts");
  }
  mochaArgs.push(...testFiles);

  console.info("Running mocha with args:", mochaArgs);

  // Run mocha tests
  const mocha = spawn("npx", mochaArgs, {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "test"
    }
  });

  mocha.on("error", (error) => {
    console.log(`Error running mocha tests: ${error.message}`);
    process.exit(1);
  });

  mocha.on("exit", (code) => {
    console.log(`Mocha tests exited with code ${code}`);
    process.exit(code || 0);
  });
}

main().catch((error) => {
  console.log(error);
  process.exit(1);
});
