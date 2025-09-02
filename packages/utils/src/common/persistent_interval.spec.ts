import { expect } from "chai";
import sinon from "sinon";

import { PersistentInterval } from "./persistent_interval.js";

describe("PersistentInterval", () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    PersistentInterval.destroy();
    clock.restore();
  });

  it("should create singleton instance", () => {
    const instance1 = PersistentInterval.getInstance();
    const instance2 = PersistentInterval.getInstance();
    expect(instance1).to.equal(instance2);
  });

  it("should schedule and execute tasks", () => {
    const callback = sinon.stub();
    const interval = 1000;

    const taskId = PersistentInterval.setInterval(callback, interval);

    expect(taskId).to.be.a("string");
    expect(callback.called).to.be.false;

    clock.tick(1000);
    expect(callback.calledOnce).to.be.true;

    clock.tick(1000);
    expect(callback.calledTwice).to.be.true;
  });

  it("should clear specific task", () => {
    const callback1 = sinon.stub();
    const callback2 = sinon.stub();
    const interval = 1000;

    const taskId1 = PersistentInterval.setInterval(callback1, interval);
    PersistentInterval.setInterval(callback2, interval);

    PersistentInterval.clearInterval(taskId1);

    clock.tick(1000);
    expect(callback1.called).to.be.false;
    expect(callback2.calledOnce).to.be.true;
  });

  it("should clear all tasks", () => {
    const callback1 = sinon.stub();
    const callback2 = sinon.stub();
    const interval = 1000;

    PersistentInterval.setInterval(callback1, interval);
    PersistentInterval.setInterval(callback2, interval);

    PersistentInterval.clearAll();

    clock.tick(1000);
    expect(callback1.called).to.be.false;
    expect(callback2.called).to.be.false;
  });

  it("should handle multiple tasks with different intervals", () => {
    const callback1 = sinon.stub();
    const callback2 = sinon.stub();
    const interval1 = 1000;
    const interval2 = 2000;

    PersistentInterval.setInterval(callback1, interval1);
    PersistentInterval.setInterval(callback2, interval2);

    clock.tick(1000);
    expect(callback1.calledOnce).to.be.true;
    expect(callback2.called).to.be.false;

    clock.tick(1000);
    expect(callback1.calledTwice).to.be.true;
    expect(callback2.calledOnce).to.be.true;
  });

  it("should handle task errors gracefully", () => {
    const errorCallback = sinon.stub().throws(new Error("Test error"));
    const normalCallback = sinon.stub();
    const interval = 1000;

    PersistentInterval.setInterval(errorCallback, interval);
    PersistentInterval.setInterval(normalCallback, interval);

    clock.tick(1000);
    expect(errorCallback.calledOnce).to.be.true;
    expect(normalCallback.calledOnce).to.be.true;

    clock.tick(1000);
    expect(errorCallback.calledTwice).to.be.true;
    expect(normalCallback.calledTwice).to.be.true;
  });

  it("should get task count correctly", () => {
    const instance = PersistentInterval.getInstance();

    expect(instance.getTaskCount()).to.equal(0);

    const callback = sinon.stub();
    PersistentInterval.setInterval(callback, 1000);

    expect(instance.getTaskCount()).to.equal(1);

    PersistentInterval.clearAll();
    expect(instance.getTaskCount()).to.equal(0);
  });

  it("should check if task is scheduled", () => {
    const callback = sinon.stub();
    const interval = 1000;

    const taskId = PersistentInterval.setInterval(callback, interval);
    const instance = PersistentInterval.getInstance();

    expect(instance.isTaskScheduled(taskId)).to.be.true;
    expect(instance.isTaskScheduled("non-existent-id")).to.be.false;

    PersistentInterval.clearInterval(taskId);
    expect(instance.isTaskScheduled(taskId)).to.be.false;
  });

  it("should handle rapid task creation and removal", () => {
    const callbacks: sinon.SinonStub[] = [];
    const interval = 1000;

    for (let i = 0; i < 10; i++) {
      callbacks.push(sinon.stub());
      PersistentInterval.setInterval(callbacks[i], interval);
    }

    clock.tick(1000);

    for (let i = 0; i < 10; i++) {
      expect(callbacks[i].calledOnce).to.be.true;
    }

    PersistentInterval.clearAll();
    clock.tick(1000);

    for (let i = 0; i < 10; i++) {
      expect(callbacks[i].calledOnce).to.be.true;
    }
  });

  it("should work in Node.js environment without browser APIs", () => {
    const callback = sinon.stub();
    const interval = 1000;

    const taskId = PersistentInterval.setInterval(callback, interval);

    expect(taskId).to.be.a("string");
    expect(callback.called).to.be.false;

    clock.tick(1000);
    expect(callback.calledOnce).to.be.true;

    PersistentInterval.clearInterval(taskId);
    expect(PersistentInterval.getInstance().getTaskCount()).to.equal(0);
  });
});
