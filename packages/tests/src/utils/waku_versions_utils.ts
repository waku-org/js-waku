import { DOCKER_IMAGE_NAME } from "../lib/service_node.js";

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
