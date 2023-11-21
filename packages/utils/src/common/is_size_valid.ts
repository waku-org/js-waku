import type { IEncoder, IMessage } from "@waku/interfaces";

const MB = 1024 ** 2;
const SIZE_CAP_IN_MB = 1;

/**
 * Return whether the size of the message is under the upper limit for the network.
 * This performs a protobuf encoding! If you have access to the fully encoded message,
 * use {@link isSizeUnderCapBuf} instead.
 * @param message
 * @param encoder
 */
export async function isMessageSizeUnderCap(
  encoder: IEncoder,
  message: IMessage
): Promise<boolean> {
  const buf = await encoder.toWire(message);
  if (!buf) return false;
  return isWireSizeUnderCap(buf);
}

export const isWireSizeUnderCap = (buf: Uint8Array): boolean =>
  buf.length / MB <= SIZE_CAP_IN_MB;
