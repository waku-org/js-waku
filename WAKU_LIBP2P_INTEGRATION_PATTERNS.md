# Waku Protocol-Specific libp2p Integration Patterns

This document analyzes how each Waku protocol integrates with libp2p, focusing on stream management, error handling, and protocol buffering patterns.

## Overview

All Waku protocols use a common `StreamManager` class for managing libp2p streams, but each protocol has different patterns for using these streams based on their communication model.

## Core Stream Management Pattern

### StreamManager Architecture

The `StreamManager` class provides a unified interface for managing libp2p streams across all protocols:

```typescript
export class StreamManager {
  private readonly streamPool: Map<string, Promise<void>> = new Map();
  private readonly ongoingCreation: Set<string> = new Set();

  public async getStream(peerId: PeerId): Promise<Stream> {
    // 1. Check for existing stream
    let stream = this.getOpenStreamForCodec(peerId);
    if (stream) {
      this.lockStream(peerIdStr, stream);
      return stream;
    }

    // 2. Create new stream if needed
    stream = await this.createStream(peerId);
    this.lockStream(peerIdStr, stream);
    return stream;
  }
}
```

**Key Features:**
- **Stream Pooling**: Reuses existing streams when possible
- **Stream Locking**: Prevents concurrent access to the same stream
- **Connection Selection**: Uses `selectOpenConnection()` to pick the best connection
- **Automatic Cleanup**: Handles peer disconnection events

## Protocol-Specific Integration Patterns

### 1. Store Protocol: Request/Response Pattern

**Multicodec**: `/vac/waku/store-query/3.0.0`

**Integration Pattern:**
```typescript
export class StoreCore {
  private readonly streamManager: StreamManager;

  public async *queryPerPage<T>(
    queryOpts: QueryRequestParams,
    decoders: Map<string, IDecoder<T>>,
    peerId: PeerId
  ): AsyncGenerator<Promise<T | undefined>[]> {
    // 1. Get managed stream
    const stream = await this.streamManager.getStream(peerId);

    // 2. Send request with length-prefixed encoding
    const res = await pipe(
      [storeQueryRequest.encode()],
      lp.encode,           // Length-prefixed encoding
      stream,              // libp2p stream
      lp.decode,           // Length-prefixed decoding
      async (source) => await all(source)
    );

    // 3. Process response
    const storeQueryResponse = StoreQueryResponse.decode(bytes);
    yield decodedMessages;
  }
}
```

**Stream Lifecycle:**
- **Creation**: On-demand when query is initiated
- **Duration**: Single request/response cycle
- **Cleanup**: Automatic via StreamManager locking mechanism
- **Error Handling**: Stream failures break pagination loop

**Protocol Buffer Integration:**
```typescript
// Request encoding
const request = StoreQueryRequest.create({
  pubsubTopic,
  contentTopics,
  timeStart: BigInt(params.timeStart.getTime() * 1_000_000),
  paginationLimit: BigInt(params.paginationLimit)
});

// Response decoding
const response = StoreQueryResponse.decode(bytes);
```

### 2. Filter Protocol: Push-Based Subscription Pattern

**Multicodecs**: 
- Subscribe: `/vac/waku/filter-subscribe/2.0.0-beta1`
- Push: `/vac/waku/filter-push/2.0.0-beta1`

**Integration Pattern:**
```typescript
export class FilterCore {
  private streamManager: StreamManager;

  constructor(handleIncomingMessage: IncomingMessageHandler, libp2p: Libp2p) {
    this.streamManager = new StreamManager(FilterCodecs.SUBSCRIBE, libp2p.components);
    
    // Register push handler for incoming messages
    libp2p.handle(FilterCodecs.PUSH, this.onRequest.bind(this), {
      maxInboundStreams: 100
    });
  }

  // Outbound: Subscribe to filter
  public async subscribe(
    pubsubTopic: PubsubTopic,
    peerId: PeerId,
    contentTopics: ContentTopic[]
  ): Promise<CoreProtocolResult> {
    const stream = await this.streamManager.getStream(peerId);
    const request = FilterSubscribeRpc.createSubscribeRequest(pubsubTopic, contentTopics);
    
    const res = await pipe(
      [request.encode()],
      lp.encode,
      stream,
      lp.decode,
      async (source) => await all(source)
    );
  }

  // Inbound: Handle pushed messages
  private onRequest(streamData: IncomingStreamData): void {
    const { connection, stream } = streamData;
    
    pipe(stream, lp.decode, async (source) => {
      for await (const bytes of source) {
        const response = FilterPushRpc.decode(bytes.slice());
        const { pubsubTopic, wakuMessage } = response;
        
        await this.handleIncomingMessage(pubsubTopic, wakuMessage, connection.remotePeer.toString());
      }
    });
  }
}
```

**Stream Lifecycle:**
- **Subscribe Stream**: Short-lived for subscription requests
- **Push Stream**: Long-lived for receiving messages
- **Duration**: Push streams remain open for continuous message delivery
- **Cleanup**: Automatic cleanup on peer disconnection

**Bidirectional Communication:**
- **Outbound**: Uses StreamManager for subscription/unsubscription requests
- **Inbound**: Handles incoming push streams via libp2p stream handler

### 3. LightPush Protocol: Request/Response with RPC Encoding

**Multicodec**: `/vac/waku/lightpush/2.0.0-beta1`

**Integration Pattern:**
```typescript
export class LightPushCore {
  private readonly streamManager: StreamManager;

  public async send(
    encoder: IEncoder,
    message: IMessage,
    peerId: PeerId
  ): Promise<CoreProtocolResult> {
    // 1. Prepare message
    const query = PushRpc.createRequest(protoMessage, encoder.pubsubTopic);
    
    // 2. Get stream
    const stream = await this.streamManager.getStream(peerId);
    
    // 3. Send with length-prefixed encoding
    const res = await pipe(
      [query.encode()],
      lp.encode,
      stream,
      lp.decode,
      async (source) => await all(source)
    );

    // 4. Process response
    const response = PushRpc.decode(bytes).response;
    return response.isSuccess ? { success: peerId } : { failure: { error, peerId } };
  }
}
```

**Stream Lifecycle:**
- **Creation**: On-demand for each send operation
- **Duration**: Single request/response cycle
- **Cleanup**: Automatic via StreamManager
- **Error Handling**: Comprehensive error classification

**Message Validation:**
```typescript
// Size validation
if (!(await isMessageSizeUnderCap(encoder, message))) {
  return { error: ProtocolError.SIZE_TOO_BIG };
}

// Payload validation
if (!message.payload || message.payload.length === 0) {
  return { error: ProtocolError.EMPTY_PAYLOAD };
}
```

## Common Stream Management Patterns

### 1. Length-Prefixed Encoding

All protocols use `it-length-prefixed` for message framing:

```typescript
// Send pattern
await pipe(
  [message.encode()],
  lp.encode,        // Add length prefix
  stream,
  lp.decode,        // Remove length prefix
  async (source) => await all(source)
);
```

**Benefits:**
- **Message Boundaries**: Clear message delimitation
- **Streaming Support**: Works with async iterators
- **Error Resilience**: Prevents message fragmentation issues

### 2. Connection Selection Strategy

```typescript
export function selectOpenConnection(connections: Connection[]): Connection | undefined {
  return connections
    .filter((c) => c.status === "open")
    .sort((left, right) => right.timeline.open - left.timeline.open)
    .at(0);
}
```

**Strategy:**
- **Status Filter**: Only use open connections
- **Recency Preference**: Prefer recently opened connections
- **Fallback**: Return undefined if no suitable connection

### 3. Stream Locking Mechanism

```typescript
private lockStream(peerId: string, stream: Stream): void {
  stream.metadata[STREAM_LOCK_KEY] = true;
}

private isStreamLocked(stream: Stream): boolean {
  return !!stream.metadata[STREAM_LOCK_KEY];
}
```

**Purpose:**
- **Concurrent Access Prevention**: Avoid stream conflicts
- **Resource Management**: Ensure proper stream lifecycle
- **Debugging**: Track stream usage patterns

## Error Handling Patterns

### 1. Stream-Level Error Handling

```typescript
// Store protocol error handling
try {
  stream = await this.streamManager.getStream(peerId);
} catch (e) {
  log.error("Failed to get stream", e);
  break; // Exit pagination loop
}
```

### 2. Protocol-Level Error Classification

```typescript
// LightPush comprehensive error handling
export enum ProtocolError {
  GENERIC_FAIL = "GENERIC_FAIL",
  NO_STREAM_AVAILABLE = "NO_STREAM_AVAILABLE",
  STREAM_ABORTED = "STREAM_ABORTED",
  DECODE_FAILED = "DECODE_FAILED",
  NO_RESPONSE = "NO_RESPONSE",
  REMOTE_PEER_REJECTED = "REMOTE_PEER_REJECTED",
  SIZE_TOO_BIG = "SIZE_TOO_BIG",
  EMPTY_PAYLOAD = "EMPTY_PAYLOAD",
  ENCODE_FAILED = "ENCODE_FAILED"
}
```

### 3. Graceful Degradation

```typescript
// Filter protocol graceful error handling
pipe(stream, lp.decode, async (source) => {
  for await (const bytes of source) {
    try {
      const response = FilterPushRpc.decode(bytes.slice());
      await this.handleIncomingMessage(pubsubTopic, wakuMessage, peerId);
    } catch (e) {
      log.error("Error decoding message", e);
      // Continue processing other messages
    }
  }
}).catch((e) => {
  log.error("Error with receiving pipe", e);
  // Handle stream-level errors
});
```

## Protocol Buffer Integration

### 1. Message Encoding/Decoding Pattern

```typescript
// Consistent encoding pattern across protocols
export class MessageRpc {
  public static decode(bytes: Uint8ArrayList): MessageRpc {
    const res = proto.MessageRpc.decode(bytes);
    return new MessageRpc(res);
  }

  public encode(): Uint8Array {
    return proto.MessageRpc.encode(this.proto);
  }
}
```

### 2. Type-Safe Protocol Buffers

```typescript
// Store protocol with proper typing
export class StoreQueryRequest {
  public constructor(public proto: proto.StoreQueryRequest) {}
  
  public static create(params: QueryRequestParams): StoreQueryRequest {
    return new StoreQueryRequest({
      ...params,
      timeStart: params.timeStart ? BigInt(params.timeStart.getTime() * 1_000_000) : undefined,
      paginationLimit: params.paginationLimit ? BigInt(params.paginationLimit) : undefined
    });
  }
}
```

### 3. Validation and Error Handling

```typescript
// Comprehensive request validation
public static create(params: QueryRequestParams): StoreQueryRequest {
  const isHashQuery = params.messageHashes && params.messageHashes.length > 0;
  const hasContentTopics = params.contentTopics && params.contentTopics.length > 0;
  
  if (isHashQuery && hasContentTopics) {
    throw new Error("Message hash queries cannot include content filters");
  }
  
  if (!isHashQuery && !params.pubsubTopic && hasContentTopics) {
    throw new Error("Both pubsubTopic and contentTopics required for content-filtered queries");
  }
}
```

## Performance Optimizations

### 1. Stream Reuse Strategy

```typescript
// StreamManager optimization
public async getStream(peerId: PeerId): Promise<Stream> {
  // Check for existing usable stream
  let stream = this.getOpenStreamForCodec(peerId);
  if (stream && !this.isStreamLocked(stream)) {
    return stream; // Reuse existing stream
  }
  
  // Create new stream only if necessary
  return await this.createStream(peerId);
}
```

### 2. Connection Pooling

```typescript
// Efficient connection selection
private getOpenStreamForCodec(peerId: PeerId): Stream | undefined {
  const connections = this.libp2p.connectionManager.getConnections(peerId);
  const connection = selectOpenConnection(connections);
  
  if (!connection) return;
  
  // Find existing stream with correct protocol
  const stream = connection.streams.find(s => s.protocol === this.multicodec);
  
  return stream && !this.isStreamUnusable(stream) ? stream : undefined;
}
```

### 3. Async Iterator Optimization

```typescript
// Efficient message streaming in Store protocol
public async *queryPerPage<T>(): AsyncGenerator<Promise<T | undefined>[]> {
  while (true) {
    const res = await pipe(
      [request.encode()],
      lp.encode,
      stream,
      lp.decode,
      async (source) => await all(source) // Collect all chunks efficiently
    );
    
    yield decodedMessages; // Yield batch of messages
    
    if (shouldStopPagination) break;
  }
}
```

## Best Practices

### 1. Stream Lifecycle Management

- **Acquire**: Use StreamManager for consistent stream acquisition
- **Lock**: Lock streams during usage to prevent conflicts
- **Release**: Automatic cleanup via metadata and event handlers
- **Monitor**: Track stream health and connection status

### 2. Error Handling

- **Classify**: Use typed error enums for better error handling
- **Propagate**: Bubble up errors with context information
- **Recover**: Implement graceful degradation where possible
- **Log**: Comprehensive logging for debugging

### 3. Protocol Buffer Usage

- **Validate**: Validate inputs before encoding
- **Type Safety**: Use TypeScript wrappers for protocol buffers
- **Efficiency**: Reuse encoder/decoder instances
- **Version**: Handle protocol version compatibility

### 4. Performance Considerations

- **Stream Reuse**: Maximize stream reuse for better performance
- **Connection Selection**: Use efficient connection selection strategies
- **Batch Processing**: Process messages in batches where possible
- **Memory Management**: Clean up resources properly

## Conclusion

The Waku protocol implementations demonstrate sophisticated libp2p integration patterns that balance performance, reliability, and maintainability. The common StreamManager provides a solid foundation while allowing each protocol to implement its specific communication patterns. The consistent use of length-prefixed encoding, comprehensive error handling, and efficient stream management makes the codebase robust and scalable.
