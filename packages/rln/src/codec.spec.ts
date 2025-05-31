import {
  createDecoder,
  createEncoder,
  DecodedMessage
} from "@waku/core/lib/message/version_0";
import {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey
} from "@waku/message-encryption";
import {
  createDecoder as createAsymDecoder,
  createEncoder as createAsymEncoder
} from "@waku/message-encryption/ecies";
import {
  createDecoder as createSymDecoder,
  createEncoder as createSymEncoder
} from "@waku/message-encryption/symmetric";
import { expect } from "chai";

import {
  createRLNDecoder,
  createRLNEncoder,
  RLNDecoder,
  RLNEncoder
} from "./codec.js";
import {
  createTestMetaSetter,
  createTestRLNCodecSetup,
  EMPTY_PROTO_MESSAGE,
  TEST_CONSTANTS,
  verifyRLNMessage
} from "./codec.test-utils.js";
import { RlnMessage } from "./message.js";
import { epochBytesToInt } from "./utils/index.js";

describe("RLN codec with version 0", () => {
  it("toWire", async function () {
    const { rlnInstance, credential, index, payload } =
      await createTestRLNCodecSetup();

    const rlnEncoder = createRLNEncoder({
      encoder: createEncoder({ contentTopic: TEST_CONSTANTS.contentTopic }),
      rlnInstance,
      index,
      credential
    });
    const rlnDecoder = createRLNDecoder({
      rlnInstance,
      decoder: createDecoder(TEST_CONSTANTS.contentTopic)
    });

    const bytes = await rlnEncoder.toWire({ payload });

    expect(bytes).to.not.be.undefined;
    const protoResult = await rlnDecoder.fromWireToProtoObj(bytes!);
    expect(protoResult).to.not.be.undefined;
    const msg = (await rlnDecoder.fromProtoObj(
      TEST_CONSTANTS.emptyPubsubTopic,
      protoResult!
    ))!;

    verifyRLNMessage(msg, payload, TEST_CONSTANTS.contentTopic, 0, rlnInstance);
  });

  it("toProtoObj", async function () {
    const { rlnInstance, credential, index, payload } =
      await createTestRLNCodecSetup();

    const rlnEncoder = new RLNEncoder(
      createEncoder({ contentTopic: TEST_CONSTANTS.contentTopic }),
      rlnInstance,
      index,
      credential
    );
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      createDecoder(TEST_CONSTANTS.contentTopic)
    );

    const proto = await rlnEncoder.toProtoObj({ payload });

    expect(proto).to.not.be.undefined;
    const msg = (await rlnDecoder.fromProtoObj(
      TEST_CONSTANTS.emptyPubsubTopic,
      proto!
    )) as RlnMessage<DecodedMessage>;

    verifyRLNMessage(msg, payload, TEST_CONSTANTS.contentTopic, 0, rlnInstance);
  });
});

describe("RLN codec with version 1", () => {
  it("Symmetric, toWire", async function () {
    const { rlnInstance, credential, index, payload } =
      await createTestRLNCodecSetup();
    const symKey = generateSymmetricKey();

    const rlnEncoder = new RLNEncoder(
      createSymEncoder({
        contentTopic: TEST_CONSTANTS.contentTopic,
        symKey
      }),
      rlnInstance,
      index,
      credential
    );
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      createSymDecoder(TEST_CONSTANTS.contentTopic, symKey)
    );

    const bytes = await rlnEncoder.toWire({ payload });

    expect(bytes).to.not.be.undefined;
    const protoResult = await rlnDecoder.fromWireToProtoObj(bytes!);
    expect(protoResult).to.not.be.undefined;
    const msg = (await rlnDecoder.fromProtoObj(
      TEST_CONSTANTS.emptyPubsubTopic,
      protoResult!
    ))!;

    verifyRLNMessage(msg, payload, TEST_CONSTANTS.contentTopic, 1, rlnInstance);
  });

  it("Symmetric, toProtoObj", async function () {
    const { rlnInstance, credential, index, payload } =
      await createTestRLNCodecSetup();
    const symKey = generateSymmetricKey();

    const rlnEncoder = new RLNEncoder(
      createSymEncoder({
        contentTopic: TEST_CONSTANTS.contentTopic,
        symKey
      }),
      rlnInstance,
      index,
      credential
    );
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      createSymDecoder(TEST_CONSTANTS.contentTopic, symKey)
    );

    const proto = await rlnEncoder.toProtoObj({ payload });

    expect(proto).to.not.be.undefined;
    const msg = await rlnDecoder.fromProtoObj(
      TEST_CONSTANTS.emptyPubsubTopic,
      proto!
    );

    verifyRLNMessage(msg, payload, TEST_CONSTANTS.contentTopic, 1, rlnInstance);
  });

  it("Asymmetric, toWire", async function () {
    const { rlnInstance, credential, index, payload } =
      await createTestRLNCodecSetup();
    const privateKey = generatePrivateKey();
    const publicKey = getPublicKey(privateKey);

    const rlnEncoder = new RLNEncoder(
      createAsymEncoder({
        contentTopic: TEST_CONSTANTS.contentTopic,
        publicKey
      }),
      rlnInstance,
      index,
      credential
    );
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      createAsymDecoder(TEST_CONSTANTS.contentTopic, privateKey)
    );

    const bytes = await rlnEncoder.toWire({ payload });

    expect(bytes).to.not.be.undefined;
    const protoResult = await rlnDecoder.fromWireToProtoObj(bytes!);
    expect(protoResult).to.not.be.undefined;
    const msg = (await rlnDecoder.fromProtoObj(
      TEST_CONSTANTS.emptyPubsubTopic,
      protoResult!
    ))!;

    verifyRLNMessage(msg, payload, TEST_CONSTANTS.contentTopic, 1, rlnInstance);
  });

  it("Asymmetric, toProtoObj", async function () {
    const { rlnInstance, credential, index, payload } =
      await createTestRLNCodecSetup();
    const privateKey = generatePrivateKey();
    const publicKey = getPublicKey(privateKey);

    const rlnEncoder = new RLNEncoder(
      createAsymEncoder({
        contentTopic: TEST_CONSTANTS.contentTopic,
        publicKey
      }),
      rlnInstance,
      index,
      credential
    );
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      createAsymDecoder(TEST_CONSTANTS.contentTopic, privateKey)
    );

    const proto = await rlnEncoder.toProtoObj({ payload });

    expect(proto).to.not.be.undefined;
    const msg = await rlnDecoder.fromProtoObj(
      TEST_CONSTANTS.emptyPubsubTopic,
      proto!
    );

    verifyRLNMessage(msg, payload, TEST_CONSTANTS.contentTopic, 1, rlnInstance);
  });
});

describe("RLN Codec - epoch", () => {
  it("toProtoObj", async function () {
    const { rlnInstance, credential, index, payload } =
      await createTestRLNCodecSetup();

    const rlnEncoder = new RLNEncoder(
      createEncoder({ contentTopic: TEST_CONSTANTS.contentTopic }),
      rlnInstance,
      index,
      credential
    );
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      createDecoder(TEST_CONSTANTS.contentTopic)
    );

    const proto = await rlnEncoder.toProtoObj({ payload });

    expect(proto).to.not.be.undefined;
    const msg = (await rlnDecoder.fromProtoObj(
      TEST_CONSTANTS.emptyPubsubTopic,
      proto!
    )) as RlnMessage<DecodedMessage>;

    const epochBytes = proto!.rateLimitProof!.epoch;
    const epoch = epochBytesToInt(epochBytes);

    expect(msg.epoch!.toString(10).length).to.eq(9);
    expect(msg.epoch).to.eq(epoch);

    verifyRLNMessage(msg, payload, TEST_CONSTANTS.contentTopic, 0, rlnInstance);
  });
});

describe("RLN codec with version 0 and meta setter", () => {
  it("toWire", async function () {
    const { rlnInstance, credential, index, payload } =
      await createTestRLNCodecSetup();
    const metaSetter = createTestMetaSetter();

    const rlnEncoder = createRLNEncoder({
      encoder: createEncoder({
        contentTopic: TEST_CONSTANTS.contentTopic,
        metaSetter
      }),
      rlnInstance,
      index,
      credential
    });
    const rlnDecoder = createRLNDecoder({
      rlnInstance,
      decoder: createDecoder(TEST_CONSTANTS.contentTopic)
    });

    const bytes = await rlnEncoder.toWire({ payload });

    expect(bytes).to.not.be.undefined;
    const protoResult = await rlnDecoder.fromWireToProtoObj(bytes!);
    expect(protoResult).to.not.be.undefined;
    const msg = (await rlnDecoder.fromProtoObj(
      TEST_CONSTANTS.emptyPubsubTopic,
      protoResult!
    ))!;

    const expectedMeta = metaSetter({
      ...EMPTY_PROTO_MESSAGE,
      payload: protoResult!.payload
    });

    expect(msg!.meta).to.deep.eq(expectedMeta);
    verifyRLNMessage(msg, payload, TEST_CONSTANTS.contentTopic, 0, rlnInstance);
  });

  it("toProtoObj", async function () {
    const { rlnInstance, credential, index, payload } =
      await createTestRLNCodecSetup();
    const metaSetter = createTestMetaSetter();

    const rlnEncoder = new RLNEncoder(
      createEncoder({ contentTopic: TEST_CONSTANTS.contentTopic, metaSetter }),
      rlnInstance,
      index,
      credential
    );
    const rlnDecoder = new RLNDecoder(
      rlnInstance,
      createDecoder(TEST_CONSTANTS.contentTopic)
    );

    const proto = await rlnEncoder.toProtoObj({ payload });

    expect(proto).to.not.be.undefined;
    const msg = (await rlnDecoder.fromProtoObj(
      TEST_CONSTANTS.emptyPubsubTopic,
      proto!
    )) as RlnMessage<DecodedMessage>;

    const expectedMeta = metaSetter({
      ...EMPTY_PROTO_MESSAGE,
      payload: msg!.payload
    });

    expect(msg!.meta).to.deep.eq(expectedMeta);
    verifyRLNMessage(msg, payload, TEST_CONSTANTS.contentTopic, 0, rlnInstance);
  });
});
