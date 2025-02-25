import { Connection, Peer, PeerId, Stream } from "@libp2p/interface";
import { expect } from "chai";
import sinon from "sinon";

import { StreamManager } from "./stream_manager.js";

const MULTICODEC = "/test";

describe("StreamManager", () => {
  let eventTarget: EventTarget;
  let streamManager: StreamManager;

  const mockPeer: Peer = {
    id: {
      toString() {
        return "1";
      }
    }
  } as unknown as Peer;

  beforeEach(() => {
    eventTarget = new EventTarget();
    streamManager = new StreamManager(
      MULTICODEC,
      () => [],
      eventTarget.addEventListener.bind(eventTarget)
    );
  });

  it("should return usable stream attached to connection", async () => {
    for (const writeStatus of ["ready", "writing"]) {
      const con1 = createMockConnection();
      con1.streams = [
        createMockStream({ id: "1", protocol: MULTICODEC, writeStatus })
      ];

      streamManager["getConnections"] = (_peerId: PeerId | undefined) => [con1];

      const stream = await streamManager.getStream(mockPeer.id);

      expect(stream).not.to.be.undefined;
      expect(stream?.id).to.be.eq("1");
    }
  });

  it("should throw if no connection provided", async () => {
    streamManager["getConnections"] = (_peerId: PeerId | undefined) => [];

    let error: Error | undefined;
    try {
      await streamManager.getStream(mockPeer.id);
    } catch (e) {
      error = e as Error;
    }

    expect(error).not.to.be.undefined;
    expect(error?.message).to.include(mockPeer.id.toString());
    expect(error?.message).to.include(MULTICODEC);
  });

  it("should create a new stream if no existing for protocol found", async () => {
    for (const writeStatus of ["done", "closed", "closing"]) {
      const con1 = createMockConnection();
      con1.streams = [
        createMockStream({ id: "1", protocol: MULTICODEC, writeStatus })
      ];

      const newStreamSpy = sinon.spy(async (_protocol, _options) =>
        createMockStream({
          id: "2",
          protocol: MULTICODEC,
          writeStatus: "writable"
        })
      );

      con1.newStream = newStreamSpy;
      streamManager["getConnections"] = (_peerId: PeerId | undefined) => [con1];

      const stream = await streamManager.getStream(mockPeer.id);

      expect(stream).not.to.be.undefined;
      expect(stream?.id).to.be.eq("2");

      expect(newStreamSpy.calledOnce).to.be.true;
      expect(newStreamSpy.calledWith(MULTICODEC)).to.be.true;
    }
  });

  it("should return different streams if requested simultaniously", async () => {
    const con1 = createMockConnection();
    con1.streams = [createMockStream({ id: "1", protocol: MULTICODEC })];

    const newStreamSpy = sinon.spy(async (_protocol, _options) =>
      createMockStream({
        id: "2",
        protocol: MULTICODEC,
        writeStatus: "writable"
      })
    );

    con1.newStream = newStreamSpy;
    streamManager["getConnections"] = (_peerId: PeerId | undefined) => [con1];

    const [stream1, stream2] = await Promise.all([
      streamManager.getStream(mockPeer.id),
      streamManager.getStream(mockPeer.id)
    ]);

    const expected = ["1", "2"].toString();
    const actual = [stream1.id, stream2.id].sort().toString();

    expect(actual).to.be.eq(expected);
  });

  it("peer:update - should do nothing if another protocol hit", async () => {
    const scheduleNewStreamSpy = sinon.spy();
    streamManager["scheduleNewStream"] = scheduleNewStreamSpy;
    eventTarget.dispatchEvent(
      new CustomEvent("peer:update", { detail: { peer: { protocols: [] } } })
    );

    expect(scheduleNewStreamSpy.calledOnce).to.be.false;
  });

  it("peer:update - should schedule stream creation IF protocol hit AND no stream found on connection", async () => {
    const scheduleNewStreamSpy = sinon.spy();
    streamManager["scheduleNewStream"] = scheduleNewStreamSpy;
    eventTarget.dispatchEvent(
      new CustomEvent("peer:update", {
        detail: { peer: { protocols: [MULTICODEC] } }
      })
    );

    expect(scheduleNewStreamSpy.calledOnce).to.be.true;
  });

  it("peer:update - should not schedule stream creation IF protocol hit AND stream found on connection", async () => {
    const con1 = createMockConnection();
    con1.streams = [
      createMockStream({
        id: "1",
        protocol: MULTICODEC,
        writeStatus: "writable"
      })
    ];
    streamManager["getConnections"] = (_id) => [con1];

    const scheduleNewStreamSpy = sinon.spy();
    streamManager["scheduleNewStream"] = scheduleNewStreamSpy;

    eventTarget.dispatchEvent(
      new CustomEvent("peer:update", {
        detail: { peer: { protocols: [MULTICODEC] } }
      })
    );

    expect(scheduleNewStreamSpy.calledOnce).to.be.false;
  });
});

type MockConnectionOptions = {
  status?: string;
  open?: number;
};

function createMockConnection(options: MockConnectionOptions = {}): Connection {
  return {
    status: options.status || "open",
    timeline: {
      open: options.open || 1
    }
  } as Connection;
}

type MockStreamOptions = {
  id?: string;
  protocol?: string;
  writeStatus?: string;
};

function createMockStream(options: MockStreamOptions): Stream {
  return {
    id: options.id,
    protocol: options.protocol,
    writeStatus: options.writeStatus || "ready",
    metadata: {}
  } as Stream;
}
