import { expect } from "chai";
import sinon from "sinon";

import { TTLSet } from "./utils.js";

describe("TTLSet", () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  it("should add and check entries correctly", () => {
    const ttlSet = new TTLSet<string>(60_000);

    ttlSet.add("test-entry");

    expect(ttlSet.has("test-entry")).to.be.true;
    expect(ttlSet.has("non-existent-entry")).to.be.false;
  });

  it("should support chaining for add method", () => {
    const ttlSet = new TTLSet<string>(60_000);

    ttlSet.add("entry1").add("entry2");

    expect(ttlSet.has("entry1")).to.be.true;
    expect(ttlSet.has("entry2")).to.be.true;
  });

  it("should remove expired entries after TTL has passed", () => {
    const ttlSet = new TTLSet<string>(1_000, 500);

    ttlSet.add("expiring-entry");
    expect(ttlSet.has("expiring-entry")).to.be.true;

    clock.tick(1_500);

    expect(ttlSet.has("expiring-entry")).to.be.false;
  });

  it("should keep entries that haven't expired yet", () => {
    const ttlSet = new TTLSet<string>(2_000, 500);

    ttlSet.add("entry");
    expect(ttlSet.has("entry")).to.be.true;

    clock.tick(1000);

    expect(ttlSet.has("entry")).to.be.true;
  });

  it("should handle different types of entries", () => {
    const numberSet = new TTLSet<number>(60_000);
    numberSet.add(123);
    expect(numberSet.has(123)).to.be.true;
    expect(numberSet.has(456)).to.be.false;

    const objectSet = new TTLSet<object>(60_000);
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    objectSet.add(obj1);
    expect(objectSet.has(obj1)).to.be.true;
    expect(objectSet.has(obj2)).to.be.false;
  });

  it("should properly clean up resources when disposed", () => {
    const ttlSet = new TTLSet<string>(60_000);
    const clearIntervalSpy = sinon.spy(global, "clearInterval");

    ttlSet.add("test-entry");
    ttlSet.dispose();

    expect(clearIntervalSpy.called).to.be.true;
    expect(ttlSet.has("test-entry")).to.be.false;
  });

  it("should continually clean up expired entries at intervals", () => {
    const ttlSet = new TTLSet<string>(1_000, 500);

    ttlSet.add("entry1");

    clock.tick(750);
    expect(ttlSet.has("entry1")).to.be.true;

    ttlSet.add("entry2");

    clock.tick(750);
    expect(ttlSet.has("entry1")).to.be.false;
    expect(ttlSet.has("entry2")).to.be.true;

    clock.tick(750);
    expect(ttlSet.has("entry2")).to.be.false;
  });
});
