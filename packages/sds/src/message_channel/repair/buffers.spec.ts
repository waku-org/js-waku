import { expect } from "chai";

import type { HistoryEntry } from "../message.js";

import { IncomingRepairBuffer, OutgoingRepairBuffer } from "./buffers.js";

describe("OutgoingRepairBuffer", () => {
  let buffer: OutgoingRepairBuffer;

  beforeEach(() => {
    buffer = new OutgoingRepairBuffer(3); // Small buffer for testing
  });

  it("should add entries and maintain sorted order", () => {
    const entry1: HistoryEntry = { messageId: "msg1" };
    const entry2: HistoryEntry = { messageId: "msg2" };
    const entry3: HistoryEntry = { messageId: "msg3" };

    buffer.add(entry2, 2000);
    buffer.add(entry1, 1000);
    buffer.add(entry3, 3000);

    const items = buffer.getItems();
    expect(items).to.have.lengthOf(3);
    expect(items[0].tReq).to.equal(1000);
    expect(items[1].tReq).to.equal(2000);
    expect(items[2].tReq).to.equal(3000);
  });

  it("should not update T_req if message already exists", () => {
    const entry: HistoryEntry = { messageId: "msg1" };

    buffer.add(entry, 1000);
    buffer.add(entry, 2000); // Try to add again with different T_req

    const items = buffer.getItems();
    expect(items).to.have.lengthOf(1);
    expect(items[0].tReq).to.equal(1000); // Should keep original
  });

  it("should evict oldest entry when buffer is full", () => {
    const entry1: HistoryEntry = { messageId: "msg1" };
    const entry2: HistoryEntry = { messageId: "msg2" };
    const entry3: HistoryEntry = { messageId: "msg3" };
    const entry4: HistoryEntry = { messageId: "msg4" };

    buffer.add(entry2, 2000);
    buffer.add(entry1, 1000);
    buffer.add(entry3, 3000);
    buffer.add(entry4, 1500); // Should evict msg1 (oldest T_req)

    const items = buffer.getItems();
    expect(items).to.have.lengthOf(3);
    expect(buffer.has("msg1")).to.be.false; // msg1 should be evicted
    expect(buffer.has("msg2")).to.be.true;
    expect(buffer.has("msg3")).to.be.true;
    expect(buffer.has("msg4")).to.be.true;
  });

  it("should get eligible entries based on current time", () => {
    const entry1: HistoryEntry = { messageId: "msg1" };
    const entry2: HistoryEntry = { messageId: "msg2" };
    const entry3: HistoryEntry = { messageId: "msg3" };

    buffer.add(entry1, 1000);
    buffer.add(entry2, 2000);
    buffer.add(entry3, 3000);

    const eligible = buffer.getEligible(1500, 3);
    expect(eligible).to.have.lengthOf(1);
    expect(eligible[0].messageId).to.equal("msg1");

    const eligible2 = buffer.getEligible(2500, 3);
    expect(eligible2).to.have.lengthOf(2);
    expect(eligible2[0].messageId).to.equal("msg1");
    expect(eligible2[1].messageId).to.equal("msg2");
  });

  it("should respect maxRequests limit", () => {
    const entry1: HistoryEntry = { messageId: "msg1" };
    const entry2: HistoryEntry = { messageId: "msg2" };
    const entry3: HistoryEntry = { messageId: "msg3" };

    buffer.add(entry1, 1000);
    buffer.add(entry2, 2000);
    buffer.add(entry3, 3000);

    const eligible = buffer.getEligible(5000, 2); // All are eligible but limit to 2
    expect(eligible).to.have.lengthOf(2);
    expect(eligible[0].messageId).to.equal("msg1");
    expect(eligible[1].messageId).to.equal("msg2");
  });

  it("should remove entries", () => {
    const entry1: HistoryEntry = { messageId: "msg1" };
    const entry2: HistoryEntry = { messageId: "msg2" };

    buffer.add(entry1, 1000);
    buffer.add(entry2, 2000);

    expect(buffer.size).to.equal(2);
    buffer.remove("msg1");
    expect(buffer.size).to.equal(1);
    expect(buffer.has("msg1")).to.be.false;
    expect(buffer.has("msg2")).to.be.true;
  });

  it("should handle retrieval hint and sender_id", () => {
    const hint = new Uint8Array([1, 2, 3]);
    const entry: HistoryEntry = {
      messageId: "msg1",
      retrievalHint: hint,
      senderId: "sender1"
    };

    buffer.add(entry, 1000);
    const all = buffer.getAll();
    expect(all[0].retrievalHint).to.deep.equal(hint);
    expect(all[0].senderId).to.equal("sender1");
  });
});

describe("IncomingRepairBuffer", () => {
  let buffer: IncomingRepairBuffer;

  beforeEach(() => {
    buffer = new IncomingRepairBuffer(3); // Small buffer for testing
  });

  it("should add entries and maintain sorted order", () => {
    const entry1: HistoryEntry = { messageId: "msg1" };
    const entry2: HistoryEntry = { messageId: "msg2" };
    const entry3: HistoryEntry = { messageId: "msg3" };

    buffer.add(entry2, 2000);
    buffer.add(entry1, 1000);
    buffer.add(entry3, 3000);

    const items = buffer.getItems();
    expect(items).to.have.lengthOf(3);
    expect(items[0].tResp).to.equal(1000);
    expect(items[1].tResp).to.equal(2000);
    expect(items[2].tResp).to.equal(3000);
  });

  it("should ignore duplicate entries", () => {
    const entry: HistoryEntry = { messageId: "msg1" };

    buffer.add(entry, 1000);
    buffer.add(entry, 500); // Try to add again with earlier T_resp

    const items = buffer.getItems();
    expect(items).to.have.lengthOf(1);
    expect(items[0].tResp).to.equal(1000); // Should keep original
  });

  it("should evict furthest entry when buffer is full", () => {
    const entry1: HistoryEntry = { messageId: "msg1" };
    const entry2: HistoryEntry = { messageId: "msg2" };
    const entry3: HistoryEntry = { messageId: "msg3" };
    const entry4: HistoryEntry = { messageId: "msg4" };

    buffer.add(entry1, 1000);
    buffer.add(entry2, 2000);
    buffer.add(entry3, 3000);
    buffer.add(entry4, 1500); // Should evict msg3 (furthest T_resp)

    const items = buffer.getItems();
    expect(items).to.have.lengthOf(3);
    expect(buffer.has("msg3")).to.be.false; // msg3 should be evicted
    expect(buffer.has("msg1")).to.be.true;
    expect(buffer.has("msg2")).to.be.true;
    expect(buffer.has("msg4")).to.be.true;
  });

  it("should get and remove ready entries", () => {
    const entry1: HistoryEntry = { messageId: "msg1" };
    const entry2: HistoryEntry = { messageId: "msg2" };
    const entry3: HistoryEntry = { messageId: "msg3" };

    buffer.add(entry1, 1000);
    buffer.add(entry2, 2000);
    buffer.add(entry3, 3000);

    const ready = buffer.getReady(1500);
    expect(ready).to.have.lengthOf(1);
    expect(ready[0].messageId).to.equal("msg1");

    // Entry should be removed from buffer
    expect(buffer.size).to.equal(2);
    expect(buffer.has("msg1")).to.be.false;

    const ready2 = buffer.getReady(2500);
    expect(ready2).to.have.lengthOf(1);
    expect(ready2[0].messageId).to.equal("msg2");

    expect(buffer.size).to.equal(1);
    expect(buffer.has("msg2")).to.be.false;
    expect(buffer.has("msg3")).to.be.true;
  });

  it("should remove entries", () => {
    const entry1: HistoryEntry = { messageId: "msg1" };
    const entry2: HistoryEntry = { messageId: "msg2" };

    buffer.add(entry1, 1000);
    buffer.add(entry2, 2000);

    expect(buffer.size).to.equal(2);
    buffer.remove("msg1");
    expect(buffer.size).to.equal(1);
    expect(buffer.has("msg1")).to.be.false;
    expect(buffer.has("msg2")).to.be.true;
  });

  it("should clear all entries", () => {
    const entry1: HistoryEntry = { messageId: "msg1" };
    const entry2: HistoryEntry = { messageId: "msg2" };

    buffer.add(entry1, 1000);
    buffer.add(entry2, 2000);

    expect(buffer.size).to.equal(2);
    buffer.clear();
    expect(buffer.size).to.equal(0);
  });
});
