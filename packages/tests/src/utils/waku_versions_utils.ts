import { Logger } from "@waku/utils";

import { DOCKER_IMAGE_NAME } from "../lib/service_node";

const log = new Logger("test:utils");

// Utility to add test conditions based on nwaku/go-waku versions
export function isNwakuAtLeast(requiredVersion: string): boolean {
  const versionRegex = /(?:v)?(\d+\.\d+(?:\.\d+)?)/;
  const match = DOCKER_IMAGE_NAME.match(versionRegex);

  if (match) {
    const version = match[0].substring(1); // Remove the 'v' prefix
    return (
      version.localeCompare(requiredVersion, undefined, { numeric: true }) >= 0
    );
  } else {
    // If there is no match we assume that it's a version close to master so we return True
    return true;
  }
}

// Utility to resolve authosharding cluster ID
export function resolveAutoshardingCluster(clusterId: number): number {
  if (isNwakuAtLeast("0.26.0")) {
    log.info(`Using clusterID ${clusterId} for autosharding`);
    return clusterId;
  } else {
    // for versions older than 0.26.0 the authosharding cluster was hardcoded to 1
    // https://github.com/waku-org/nwaku/pull/2505
    log.warn("Falling back to clusterID 1 for autosharding");
    return 1;
  }
}
