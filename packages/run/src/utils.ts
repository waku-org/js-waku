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

interface Colors {
  reset: string;
  cyan: string;
  blue: string;
  yellow: string;
}

export function printWakuConfig(
  colors: Colors,
  node1Port: string,
  node2Port: string,
  peer1: string,
  peer2: string,
  clusterId: string
): void {
  process.stdout.write(
    `${colors.blue}import${colors.reset} { createLightNode } ${colors.blue}from${colors.reset} ${colors.yellow}"@waku/sdk"${colors.reset};\n`
  );
  process.stdout.write(`\n`);
  process.stdout.write(
    `${colors.blue}const${colors.reset} waku = ${colors.blue}await${colors.reset} createLightNode({\n`
  );
  process.stdout.write(
    `  defaultBootstrap: ${colors.cyan}false${colors.reset},\n`
  );
  process.stdout.write(`  bootstrapPeers: [\n`);
  process.stdout.write(
    `    ${colors.yellow}"/ip4/127.0.0.1/tcp/${node1Port}/ws/p2p/${peer1}"${colors.reset},\n`
  );
  process.stdout.write(
    `    ${colors.yellow}"/ip4/127.0.0.1/tcp/${node2Port}/ws/p2p/${peer2}"${colors.reset}\n`
  );
  process.stdout.write(`  ],\n`);
  process.stdout.write(`  numPeersToUse: ${colors.cyan}2${colors.reset},\n`);
  process.stdout.write(`  libp2p: {\n`);
  process.stdout.write(
    `    filterMultiaddrs: ${colors.cyan}false${colors.reset}\n`
  );
  process.stdout.write(`  },\n`);
  process.stdout.write(`  networkConfig: {\n`);
  process.stdout.write(
    `    clusterId: ${colors.cyan}${clusterId}${colors.reset},\n`
  );
  process.stdout.write(
    `    numShardsInCluster: ${colors.cyan}8${colors.reset}\n`
  );
  process.stdout.write(`  }\n`);
  process.stdout.write(`});\n`);
}
