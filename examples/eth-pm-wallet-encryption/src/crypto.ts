import "@ethersproject/shims";

import { PublicKeyMessage } from "./messaging/wire";
import { utils } from "js-waku";
import * as sigUtil from "eth-sig-util";
import { equals } from "uint8arrays/equals";

/**
 * Sign the encryption public key with Web3. This can then be published to let other
 * users know to use this encryption public key to encrypt messages for the
 * Ethereum Address holder.
 */
export async function createPublicKeyMessage(
  address: string,
  encryptionPublicKey: Uint8Array,
  providerRequest: (request: {
    method: string;
    params?: Array<any>;
  }) => Promise<any>
): Promise<PublicKeyMessage> {
  const signature = await signEncryptionKey(
    encryptionPublicKey,
    address,
    providerRequest
  );

  console.log("Asking wallet to sign Public Key Message");
  console.log("Public Key Message signed");

  return new PublicKeyMessage({
    encryptionPublicKey: encryptionPublicKey,
    ethAddress: utils.hexToBytes(address),
    signature: utils.hexToBytes(signature),
  });
}

function buildMsgParams(encryptionPublicKey: Uint8Array, fromAddress: string) {
  return JSON.stringify({
    domain: {
      name: "Ethereum Private Message over Waku",
      version: "1",
    },
    message: {
      message:
        "By signing this message you certify that messages addressed to `ownerAddress` must be encrypted with `encryptionPublicKey`",
      encryptionPublicKey: utils.bytesToHex(encryptionPublicKey),
      ownerAddress: fromAddress,
    },
    // Refers to the keys of the *types* object below.
    primaryType: "PublishEncryptionPublicKey",
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
      ],
      PublishEncryptionPublicKey: [
        { name: "message", type: "string" },
        { name: "encryptionPublicKey", type: "string" },
        { name: "ownerAddress", type: "string" },
      ],
    },
  });
}

export async function signEncryptionKey(
  encryptionPublicKey: Uint8Array,
  fromAddress: string,
  providerRequest: (request: {
    method: string;
    params?: Array<any>;
    from?: string;
  }) => Promise<any>
): Promise<Uint8Array> {
  const msgParams = buildMsgParams(encryptionPublicKey, fromAddress);

  const result = await providerRequest({
    method: "eth_signTypedData_v4",
    params: [fromAddress, msgParams],
    from: fromAddress,
  });

  console.log("TYPED SIGNED:" + JSON.stringify(result));

  return utils.hexToBytes(result);
}

/**
 * Validate that the Encryption Public Key was signed by the holder of the given Ethereum address.
 */
export function validatePublicKeyMessage(msg: PublicKeyMessage): boolean {
  const recovered = sigUtil.recoverTypedSignature_v4({
    data: JSON.parse(
      buildMsgParams(
        msg.encryptionPublicKey,
        "0x" + utils.bytesToHex(msg.ethAddress)
      )
    ),
    sig: "0x" + utils.bytesToHex(msg.signature),
  });

  console.log("Recovered", recovered);
  console.log("ethAddress", "0x" + utils.bytesToHex(msg.ethAddress));

  return equals(utils.hexToBytes(recovered), msg.ethAddress);
}
