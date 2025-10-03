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
* **Sender ID:**
The *Participant ID* of the original sender of a message,
often coupled with a *Message ID*.

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

  optional string sender_id = 3; // Participant ID of original message sender. Only populated if using optional SDS Repair extension
}

message Message {
  string sender_id = 1;           // Participant ID of the message sender
  string message_id = 2;          // Unique identifier of the message
  string channel_id = 3;          // Identifier of the channel to which the message belongs
  optional uint64 lamport_timestamp = 10;    // Logical timestamp for causal ordering in channel
  repeated HistoryEntry causal_history = 11;  // List of preceding message IDs that this message causally depends on. Generally 2 or 3 message IDs are included.
  optional bytes bloom_filter = 12;         // Bloom filter representing received message IDs in channel

  repeated HistoryEntry repair_request = 13; // Capped list of history entries missing from sender's causal history. Only populated if using the optional SDS Repair extension.

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
initialized to current epoch time in millisecond resolution.
The Lamport timestamp is increased as described in the [protocol steps](#protocol-steps)
to maintain a logical ordering of events while staying close to the current epoch time.
This allows the messages from new joiners to be correctly ordered with other recent messages,
without these new participants first having to synchronize past messages to discover the current Lamport timestamp.
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

* the participant MUST set its local Lamport timestamp
to the maximum between the current value + `1`
and the current epoch time in milliseconds.
In other words the local Lamport timestamp is set to `max(timeNowInMs, current_lamport_timestamp + 1)`.
* the participant MUST include the increased Lamport timestamp in the message's `lamport_timestamp` field.
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
* MUST include a Lamport timestamp increased to `max(timeNowInMs, current_lamport_timestamp + 1)`,
where `timeNowInMs` is the current epoch time in milliseconds.
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

### SDS Repair (SDS-R)

SDS Repair (SDS-R) is an optional extension module for SDS,
allowing participants in a communication to collectively repair any gaps in causal history (missing messages)
preferably over a limited time window.
Since SDS-R acts as coordinated rebroadcasting of missing messages,
which involves all participants of the communication,
it is most appropriate in a limited use case for repairing relatively recent missed dependencies.
It is not meant to replace mechanisms for long-term consistency,
such as peer-to-peer syncing or the use of a high-availability centralised cache (Store node).

#### SDS-R message fields

SDS-R adds the following fields to SDS messages:
* `sender_id` in `HistoryEntry`:
the original message sender's participant ID.
This is used to determine the group of participants who will respond to a repair request.
* `repair_request` in `Message`:
a capped list of history entries missing for the message sender
and for which it's requesting a repair.

#### SDS-R participant state

SDS-R adds the following to each participant state:

* Outgoing **repair request buffer**:
a list of locally missing `HistoryEntry`s 
each mapped to a future request timestamp, `T_req`,
after which this participant will request a repair if at that point the missing dependency has not been repaired yet.
`T_req` is computed as a pseudorandom backoff from the timestamp when the dependency was detected missing.
[Determining `T_req`](#determine-t_req) is described below.
We RECOMMEND that the outgoing repair request buffer be chronologically ordered in ascending order of `T_req`.
- Incoming **repair request buffer**:
a list of locally available `HistoryEntry`s
that were requested for repair by a remote participant
AND for which this participant might be an eligible responder,
each mapped to a future response timestamp, `T_resp`,
after which this participant will rebroadcast the corresponding requested `Message` if at that point no other participant had rebroadcast the `Message`.
`T_resp` is computed as a pseudorandom backoff from the timestamp when the repair was first requested.
[Determining `T_resp`](#determine-t_resp) is described below.
We describe below how a participant can [determine if they're an eligible responder](#determine-response-group) for a specific repair request.
- Augmented local history log:
for each message ID kept in the local log for which the participant could be a repair responder,
the full SDS `Message` must be cached rather than just the message ID,
in case this participant is called upon to rebroadcast the message.
We describe below how a participant can [determine if they're an eligible responder](#determine-response-group) for a specific message.

**_Note:_** The required state can likely be significantly reduced in future by simply requiring that a responding participant should _reconstruct_ the original `Message` when rebroadcasting, rather than the simpler, but heavier, requirement of caching the entire received `Message` content in local history.

#### SDS-R global state

For a specific channel (that is, within a specific SDS-controlled communication)
the following SDS-R configuration state SHOULD be common for all participants in the conversation:

* `T_min`: the _minimum_ time period to wait before a missing causal entry can be repaired.
We RECOMMEND a value of at least 30 seconds.
* `T_max`: the _maximum_ time period over which missing causal entries can be repaired.
We RECOMMEND a value of between 120 and 600 seconds.

Furthermore, to avoid a broadcast storm with multiple participants responding to a repair request,
participants in a single channel MAY be divided into discrete response groups.
Participants will only respond to a repair request if they are in the response group for that request.
The global `num_response_groups` variable configures the number of response groups for this communication.
Its use is described below.
A reasonable default value for `num_response_groups` is one response group for every `128` participants.
In other words, if the (roughly) expected number of participants is expressed as `num_participants`, then
`num_response_groups = num_participants div 128 + 1`.
In other words, if there are fewer than 128 participants in a communication,
they will all belong to the same response group.

We RECOMMEND that the global state variables `T_min`, `T_max` and `num_response_groups` be set _statically_ for a specific SDS-R application,
based on expected number of group participants and volume of traffic.

**_Note:_** Future versions of this protocol will recommend dynamic global SDS-R variables, based on the current number of participants.

#### SDS-R send message

SDS-R adds the following steps when sending a message:

Before broadcasting a message,
* the participant SHOULD populate the `repair_request` field in the message
with _eligible_ entries from the outgoing repair request buffer.
An entry is eligible to be included in a `repair_request`
if its corresponding request timestamp, `T_req`, has expired (in other words, `T_req <= current_time`).
The maximum number of repair request entries to include is up to the application.
We RECOMMEND that this quota be filled by the eligible entries from the outgoing repair request buffer with the lowest `T_req`.
We RECOMMEND a maximum of 3 entries.
If there are no eligible entries in the buffer, this optional field MUST be left unset.

#### SDS-R receive message

On receiving a message,
* the participant MUST remove entries matching the received message ID from its _outgoing_ repair request buffer.
This ensures that the participant does not request repairs for dependencies that have now been met.
* the participant MUST remove entries matching the received message ID from its _incoming_ repair request buffer.
This ensures that the participant does not respond to repair requests that another participant has already responded to.
* the participant SHOULD check for any unmet causal dependencies that do not yet have a corresponding entry in its outgoing repair request buffer.
For each such dependency, the participant SHOULD add a new entry against a unique `T_req` timestamp.
It MUST compute the `T_req` for each such HistoryEntry according to the steps outlined in [_Determine T_req_](#determine-t_req).
* for each item in the `repair_request` field:
  - the participant MUST remove entries matching the repair message ID from its own outgoing repair request buffer.
  This limits the number of participants that will request a common missing dependency.
  - if the participant has the requested `Message` in its local history _and_ is an eligible responder for the repair request,
  it SHOULD add the request to its incoming repair request buffer against a unique `T_resp` timestamp for that entry.
  It MUST compute the `T_resp` for each such repair request according to the steps outlined in [_Determine T_resp_](#determine-t_resp).
  It MUST determine if it's an eligible responder for a repair request according to the steps outlined in [_Determine response group_](#determine-response-group).

#### Determine T_req

A participant determines the repair request timestamp, `T_req`,
for a missing `HistoryEntry` as follows:

```
T_req = current_time + hash(participant_id, message_id) % (T_max - T_min) + T_min
```

where `current_time` is the current timestamp,
`participant_id` is the participant's _own_ participant ID (not the `sender_id` in the missing `HistoryEntry`),
`message_id` is the missing `HistoryEntry`'s message ID,
and `T_min` and `T_max` are as set out in [SDS-R global state](#sds-r-global-state).

This allows `T_req` to be pseudorandomly and linearly distributed as a backoff of between `T_min` and `T_max` from current time.

> **_Note:_** placing `T_req` values on an exponential backoff curve will likely be more appropriate and is left for a future improvement.

#### Determine T_resp

A participant determines the repair response timestamp, `T_resp`,
for a `HistoryEntry` that it could repair as follows:

```
distance = hash(participant_id) XOR hash(sender_id)
T_resp = current_time + distance*hash(message_id) % T_max
```

where `current_time` is the current timestamp,
`participant_id` is the participant's _own_ (local) participant ID,
`sender_id` is the requested `HistoryEntry` sender ID,
`message_id` is the requested `HistoryEntry` message ID,
and `T_max` is as set out in [SDS-R global state](#sds-r-global-state).

We first calculate the logical `distance` between the local `participant_id` and the original `sender_id`.
If this participant is the original sender, the `distance` will be `0`.
It should then be clear that the original participant will have a response backoff time of `0`, making it the most likely responder.
The `T_resp` values for other eligible participants will be pseudorandomly and linearly distributed as a backoff of up to `T_max` from current time.

> **_Note:_** placing `T_resp` values on an exponential backoff curve will likely be more appropriate and is left for a future improvement.

#### Determine response group

Given a message with `sender_id` and `message_id`,
a participant with `participant_id` is in the response group for that message if

```
hash(participant_id, message_id) % num_response_groups == hash(sender_id, message_id) % num_response_groups
```

where `num_response_groups` is as set out in [SDS-R global state](#sds-r-global-state).
This ensures that a participant will always be in the response group for its own published messages.
It also allows participants to determine immediately on first reception of a message or a history entry
if they are in the associated response group.

#### SDS-R incoming repair request buffer sweep

An SDS-R participant MUST periodically check if there are any incoming requests in the *incoming repair request buffer* that is due for a response.
For each item in the buffer,
the participant SHOULD broadcast the corresponding `Message` from local history
if its corresponding response timestamp, `T_resp`, has expired (in other words, `T_resp <= current_time`).

#### SDS-R Periodic Sync Message

If the participant is due to send a periodic sync message,
it SHOULD send the message according to [SDS-R send message](#sds-r-send-message)
if there are any eligible items in the outgoing repair request buffer,
regardless of whether other participants have also recently broadcast a Periodic Sync message.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
