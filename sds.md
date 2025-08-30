---
title: SDS
name: Scalable Data Sync protocol for distributed logs
status: raw
editor: Hanno Cornelius <hanno@status.im>
contributors:
  - Akhil Peddireddy <akhil@status.im>
---

## Abstract

This specification introduces the Scalable Data Sync (SDS) protocol
to achieve end-to-end reliability
when consolidating distributed logs in a decentralized manner.
The protocol is designed for a peer-to-peer (p2p) topology
where an append-only log is maintained by each member of a group of nodes
who may individually append new entries to their local log at any time and
is interested in merging new entries from other nodes in real-time or close to real-time
while maintaining a consistent order.
The outcome of the log consolidation procedure is
that all nodes in the group eventually reflect in their own logs
the same entries in the same order.
The protocol aims to scale to very large groups.

## Motivation

A common application that fits this model is a p2p group chat (or group communication),
where the participants act as log nodes
and the group conversation is modelled as the consolidated logs
maintained on each node.
The problem of end-to-end reliability can then be stated as
ensuring that all participants eventually see the same sequence of messages
in the same causal order,
despite the challenges of network latency, message loss,
and scalability present in any communications transport layer.
The rest of this document will assume the terminology of a group communication:
log nodes being the _participants_ in the group chat
and the logged entries being the _messages_ exchanged between participants.

## Design Assumptions

We make the following simplifying assumptions for a proposed reliability protocol:

* **Broadcast routing:**
Messages are broadcast disseminated by the underlying transport.
The selected transport takes care of routing messages
to all participants of the communication.
* **Store nodes:**
There are high-availability caches (a.k.a. Store nodes)
from which missed messages can be retrieved.
These caches maintain the full history of all messages that have been broadcast.
This is an optional element in the protocol design,
but improves scalability by reducing direct interactions between participants.
* **Message ID:**
Each message has a globally unique, immutable ID (or hash).
Messages can be requested from the high-availability caches or
other participants using the corresponding message ID.
* **Participant ID:**
Each participant has a globally unique, immutable ID
visible to other participants in the communication.

## Wire protocol

The keywords “MUST”, “MUST NOT”, “REQUIRED”, “SHALL”, “SHALL NOT”, “SHOULD”,
“SHOULD NOT”, “RECOMMENDED”, “MAY”, and
 “OPTIONAL” in this document are to be interpreted as described in [2119](https://www.ietf.org/rfc/rfc2119.txt).

### Message

Messages MUST adhere to the following meta structure:

```protobuf
syntax = "proto3";

message HistoryEntry {
  string message_id = 1; // Unique identifier of the SDS message, as defined in `Message`
  optional bytes retrieval_hint = 2; // Optional information to help remote parties retrieve this SDS message; For example, A Waku deterministic message hash or routing payload hash
}

message Message {
  string sender_id = 1;           // Participant ID of the message sender
  string message_id = 2;          // Unique identifier of the message
  string channel_id = 3;          // Identifier of the channel to which the message belongs
  optional int32 lamport_timestamp = 10;    // Logical timestamp for causal ordering in channel
  repeated HistoryEntry causal_history = 11;  // List of preceding message IDs that this message causally depends on. Generally 2 or 3 message IDs are included.
  optional bytes bloom_filter = 12;         // Bloom filter representing received message IDs in channel
  optional bytes content = 20;             // Actual content of the message
}
```

The sending participant MUST include its own globally unique identifier in the `sender_id` field.
In addition, it MUST include a globally unique identifier for the message in the `message_id` field,
likely based on a message hash.
The `channel_id` field MUST be set to the identifier of the channel of group communication
that is being synchronized.
For simple group communications without individual channels,
the `channel_id` SHOULD be set to `0`.
The `lamport_timestamp`, `causal_history` and
`bloom_filter` fields MUST be set according to the [protocol steps](#protocol-steps)
set out below.
These fields MAY be left unset in the case of [ephemeral messages](#ephemeral-messages).
The message `content` MAY be left empty for [periodic sync messages](#periodic-sync-message),
otherwise it MUST contain the application-level content

> **_Note:_** Close readers may notice that, outside of filtering messages originating from the sender itself,
the `sender_id` field is not used for much.
Its importance is expected to increase once a p2p retrieval mechanism is added to SDS, as is planned for the protocol.

### Participant state

Each participant MUST maintain:

* A Lamport timestamp for each channel of communication,
initialized to current epoch time in nanosecond resolution.
* A bloom filter for received message IDs per channel.
The bloom filter SHOULD be rolled over and
recomputed once it reaches a predefined capacity of message IDs.
Furthermore,
it SHOULD be designed to minimize false positives through an optimal selection of
size and hash functions.
* A buffer for unacknowledged outgoing messages
* A buffer for incoming messages with unmet causal dependencies
* A local log (or history) for each channel,
containing all message IDs in the communication channel,
ordered by Lamport timestamp.

Messages in the unacknowledged outgoing buffer can be in one of three states:

1. **Unacknowledged** - there has been no acknowledgement of message receipt
by any participant in the channel
2. **Possibly acknowledged** - there has been ambiguous indication that the message
has been _possibly_ received by at least one participant in the channel
3. **Acknowledged** - there has been sufficient indication that the message
has been received by at least some of the participants in the channel.
This state will also remove the message from the outgoing buffer.

### Protocol Steps

For each channel of communication,
participants MUST follow these protocol steps to populate and interpret
the `lamport_timestamp`, `causal_history` and `bloom_filter` fields.

#### Send Message

Before broadcasting a message:

* the participant MUST increase its local Lamport timestamp by `1` and
include this in the `lamport_timestamp` field.
* the participant MUST determine the preceding few message IDs in the local history
and include these in an ordered list in the `causal_history` field.
The number of message IDs to include in the `causal_history` depends on the application.
We recommend a causal history of two message IDs.
* the participant MAY include a `retrieval_hint` in the `HistoryEntry`
for each message ID in the `causal_history` field.
This is an application-specific field to facilitate retrieval of messages,
e.g. from high-availability caches.
* the participant MUST include the current `bloom_filter`
state in the broadcast message.

After broadcasting a message,
the message MUST be added to the participant’s buffer
of unacknowledged outgoing messages.

#### Receive Message

Upon receiving a message,

* the participant SHOULD ignore the message if it has a `sender_id` matching its own.
* the participant MAY deduplicate the message by comparing its `message_id` to previously received message IDs.
* the participant MUST [review the ACK status](#review-ack-status) of messages
in its unacknowledged outgoing buffer
using the received message's causal history and bloom filter.
* if the message has a populated `content` field,
the participant MUST include the received message ID in its local bloom filter.
* the participant MUST verify that all causal dependencies are met
for the received message.
Dependencies are met if the message IDs in the `causal_history` of the received message
appear in the local history of the receiving participant.

If all dependencies are met and the message has a populated `content` field,
the participant MUST [deliver the message](#deliver-message).
If dependencies are unmet,
the participant MUST add the message to the incoming buffer of messages
with unmet causal dependencies.

#### Deliver Message

Triggered by the [Receive Message](#receive-message) procedure.

If the received message’s Lamport timestamp is greater than the participant's
local Lamport timestamp,
the participant MUST update its local Lamport timestamp to match the received message.
The participant MUST insert the message ID into its local log,
based on Lamport timestamp.
If one or more message IDs with the same Lamport timestamp already exists,
the participant MUST follow the [Resolve Conflicts](#resolve-conflicts) procedure.

#### Resolve Conflicts

Triggered by the [Deliver Message](#deliver-message) procedure.

The participant MUST order messages with the same Lamport timestamp
in ascending order of message ID.
If the message ID is implemented as a hash of the message,
this means the message with the lowest hash would precede
other messages with the same Lamport timestamp in the local log.

#### Review ACK Status

Triggered by the [Receive Message](#receive-message) procedure.

For each message in the unacknowledged outgoing buffer,
based on the received `bloom_filter` and `causal_history`:

* the participant MUST mark all messages in the received `causal_history` as **acknowledged**.
* the participant MUST mark all messages included in the `bloom_filter`
as **possibly acknowledged**.
If a message appears as **possibly acknowledged** in multiple received bloom filters,
the participant MAY mark it as acknowledged based on probabilistic grounds,
taking into account the bloom filter size and hash number.

#### Periodic Incoming Buffer Sweep

The participant MUST periodically check causal dependencies for each message
in the incoming buffer.
For each message in the incoming buffer:

* the participant MAY attempt to retrieve missing dependencies from the Store node
(high-availability cache) or other peers.
It MAY use the application-specific `retrieval_hint` in the `HistoryEntry` to facilitate retrieval.
* if all dependencies of a message are met,
the participant MUST proceed to [deliver the message](#deliver-message).

If a message's causal dependencies have failed to be met
after a predetermined amount of time,
the participant MAY mark them as **irretrievably lost**.

#### Periodic Outgoing Buffer Sweep

The participant MUST rebroadcast **unacknowledged** outgoing messages
after a set period.
The participant SHOULD use distinct resend periods for **unacknowledged** and
**possibly acknowledged** messages,
prioritizing **unacknowledged** messages.

#### Periodic Sync Message

For each channel of communication,
participants SHOULD periodically send sync messages to maintain state.
These sync messages:

* MUST be sent with empty content
* MUST include an incremented Lamport timestamp
* MUST include causal history and bloom filter according to regular message rules
* MUST NOT be added to the unacknowledged outgoing buffer
* MUST NOT be included in causal histories of subsequent messages
* MUST NOT be included in bloom filters
* MUST NOT be added to the local log

Since sync messages are not persisted,
they MAY have non-unique message IDs without impacting the protocol.
To avoid network activity bursts in large groups,
a participant MAY choose to only send periodic sync messages
if no other messages have been broadcast in the channel after a random backoff period.

Participants MUST process the causal history and bloom filter of these sync messages
following the same steps as regular messages,
but MUST NOT persist the sync messages themselves.

#### Ephemeral Messages

Participants MAY choose to send short-lived messages for which no synchronization
or reliability is required.
These messages are termed _ephemeral_.

Ephemeral messages SHOULD be sent with `lamport_timestamp`, `causal_history`, and
`bloom_filter` unset.
Ephemeral messages SHOULD NOT be added to the unacknowledged outgoing buffer
after broadcast.
Upon reception,
ephemeral messages SHOULD be delivered immediately without buffering for causal dependencies
or including in the local log.

## Implementation Suggestions

This section provides practical guidance based on the js-waku implementation of SDS.

### Default Configuration Values

The js-waku implementation uses the following defaults:
- **Bloom filter capacity**: 10,000 messages
- **Bloom filter error rate**: 0.001 (0.1% false positive rate)
- **Causal history size**: 200 message IDs
- **Possible ACKs threshold**: 2 bloom filter hits before considering a message acknowledged

With 200 messages in causal history, assuming 32-byte message IDs and 32-byte retrieval hints (e.g., Waku message hashes),
each message carries 200 × 64 bytes = 12.8 KB of causal history overhead.

### External Task Scheduling

The js-waku implementation delegates periodic task scheduling to the library consumer by providing methods:

- `processTasks()`: Process queued send/receive operations
- `sweepIncomingBuffer()`: Check and deliver messages with met dependencies, returns missing dependencies
- `sweepOutgoingBuffer()`: Return unacknowledged and possibly acknowledged messages for retry
- `pushOutgoingSyncMessage(callback)`: Send a sync message

The implementation does not include internal timers,
allowing applications to integrate SDS with their existing scheduling infrastructure.

### Message Processing

#### Handling Missing Dependencies

When `sweepIncomingBuffer()` returns missing dependencies,
the implementation emits an `InMessageMissing` event with `HistoryEntry[]` containing:
- `messageId`: The missing message identifier
- `retrievalHint`: Optional bytes to help retrieve the message (e.g., transport-specific hash)

#### Timeout for Lost Messages

The `timeoutForLostMessagesMs` option allows marking messages as irretrievably lost after a timeout.
When configured, the implementation emits an `InMessageLost` event after the timeout expires.

### Events Emitted

The js-waku implementation uses a `TypedEventEmitter` pattern to emit events for:
- **Incoming messages**: received, delivered, missing dependencies, lost (after timeout)
- **Outgoing messages**: sent, acknowledged, possibly acknowledged
- **Sync messages**: sent, received
- **Errors**: task execution failures

### SDK Usage: ReliableChannel

The SDK provides a high-level `ReliableChannel` abstraction that wraps the core SDS `MessageChannel` with automatic task scheduling and Waku protocol integration:

#### Configuration

The ReliableChannel uses these default intervals:
- **Sync message interval**: 30 seconds minimum between sync messages (randomized backoff)
- **Retry interval**: 30 seconds for unacknowledged messages
- **Max retry attempts**: 10 attempts before giving up
- **Store query interval**: 10 seconds for missing message retrieval

#### Task Scheduling Implementation

The SDK automatically schedules SDS periodic tasks:
- **Sync messages**: Uses exponential backoff with randomization; sent faster (0.5x multiplier) after receiving content to acknowledge others
- **Outgoing buffer sweeps**: Triggered after each retry interval for unacknowledged messages  
- **Incoming buffer sweeps**: Performed after each incoming message and during missing message retrieval
- **Process tasks**: Called immediately after sending/receiving messages and during sync

#### Integration with Waku Protocols

ReliableChannel integrates SDS with Waku:
- **Sending**: Uses LightPush or Relay protocols; includes Waku message hash as retrieval hint (32 bytes)
- **Receiving**: Subscribes via Filter protocol; unwraps SDS messages before passing to application
- **Missing message retrieval**: Queries Store nodes using retrieval hints from causal history
- **Query on connect**: Automatically queries Store when connecting to new peers (enabled by default)

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
