# SDS-Repair (SDS-R) Implementation Guide

## Overview
SDS-R is an optional extension to the Scalable Data Sync (SDS) protocol that enables collaborative repair of missing messages within a limited time window. It's designed to work over Waku and assumes participants are already in a secure channel.

## Core Concept
When a participant detects missing messages (via causal dependencies), it waits a random backoff period before requesting repairs. Other participants who have the missing message wait their own random backoff before responding. The protocol uses clever timing and grouping to ensure typically only one request and one response per missing message.

---

## Data Structures

### Protobuf Schema Modifications

```protobuf
message HistoryEntry {
  string message_id = 1;
  optional bytes retrieval_hint = 2;
  optional string sender_id = 3;  // NEW: Original sender's ID (only for SDS-R)
}

message Message {
  string sender_id = 1;
  string message_id = 2;
  string channel_id = 3;
  optional int32 lamport_timestamp = 10;
  repeated HistoryEntry causal_history = 11;
  optional bytes bloom_filter = 12;
  repeated HistoryEntry repair_request = 13;  // NEW: List of missing messages
  optional bytes content = 20;
}
```

### Additional Participant State

Each participant must maintain:

1. **Outgoing Repair Request Buffer**
   - Map: `HistoryEntry -> T_req (timestamp)`
   - Sorted by ascending T_req
   - Contains missing messages waiting to be requested

2. **Incoming Repair Request Buffer**
   - Map: `HistoryEntry -> T_resp (timestamp)`
   - Contains repair requests from others that this participant can fulfill
   - Only includes requests where participant is in the response group

3. **Augmented Local History**
   - Change from base SDS: Store full `Message` objects, not just message IDs
   - Only for messages where participant could be a responder
   - Needed to rebroadcast messages when responding to repairs

### Global Configuration (per channel)

```
T_min = 30 seconds        // Minimum wait before requesting repair
T_max = 120 seconds       // Maximum wait for repair window (recommend 120-600)
num_response_groups = max(1, num_participants / 128)  // Response group count
```

---

## Critical Algorithms

### 1. Calculate T_req (When to Request Repair)

**IMPORTANT BUG FIX**: The spec has an off-by-one error. Use this corrected formula:

```
T_req = current_time + hash(participant_id, message_id) % (T_max - T_min) + T_min
```

- `participant_id`: Your OWN participant ID (not the sender's)
- `message_id`: The missing message's ID
- Result: Timestamp between `current_time + T_min` and `current_time + T_max`

### 2. Calculate T_resp (When to Respond to Repair)

```
distance = participant_id XOR sender_id
T_resp = current_time + (distance * hash(message_id)) % T_max
```

- `participant_id`: Your OWN participant ID
- `sender_id`: Original sender's ID from the HistoryEntry
- `message_id`: The requested message's ID
- Note: Original sender has distance=0, responds immediately

### 3. Determine Response Group Membership

```
is_in_group = (hash(participant_id, message_id) % num_response_groups) == 
              (hash(sender_id, message_id) % num_response_groups)
```

- Only respond to repairs if `is_in_group` is true
- Original sender is always in their own response group

---

## Protocol Implementation Steps

### When SENDING a Message

1. Check outgoing repair request buffer for eligible entries (where `T_req <= current_time`)
2. Take up to 3 eligible entries with lowest T_req values
3. Populate `repair_request` field with these HistoryEntries:
   - Include `message_id`
   - Include `retrieval_hint` if available
   - Include `sender_id` (original sender's ID)
4. If no eligible entries, leave `repair_request` field unset
5. Continue with normal SDS send procedure

### When RECEIVING a Message

1. **Clean up buffers:**
   - Remove received message_id from outgoing repair request buffer
   - Remove received message_id from incoming repair request buffer

2. **Process causal dependencies:**
   - For each missing dependency in causal_history:
     - Add to outgoing repair request buffer
     - Calculate T_req using formula above
     - Include sender_id from the causal history entry

3. **Process repair_request field:**
   - For each repair request entry:
     a. Remove from your own outgoing buffer (someone else is requesting it)
     b. Check if you have this message in local history
     c. Check if you're in the response group (use formula above)
     d. If both b and c are true:
        - Add to incoming repair request buffer
        - Calculate T_resp using formula above

4. Continue with normal SDS receive procedure

### Periodic Sweeps

#### Outgoing Repair Request Buffer Sweep (every ~5 seconds)
```python
for entry, t_req in outgoing_buffer:
    if current_time >= t_req:
        # This entry will be included in next message's repair_request
        # No action needed here, just wait for next send
        pass
```

#### Incoming Repair Request Buffer Sweep (every ~5 seconds)
```python
for entry, t_resp in incoming_buffer:
    if current_time >= t_resp:
        message = get_from_local_history(entry.message_id)
        if message:
            broadcast(message)  # Rebroadcast the full original message
            remove_from_incoming_buffer(entry)
```

### Periodic Sync Messages with SDS-R

When sending periodic sync messages:
1. Check if there are eligible entries in outgoing repair request buffer
2. If yes, send the sync message WITH repair_request field populated
3. Unlike base SDS, don't suppress sync message even if others recently sent one

---

## Implementation Notes and Edge Cases

### Hash Function
**CRITICAL**: The spec doesn't specify which hash function to use. Recommend:
- Use SHA256 for cryptographic properties
- Convert to integer for modulo operations: `int(hash_bytes[:8], byteorder='big')`
- Must be consistent across all participants

### Participant ID Format
- Must support XOR operation for distance calculation
- Recommend using numeric IDs or convert string IDs to integers
- Must be globally unique within the channel

### Memory Management
1. **Buffer limits**: Implement max size for repair buffers (suggest 1000 entries)
2. **Eviction policy**: Remove oldest T_req/T_resp when at capacity
3. **History retention**: Only keep messages for T_max duration
4. **Response group optimization**: Only cache full messages if you're likely to be in response group

### Edge Cases to Handle

1. **Duplicate repair requests**: Use Set semantics, only track once
2. **Expired repairs**: If T_req > current_time + T_max, remove from buffer
3. **Non-numeric participant IDs**: Hash to integer for XOR operations
4. **Missing sender_id**: Cannot participate in repair for that message
5. **Circular dependencies**: Set maximum recursion depth for dependency resolution

### Typo to Fix
The spec has "Perdiodic" on line 461 - should be "Periodic"

---

## Testing Scenarios

1. **Single missing message**: Verify only one repair request and response
2. **Cascade recovery**: Missing message A depends on missing message B
3. **Original sender offline**: Verify next closest participant responds
4. **Response group isolation**: Verify only in-group participants respond
5. **Buffer overflow**: Test eviction policies
6. **Network partition**: Test behavior when repair window expires

---

## Integration with Base SDS

### Modified State from Base SDS
- Local history stores full Messages, not just IDs
- Additional buffers for repair tracking
- Sender_id must be preserved in HistoryEntry

### Unchanged from Base SDS
- Lamport timestamp management
- Bloom filter operations
- Causal dependency checking
- Message delivery and conflict resolution

---

## Performance Recommendations

1. Use priority queues for T_req/T_resp ordered buffers
2. Index local history by message_id for O(1) lookup
3. Batch repair requests in single message (up to 3)
4. Cache response group calculation results
5. Implement exponential backoff in future version (noted as TODO in spec)

---

## Security Assumptions

- Operating within secure channel (via Waku)
- All participants are authenticated
- Rate limiting via Waku RLN-RELAY
- No additional authentication needed for repairs
- Trust all repair requests from channel members

This implementation guide should be sufficient to implement SDS-R without access to the original specification. The key insight is that SDS-R elegantly uses timing and randomization to coordinate distributed repair without central coordination or excessive network traffic.