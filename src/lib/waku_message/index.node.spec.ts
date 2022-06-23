import { expect } from "chai";
import debug from "debug";

import {
  makeLogFileName,
  NOISE_KEY_1,
  Nwaku,
  WakuRelayMessage,
} from "../../test_utils";
import { delay } from "../../test_utils/delay";
import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey,
} from "../crypto";
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from "../utils";
import { createWaku, Protocols, Waku } from "../waku";

import { DecryptionMethod, WakuMessage } from "./index";

const dbg = debug("waku:test:message");

const TestContentTopic = "/test/1/waku-message/utf8";

describe("Waku Message [node only]", function () {
  describe("Interop: nwaku", function () {
    let waku: Waku;
    let nwaku: Nwaku;

    beforeEach(async function () {
      this.timeout(30_000);
      waku = await createWaku({
        staticNoiseKey: NOISE_KEY_1,
      });
      await waku.start();

      nwaku = new Nwaku(makeLogFileName(this));
      dbg("Starting nwaku node");
      await nwaku.start({ rpcPrivate: true });

      dbg("Dialing to nwaku node");
      await waku.dial(await nwaku.getMultiaddrWithId());
      dbg("Wait for remote peer");
      await waku.waitForRemotePeer([Protocols.Relay]);
      dbg("Remote peer ready");
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
      const message: WakuRelayMessage = {
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
      dbg("Post message");
      const res = await nwaku.postAsymmetricMessage(message, publicKey);
      expect(res).to.be.true;

      const receivedMsg = await receivedMsgPromise;

      expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
      expect(receivedMsg.version).to.eq(1);
      expect(receivedMsg.payloadAsUtf8).to.eq(messageText);
    });

    it("Encrypts message for nwaku [asymmetric, no signature]", async function () {
      this.timeout(5000);

      dbg("Ask nwaku to generate asymmetric key pair");
      const keyPair = await nwaku.getAsymmetricKeyPair();
      const privateKey = hexToBytes(keyPair.privateKey);
      const publicKey = hexToBytes(keyPair.publicKey);

      const messageText = "This is a message I am going to encrypt";
      dbg("Encrypt message");
      const message = await WakuMessage.fromUtf8String(
        messageText,
        TestContentTopic,
        {
          encPublicKey: publicKey,
        }
      );

      dbg("Send message over relay");
      await waku.relay.send(message);

      let msgs: WakuRelayMessage[] = [];

      while (msgs.length === 0) {
        dbg("Wait for message to be seen by nwaku");
        await delay(200);
        msgs = await nwaku.getAsymmetricMessages(privateKey);
      }

      dbg("Check message content");
      expect(msgs[0].contentTopic).to.equal(message.contentTopic);
      expect(bytesToUtf8(hexToBytes(msgs[0].payload))).to.equal(messageText);
    });

    it("Decrypts nwaku message [symmetric, no signature]", async function () {
      this.timeout(5000);

      const messageText = "Here is a message encrypted in a symmetric manner.";
      const message: WakuRelayMessage = {
        contentTopic: TestContentTopic,
        payload: bytesToHex(utf8ToBytes(messageText)),
      };

      dbg("Generate symmetric key");
      const symKey = generateSymmetricKey();

      waku.relay.addDecryptionKey(symKey, {
        method: DecryptionMethod.Symmetric,
      });

      const receivedMsgPromise: Promise<WakuMessage> = new Promise(
        (resolve) => {
          waku.relay.addObserver(resolve);
        }
      );

      dbg("Post message using nwaku");
      await nwaku.postSymmetricMessage(message, symKey);
      dbg("Wait for message to be received by js-waku");
      const receivedMsg = await receivedMsgPromise;
      dbg("Message received by js-waku");

      expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
      expect(receivedMsg.version).to.eq(1);
      expect(receivedMsg.payloadAsUtf8).to.eq(messageText);
    });

    it("Encrypts message for nwaku [symmetric, no signature]", async function () {
      this.timeout(5000);

      dbg("Getting symmetric key from nwaku");
      const symKey = await nwaku.getSymmetricKey();
      dbg("Encrypting message with js-waku");
      const messageText =
        "This is a message I am going to encrypt with a symmetric key";
      const message = await WakuMessage.fromUtf8String(
        messageText,
        TestContentTopic,
        {
          symKey: symKey,
        }
      );
      dbg("Sending message over relay");
      await waku.relay.send(message);

      let msgs: WakuRelayMessage[] = [];

      while (msgs.length === 0) {
        await delay(200);
        dbg("Getting messages from nwaku");
        msgs = await nwaku.getSymmetricMessages(symKey);
      }

      expect(msgs[0].contentTopic).to.equal(message.contentTopic);
      expect(bytesToUtf8(hexToBytes(msgs[0].payload))).to.equal(messageText);
    });
  });
});
