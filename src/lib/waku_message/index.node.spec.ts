import { expect } from "chai";
import debug from "debug";

import {
  makeLogFileName,
  MessageRpcQuery,
  MessageRpcResponseHex,
  NOISE_KEY_1,
  Nwaku,
} from "../../test_utils";
import { delay } from "../../test_utils/delay";
import { createPrivacyNode } from "../create_waku";
import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey,
} from "../crypto";
import type { WakuPrivacy } from "../interfaces";
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from "../utils";
import { waitForRemotePeer } from "../wait_for_remote_peer";
import { Protocols } from "../waku";

import { DecryptionMethod, WakuMessage } from "./index";

const log = debug("waku:test:message");

const TestContentTopic = "/test/1/waku-message/utf8";

describe("Waku Message [node only]", function () {
  describe("Interop: nwaku", function () {
    let waku: WakuPrivacy;
    let nwaku: Nwaku;

    beforeEach(async function () {
      this.timeout(30_000);
      waku = await createPrivacyNode({
        staticNoiseKey: NOISE_KEY_1,
      });
      await waku.start();

      nwaku = new Nwaku(makeLogFileName(this));
      log("Starting nwaku node");
      await nwaku.start({ rpcPrivate: true });

      log("Dialing to nwaku node");
      await waku.dial(await nwaku.getMultiaddrWithId());
      log("Wait for remote peer");
      await waitForRemotePeer(waku, [Protocols.Relay]);
      log("Remote peer ready");
      // As this test uses the nwaku RPC API, we somehow often face
      // Race conditions where the nwaku node does not have the js-waku
      // Node in its relay mesh just yet.
      await delay(500);
    });

    afterEach(async function () {
      !!nwaku && nwaku.stop();
      !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
    });

    it("Decrypts nwaku message [asymmetric, no signature]", async function () {
      this.timeout(5000);

      const messageText = "Here is an encrypted message.";
      const message: MessageRpcQuery = {
        contentTopic: TestContentTopic,
        payload: bytesToHex(utf8ToBytes(messageText)),
      };

      const privateKey = generatePrivateKey();

      waku.relay.addDecryptionKey(privateKey, {
        method: DecryptionMethod.Asymmetric,
      });

      const receivedMsgPromise: Promise<WakuMessage> = new Promise(
        (resolve) => {
          waku.relay.addObserver(resolve);
        }
      );

      const publicKey = getPublicKey(privateKey);
      log("Post message");
      const res = await nwaku.postAsymmetricMessage(message, publicKey);
      expect(res).to.be.true;

      const receivedMsg = await receivedMsgPromise;

      expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
      expect(receivedMsg.version).to.eq(1);
      expect(receivedMsg.payloadAsUtf8).to.eq(messageText);
    });

    it("Encrypts message for nwaku [asymmetric, no signature]", async function () {
      this.timeout(5000);

      log("Ask nwaku to generate asymmetric key pair");
      const keyPair = await nwaku.getAsymmetricKeyPair();
      const privateKey = hexToBytes(keyPair.privateKey);
      const publicKey = hexToBytes(keyPair.publicKey);

      const messageText = "This is a message I am going to encrypt";
      log("Encrypt message");
      const message = await WakuMessage.fromUtf8String(
        messageText,
        TestContentTopic,
        {
          encPublicKey: publicKey,
        }
      );

      log("Send message over relay");
      await waku.relay.send(message);

      let msgs: MessageRpcResponseHex[] = [];

      while (msgs.length === 0) {
        log("Wait for message to be seen by nwaku");
        await delay(200);
        msgs = await nwaku.getAsymmetricMessages(privateKey);
      }

      log("Check message content");
      expect(msgs[0].contentTopic).to.equal(message.contentTopic);
      expect(bytesToUtf8(hexToBytes(msgs[0].payload))).to.equal(messageText);
    });

    it("Decrypts nwaku message [symmetric, no signature]", async function () {
      this.timeout(5000);

      const messageText = "Here is a message encrypted in a symmetric manner.";
      const message: MessageRpcQuery = {
        contentTopic: TestContentTopic,
        payload: bytesToHex(utf8ToBytes(messageText)),
      };

      log("Generate symmetric key");
      const symKey = generateSymmetricKey();

      waku.relay.addDecryptionKey(symKey, {
        method: DecryptionMethod.Symmetric,
      });

      const receivedMsgPromise: Promise<WakuMessage> = new Promise(
        (resolve) => {
          waku.relay.addObserver(resolve);
        }
      );

      log("Post message using nwaku");
      await nwaku.postSymmetricMessage(message, symKey);
      log("Wait for message to be received by js-waku");
      const receivedMsg = await receivedMsgPromise;
      log("Message received by js-waku");

      expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
      expect(receivedMsg.version).to.eq(1);
      expect(receivedMsg.payloadAsUtf8).to.eq(messageText);
    });

    it("Encrypts message for nwaku [symmetric, no signature]", async function () {
      this.timeout(5000);

      log("Getting symmetric key from nwaku");
      const symKey = await nwaku.getSymmetricKey();
      log("Encrypting message with js-waku");
      const messageText =
        "This is a message I am going to encrypt with a symmetric key";
      const message = await WakuMessage.fromUtf8String(
        messageText,
        TestContentTopic,
        {
          symKey: symKey,
        }
      );
      log("Sending message over relay");
      await waku.relay.send(message);

      let msgs: MessageRpcResponseHex[] = [];

      while (msgs.length === 0) {
        await delay(200);
        log("Getting messages from nwaku");
        msgs = await nwaku.getSymmetricMessages(symKey);
      }

      expect(msgs[0].contentTopic).to.equal(message.contentTopic);
      expect(bytesToUtf8(hexToBytes(msgs[0].payload))).to.equal(messageText);
    });
  });
});
