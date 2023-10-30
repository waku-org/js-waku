import cp from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const PACKAGE_JSON = "package.json";
// hack to get __dirname
const DIR = path.dirname(fileURLToPath(import.meta.url));

const NEXT_TAG = "next";
const LATEST_TAG = "latest";
const CURRENT_TAG = readPublishTag();

const exec = promisify(cp.exec);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

run()
  .then(() => {
    console.info("Successfully published packages.");
  })
  .catch((err) => {
    console.error("Failed at publishing packages with ", err.message);
  });

async function run() {
  const rootPackage = await readJSON(path.resolve(DIR, "../", PACKAGE_JSON));
  const workspacePaths = rootPackage.workspaces;

  if (CURRENT_TAG === NEXT_TAG) {
    await makeReleaseCandidate();
  }

  const workspaces = await Promise.all(workspacePaths.map(readWorkspace));

  if (CURRENT_TAG === NEXT_TAG) {
    await upgradeWakuDependencies(workspaces);
  }

  await Promise.all(
    workspaces
      .filter(async (info) => {
        const allowPublishing = await shouldBePublished(info);

        if (allowPublishing) {
          return true;
        }

        return false;
      })
      .map(async (info) => {
        try {
          await exec(
            `npm publish --workspace ${info.workspace} --tag ${CURRENT_TAG} --access public`
          );
          console.info(
            `Successfully published ${info.workspace} with version ${info.version}.`
          );
        } catch (err) {
          console.error(
            `Cannot publish ${info.workspace} with version ${info.version}. Error: ${err.message}`
          );
        }
      })
  );
}

async function readJSON(path) {
  const rawJSON = await readFile(path, "utf-8");
  return JSON.parse(rawJSON);
}

async function writeWorkspace(packagePath, text) {
  const resolvedPath = path.resolve(DIR, "../", packagePath, PACKAGE_JSON);
  await writeFile(resolvedPath, text);
}

async function readWorkspace(packagePath) {
  const json = await readJSON(
    path.resolve(DIR, "../", packagePath, PACKAGE_JSON)
  );

  return {
    name: json.name,
    private: !!json.private,
    version: json.version,
    workspace: packagePath,
    rawPackageJson: json
  };
}

async function shouldBePublished(info) {
  if (info.private) {
    console.info(`Skipping ${info.name} because it is private.`);
    return false;
  }

  try {
    const npmTag = `${info.name}@${info.version}`;
    const { stdout } = await exec(`npm view ${npmTag} version`);

    if (stdout.trim() !== info.version.trim()) {
      return true;
    }

    console.info(`Workspace ${info.path} is already published.`);
  } catch (err) {
    if (err.message.includes("code E404")) {
      return true;
    }

    console.error(
      `Cannot check published version of ${info.path}. Received error: ${err.message}`
    );
  }
}

async function makeReleaseCandidate() {
  try {
    console.info("Marking workspace versions as release candidates.");
    await exec(
      `npm version prerelease --preid $(git rev-parse --short HEAD) --workspaces true`
    );
  } catch (e) {
    console.error("Failed to mark release candidate versions.", e);
  }
}

function readPublishTag() {
  const args = process.argv.slice(2);
  const tagIndex = args.indexOf("--tag");

  if (tagIndex !== -1 && args[tagIndex + 1]) {
    return args[tagIndex + 1];
  }

  return LATEST_TAG;
}

async function upgradeWakuDependencies(workspaces) {
  console.log("Upgrading Waku dependencies in workspaces.");
  const map = workspaces.reduce((acc, item) => {
    if (!item.private) {
      acc[item.name] = item;
    }
    return acc;
  }, {});
  const packageNames = Object.keys(map);
  workspaces.forEach(async (info) => {
    if (info.private) {
      return;
    }
    ["dependencies", "devDependencies", "peerDependencies"].forEach((type) => {
      const deps = info.rawPackageJson[type];
      if (!deps) {
        return;
      }
      packageNames.forEach((name) => {
        if (deps[name]) {
          deps[name] = map[name].version;
        }
      });
    });
    try {
      await writeWorkspace(info.workspace, JSON.stringify(info.rawPackageJson));
    } catch (error) {
      console.error(
        `Failed to update package.json for ${info.name} with: `,
        error
      );
    }
  });
}
