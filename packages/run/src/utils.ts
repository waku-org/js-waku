import { readFileSync } from "fs";
import { join } from "path";

export function getProjectName(packageRoot: string): string {
  const packageJsonPath = join(packageRoot, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  // Docker Compose project names must consist only of lowercase alphanumeric characters, hyphens, and underscores
  const name = packageJson.name.replace("@", "").replace("/", "-");
  const version = packageJson.version.replace(/\./g, "-");
  return `${name}-${version}`;
}
