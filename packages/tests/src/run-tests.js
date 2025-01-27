import { exec, spawn } from "child_process";
import { mkdir } from "fs/promises";
import { dirname } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

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
    const reportPath = "reports/mocha-results.json";
    await mkdir(dirname(reportPath), { recursive: true });

    mochaArgs.push(
      "--reporter",
      "json",
      "--reporter-option",
      `output=${reportPath}`,
      "--parallel",
      "--jobs",
      "6"
    );
  }

  // Add test files
  const testFiles = process.argv.slice(2);
  if (testFiles.length === 0) {
    // Default to all test files if none specified
    testFiles.push("tests/**/*.spec.ts");
  }
  mochaArgs.push(...testFiles);

  console.log("Running mocha with args:", mochaArgs);

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
