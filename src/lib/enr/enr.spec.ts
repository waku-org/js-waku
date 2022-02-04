import { assert, expect } from "chai";
import { Multiaddr } from "multiaddr";
import PeerId from "peer-id";

import { bufToHex } from "../utils";

import { ERR_INVALID_ID } from "./constants";
import { ENR } from "./enr";
import { createKeypairFromPeerId } from "./keypair";

import { v4 } from "./index";

describe("ENR", function () {
  describe("Txt codec", () => {
    it("should encodeTxt and decodeTxt", async () => {
      const peerId = await PeerId.create({ keyType: "secp256k1" });
      const enr = ENR.createFromPeerId(peerId);
      const keypair = createKeypairFromPeerId(peerId);
      enr.setLocationMultiaddr(new Multiaddr("/ip4/18.223.219.100/udp/9000"));
      enr.multiaddrs = [
        new Multiaddr(
          "/dns4/node-01.do-ams3.wakuv2.test.statusim.net/tcp/443/wss"
        ),
        new Multiaddr(
          "/dns6/node-01.ac-cn-hongkong-c.wakuv2.test.statusim.net/tcp/443/wss"
        ),
        new Multiaddr(
          "/onion3/vww6ybal4bd7szmgncyruucpgfkqahzddi37ktceo3ah7ngmcopnpyyd:1234/wss"
        ),
      ];
      const txt = enr.encodeTxt(keypair.privateKey);
      expect(txt.slice(0, 4)).to.be.equal("enr:");
      const enr2 = ENR.decodeTxt(txt);
      expect(bufToHex(enr2.signature as Buffer)).to.be.equal(
        bufToHex(enr.signature as Buffer)
      );
      const multiaddr = enr2.getLocationMultiaddr("udp")!;
      expect(multiaddr.toString()).to.be.equal("/ip4/18.223.219.100/udp/9000");
      expect(enr2.multiaddrs).to.not.be.undefined;
      expect(enr2.multiaddrs!.length).to.be.equal(3);
      const multiaddrsAsStr = enr2.multiaddrs!.map((ma) => ma.toString());
      expect(multiaddrsAsStr).to.include(
        "/dns4/node-01.do-ams3.wakuv2.test.statusim.net/tcp/443/wss"
      );
      expect(multiaddrsAsStr).to.include(
        "/dns6/node-01.ac-cn-hongkong-c.wakuv2.test.statusim.net/tcp/443/wss"
      );
      expect(multiaddrsAsStr).to.include(
        "/onion3/vww6ybal4bd7szmgncyruucpgfkqahzddi37ktceo3ah7ngmcopnpyyd:1234/wss"
      );
    });

    it("should decode valid enr successfully", () => {
      const txt =
        "enr:-Ku4QMh15cIjmnq-co5S3tYaNXxDzKTgj0ufusA-QfZ66EWHNsULt2kb0eTHoo1Dkjvvf6CAHDS1Di-htjiPFZzaIPcLh2F0dG5ldHOIAAAAAAAAAACEZXRoMpD2d10HAAABE________x8AgmlkgnY0gmlwhHZFkMSJc2VjcDI1NmsxoQIWSDEWdHwdEA3Lw2B_byeFQOINTZ0GdtF9DBjes6JqtIN1ZHCCIyg";
      const enr = ENR.decodeTxt(txt);
      const eth2 = enr.get("eth2") as Buffer;
      expect(eth2).to.not.be.undefined;
      expect(bufToHex(eth2)).to.be.equal("f6775d0700000113ffffffffffff1f00");
    });

    it("should decode valid ENR with multiaddrs successfully [shared test vector]", () => {
      const txt =
        "enr:-QEnuEBEAyErHEfhiQxAVQoWowGTCuEF9fKZtXSd7H_PymHFhGJA3rGAYDVSHKCyJDGRLBGsloNbS8AZF33IVuefjOO6BIJpZIJ2NIJpcIQS39tkim11bHRpYWRkcnO4lgAvNihub2RlLTAxLmRvLWFtczMud2FrdXYyLnRlc3Quc3RhdHVzaW0ubmV0BgG73gMAODcxbm9kZS0wMS5hYy1jbi1ob25na29uZy1jLndha3V2Mi50ZXN0LnN0YXR1c2ltLm5ldAYBu94DACm9A62t7AQL4Ef5ZYZosRpQTzFVAB8jGjf1TER2wH-0zBOe1-MDBNLeA4lzZWNwMjU2azGhAzfsxbxyCkgCqq8WwYsVWH7YkpMLnU2Bw5xJSimxKav-g3VkcIIjKA";
      const enr = ENR.decodeTxt(txt);

      expect(enr.multiaddrs).to.not.be.undefined;
      expect(enr.multiaddrs!.length).to.be.equal(3);
      const multiaddrsAsStr = enr.multiaddrs!.map((ma) => ma.toString());
      expect(multiaddrsAsStr).to.include(
        "/dns4/node-01.do-ams3.wakuv2.test.statusim.net/tcp/443/wss"
      );
      expect(multiaddrsAsStr).to.include(
        "/dns6/node-01.ac-cn-hongkong-c.wakuv2.test.statusim.net/tcp/443/wss"
      );
      expect(multiaddrsAsStr).to.include(
        "/onion3/vww6ybal4bd7szmgncyruucpgfkqahzddi37ktceo3ah7ngmcopnpyyd:1234/wss"
      );
    });

    it("should decode valid enr with tcp successfully", async () => {
      const txt =
        "enr:-IS4QAmC_o1PMi5DbR4Bh4oHVyQunZblg4bTaottPtBodAhJZvxVlWW-4rXITPNg4mwJ8cW__D9FBDc9N4mdhyMqB-EBgmlkgnY0gmlwhIbRi9KJc2VjcDI1NmsxoQOevTdO6jvv3fRruxguKR-3Ge4bcFsLeAIWEDjrfaigNoN0Y3CCdl8";
      const enr = ENR.decodeTxt(txt);
      expect(enr.tcp).to.not.be.undefined;
      expect(enr.tcp).to.be.equal(30303);
      expect(enr.ip).to.not.be.undefined;
      expect(enr.ip).to.be.equal("134.209.139.210");
      expect(enr.publicKey).to.not.be.undefined;
      expect(enr.peerId.toB58String()).to.be.equal(
        "16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ"
      );
    });

    it("should throw error - no id", () => {
      try {
        const txt = Buffer.from(
          "656e723a2d435972595a62404b574342526c4179357a7a61445a584a42476b636e68344d486342465a6e75584e467264764a6a5830346a527a6a7a",
          "hex"
        ).toString();
        ENR.decodeTxt(txt);
        assert.fail("Expect error here");
      } catch (err: unknown) {
        const e = err as Error;
        expect(e.message).to.be.equal(ERR_INVALID_ID);
      }
    });

    it("should throw error - no public key", () => {
      try {
        const txt =
          "enr:-IS4QJ2d11eu6dC7E7LoXeLMgMP3kom1u3SE8esFSWvaHoo0dP1jg8O3-nx9ht-EO3CmG7L6OkHcMmoIh00IYWB92QABgmlkgnY0gmlwhH8AAAGJc2d11eu6dCsxoQIB_c-jQMOXsbjWkbN-kj99H57gfId5pfb4wa1qxwV4CIN1ZHCCIyk";
        ENR.decodeTxt(txt);
        assert.fail("Expect error here");
      } catch (err: unknown) {
        const e = err as Error;
        expect(e.message).to.be.equal("Failed to verify ENR: No public key");
      }
    });
  });

  describe("Verify", () => {
    it("should throw error - no id", () => {
      try {
        const enr = new ENR({}, BigInt(0), Buffer.alloc(0));
        enr.verify(Buffer.alloc(0), Buffer.alloc(0));
        assert.fail("Expect error here");
      } catch (err: unknown) {
        const e = err as Error;
        expect(e.message).to.be.equal(ERR_INVALID_ID);
      }
    });

    it("should throw error - invalid id", () => {
      try {
        const enr = new ENR(
          { id: Buffer.from("v3") },
          BigInt(0),
          Buffer.alloc(0)
        );
        enr.verify(Buffer.alloc(0), Buffer.alloc(0));
        assert.fail("Expect error here");
      } catch (err: unknown) {
        const e = err as Error;
        expect(e.message).to.be.equal(ERR_INVALID_ID);
      }
    });

    it("should throw error - no public key", () => {
      try {
        const enr = new ENR(
          { id: Buffer.from("v4") },
          BigInt(0),
          Buffer.alloc(0)
        );
        enr.verify(Buffer.alloc(0), Buffer.alloc(0));
        assert.fail("Expect error here");
      } catch (err: unknown) {
        const e = err as Error;
        expect(e.message).to.be.equal("Failed to verify ENR: No public key");
      }
    });

    it("should return false", () => {
      const txt =
        "enr:-Ku4QMh15cIjmnq-co5S3tYaNXxDzKTgj0ufusA-QfZ66EWHNsULt2kb0eTHoo1Dkjvvf6CAHDS1Di-htjiPFZzaIPcLh2F0dG5ldHOIAAAAAAAAAACEZXRoMpD2d10HAAABE________x8AgmlkgnY0gmlwhHZFkMSJc2VjcDI1NmsxoQIWSDEWdHwdEA3Lw2B_byeFQOINTZ0GdtF9DBjes6JqtIN1ZHCCIyg";
      const enr = ENR.decodeTxt(txt);
      // should have id and public key inside ENR
      expect(enr.verify(Buffer.alloc(32), Buffer.alloc(64))).to.be.false;
    });
  });

  describe("Fuzzing testcases", () => {
    it("should throw error in invalid signature", () => {
      const buf = Buffer.from(
        "656e723a2d4b7634514147774f54385374716d7749354c486149796d494f346f6f464b664e6b456a576130663150384f73456c67426832496a622d4772445f2d623957346b6350466377796e354845516d526371584e716470566f3168656f42683246306447356c64484f494141414141414141414143455a58526f4d704141414141414141414141505f5f5f5f5f5f5f5f5f5f676d6c6b676e5930676d6c7768424c663232534a6332566a634449314e6d73786f514a78436e4536765f7832656b67595f756f45317274777a76477934306d7139654436365866485042576749494e315a48437f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f434436410d0a",
        "hex"
      ).toString();
      try {
        ENR.decodeTxt(buf);
      } catch (err: unknown) {
        const e = err as Error;
        expect(e.message).to.equal(
          "Decoded ENR invalid signature: must be a byte array"
        );
      }
    });
    it("should throw error in invalid sequence number", () => {
      const buf = Buffer.from(
        "656e723a2d495334514b6b33ff583945717841337838334162436979416e537550444d764b353264433530486d31584744643574457951684d3356634a4c2d5062446b44673541507a5f706f76763022d48dcf992d5379716b306e616e636f4e572d656e7263713042676d6c6b676e5930676d6c77684838414141474a6332566a634449314e6d73786f514d31453579557370397638516a397476335a575843766146427672504e647a384b5049314e68576651577a494e315a4843434239410a",
        "hex"
      ).toString();
      try {
        ENR.decodeTxt(buf);
      } catch (err: unknown) {
        const e = err as Error;
        expect(e.message).to.equal(
          "Decoded ENR invalid sequence number: must be a byte array"
        );
      }
    });
  });

  describe("Static tests", () => {
    let privateKey: Buffer;
    let record: ENR;

    beforeEach(() => {
      const seq = 1n;
      privateKey = Buffer.from(
        "b71c71a67e1177ad4e901695e1b4b9ee17ae16c6668d313eac2f96dbcda3f291",
        "hex"
      );
      record = ENR.createV4(v4.publicKey(privateKey));
      record.set("ip", Buffer.from("7f000001", "hex"));
      record.set("udp", Buffer.from((30303).toString(16), "hex"));
      record.seq = seq;
    });

    it("should properly compute the node id", () => {
      expect(record.nodeId).to.equal(
        "a448f24c6d18e575453db13171562b71999873db5b286df957af199ec94617f7"
      );
    });

    it("should encode/decode to RLP encoding", () => {
      const decoded = ENR.decode(record.encode(privateKey));
      expect(decoded).to.deep.equal(record);
    });

    it("should encode/decode to text encoding", () => {
      // spec enr https://eips.ethereum.org/EIPS/eip-778
      const testTxt =
        "enr:-IS4QHCYrYZbAKWCBRlAy5zzaDZXJBGkcnh4MHcBFZntXNFrdvJjX04jRzjzCBOonrkTfj499SZuOh8R33Ls8RRcy5wBgmlkgnY0gmlwhH8AAAGJc2VjcDI1NmsxoQPKY0yuDUmstAHYpMa2_oxVtw0RW_QAdpzBQA8yWM0xOIN1ZHCCdl8";
      const decoded = ENR.decodeTxt(testTxt);
      expect(decoded.udp).to.be.equal(30303);
      expect(decoded.ip).to.be.equal("127.0.0.1");
      expect(decoded).to.deep.equal(record);
      expect(record.encodeTxt(privateKey)).to.equal(testTxt);
    });
  });

  describe("Multiaddr getters and setters", () => {
    let privateKey: Buffer;
    let record: ENR;

    beforeEach(() => {
      privateKey = Buffer.from(
        "b71c71a67e1177ad4e901695e1b4b9ee17ae16c6668d313eac2f96dbcda3f291",
        "hex"
      );
      record = ENR.createV4(v4.publicKey(privateKey));
    });

    it("should get / set UDP multiaddr", () => {
      const multi0 = new Multiaddr("/ip4/127.0.0.1/udp/30303");
      const tuples0 = multi0.tuples();

      if (!tuples0[0][1] || !tuples0[1][1]) {
        throw new Error("invalid multiaddr");
      }
      // set underlying records
      record.set("ip", tuples0[0][1]);
      record.set("udp", tuples0[1][1]);
      // and get the multiaddr
      expect(record.getLocationMultiaddr("udp")!.toString()).to.equal(
        multi0.toString()
      );
      // set the multiaddr
      const multi1 = new Multiaddr("/ip4/0.0.0.0/udp/30300");
      record.setLocationMultiaddr(multi1);
      // and get the multiaddr
      expect(record.getLocationMultiaddr("udp")!.toString()).to.equal(
        multi1.toString()
      );
      // and get the underlying records
      const tuples1 = multi1.tuples();
      expect(record.get("ip")).to.deep.equal(tuples1[0][1]);
      expect(record.get("udp")).to.deep.equal(tuples1[1][1]);
    });

    it("should get / set TCP multiaddr", () => {
      const multi0 = new Multiaddr("/ip4/127.0.0.1/tcp/30303");
      const tuples0 = multi0.tuples();

      if (!tuples0[0][1] || !tuples0[1][1]) {
        throw new Error("invalid multiaddr");
      }

      // set underlying records
      record.set("ip", tuples0[0][1]);
      record.set("tcp", tuples0[1][1]);
      // and get the multiaddr
      expect(record.getLocationMultiaddr("tcp")!.toString()).to.equal(
        multi0.toString()
      );
      // set the multiaddr
      const multi1 = new Multiaddr("/ip4/0.0.0.0/tcp/30300");
      record.setLocationMultiaddr(multi1);
      // and get the multiaddr
      expect(record.getLocationMultiaddr("tcp")!.toString()).to.equal(
        multi1.toString()
      );
      // and get the underlying records
      const tuples1 = multi1.tuples();
      expect(record.get("ip")).to.deep.equal(tuples1[0][1]);
      expect(record.get("tcp")).to.deep.equal(tuples1[1][1]);
    });
  });

  describe("Location multiaddr", async () => {
    const ip4 = "127.0.0.1";
    const ip6 = "::1";
    const tcp = 8080;
    const udp = 8080;
    let peerId;
    let enr: ENR;

    before(async function () {
      peerId = await PeerId.create({ keyType: "secp256k1" });
      enr = ENR.createFromPeerId(peerId);
      enr.ip = ip4;
      enr.ip6 = ip6;
      enr.tcp = tcp;
      enr.udp = udp;
      enr.tcp6 = tcp;
      enr.udp6 = udp;
    });

    it("should properly create location multiaddrs - udp4", () => {
      expect(enr.getLocationMultiaddr("udp4")).to.deep.equal(
        new Multiaddr(`/ip4/${ip4}/udp/${udp}`)
      );
    });

    it("should properly create location multiaddrs - tcp4", () => {
      expect(enr.getLocationMultiaddr("tcp4")).to.deep.equal(
        new Multiaddr(`/ip4/${ip4}/tcp/${tcp}`)
      );
    });

    it("should properly create location multiaddrs - udp6", () => {
      expect(enr.getLocationMultiaddr("udp6")).to.deep.equal(
        new Multiaddr(`/ip6/${ip6}/udp/${udp}`)
      );
    });

    it("should properly create location multiaddrs - tcp6", () => {
      expect(enr.getLocationMultiaddr("tcp6")).to.deep.equal(
        new Multiaddr(`/ip6/${ip6}/tcp/${tcp}`)
      );
    });

    it("should properly create location multiaddrs - udp", () => {
      // default to ip4
      expect(enr.getLocationMultiaddr("udp")).to.deep.equal(
        new Multiaddr(`/ip4/${ip4}/udp/${udp}`)
      );
      // if ip6 is set, use it
      enr.ip = undefined;
      expect(enr.getLocationMultiaddr("udp")).to.deep.equal(
        new Multiaddr(`/ip6/${ip6}/udp/${udp}`)
      );
      // if ip6 does not exist, use ip4
      enr.ip6 = undefined;
      enr.ip = ip4;
      expect(enr.getLocationMultiaddr("udp")).to.deep.equal(
        new Multiaddr(`/ip4/${ip4}/udp/${udp}`)
      );
      enr.ip6 = ip6;
    });

    it("should properly create location multiaddrs - tcp", () => {
      // default to ip4
      expect(enr.getLocationMultiaddr("tcp")).to.deep.equal(
        new Multiaddr(`/ip4/${ip4}/tcp/${tcp}`)
      );
      // if ip6 is set, use it
      enr.ip = undefined;
      expect(enr.getLocationMultiaddr("tcp")).to.deep.equal(
        new Multiaddr(`/ip6/${ip6}/tcp/${tcp}`)
      );
      // if ip6 does not exist, use ip4
      enr.ip6 = undefined;
      enr.ip = ip4;
      expect(enr.getLocationMultiaddr("tcp")).to.deep.equal(
        new Multiaddr(`/ip4/${ip4}/tcp/${tcp}`)
      );
      enr.ip6 = ip6;
    });
  });
});
