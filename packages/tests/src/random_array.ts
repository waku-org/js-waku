import crypto from "crypto";

export function generateRandomUint8Array(sizeInBytes: number): Uint8Array {
  const chunkSize = 65536; // Maximum entropy available
  const chunks = Math.ceil(sizeInBytes / chunkSize);
  const buffer = new Uint8Array(sizeInBytes);

  for (let i = 0; i < chunks; i++) {
    const chunk = new Uint8Array(chunkSize);
    crypto.getRandomValues(chunk);
    buffer.set(chunk, i * chunkSize);
  }

  return buffer;
}
