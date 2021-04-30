# Send message only knowing recipient's Ethereum Public Key

## Variables

- `A` is Alice's Ethereum root HD public key
- `B` is Bob's Ethereum root HD public key
- `a` is the private key of `A`, and is only known by Alice,
- `b` is the private key of `B`, and is only known by Bob.

## Properties

a. Alice knows Bob's Ethereum root HD public key `B`
b. Alice wants to send message `M` to Bob using waku,
c. Bob can find `M` from waku store,
d. Bob can recognize he is `M`'s recipient when relaying it via waku relay,
e. Carole cannot read `M`'s content even if she is storing it or relaying it.

### Out of scope

The solution **may not** not have the following properties:

i. Carole must not know Bob is the recipient of a message
ii. Bob must not be able to deduce Alice's Ethereum root HD public key `A`

## Solution

1. Alice derives Bob's waku public Key `Bw` from `B`,
2. Alice derives her own waku public key `Aw` from `A`,
3. Alice creates `M'` containing `M` and `Aw`,
4. Alice encrypts `M'` using `Bw`, resulting in `m'`,
5. Alice creates waku message `Mw` with `payload` `m'` and `contentTopic` `/recipient_key/1.0.0/Bw`, 
   with `Bw` in hex format (`0xAb1..`)
6. Alice publish `Mw` on default pubsub topic,
7. If Bob receives `Mw` via waku relay, he recognises `Bw` in the `contentTopic` field,
8. Otherwise, when Bob goes online he queries waku store nodes settings `contentTopics` to `["/recipient_key/1.0.0/Bw"]`, to retrieve `Mw`,
9. Bob derives `bw` from `b`,
10. Bob uses `bw` to decrypt message `Mw`, he learns `m` and `Aw`,
11. Bob replies to Alice in the same manner, setting the `contentTopic` to `["/recipient_key/1.0.0/Aw"]`

### Derivation

Public parent key (`B`) to public child key (`Bw`) derivation is only possible with non-hardened paths [\[1\]](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki).

However, this can lead to privacy concerns if we consider (ii).
At a later stage, we may consider using hardened derivation path and multiple keys.

TODO: Investigate commonly used derivation path to decide on one.

### Reply

To ascertain the fact that Alice receives Bob's reply, she could include connection details such as her peer id and multiaddress in the message.
However, this leads to privacy concerns if she does not use an anonymizing network such as tor.

Because of that, we only include `Bw`.

### Message retrieval

Regarding (c) and (d), we are using the `contentTopic` as a low-computation way (for Bob) to retrieve messages.

Using a prefix such as `/recipient_key/1.0.0` reduces possible conflicts with other use cases that would also use a key or 32 byte array.
Versioning allows an evolution of the field and its usage.

It would be helpful to attempt to formalize the `contentType` format (.e.gs `/application/data_type/version/data`).
However, when attempting to do so I realize it is not trivial.

## Specifications

Where should this application level specifications be stored? I proposed a `./docs` folder in the `js-waku` repository.
We can start the discussion here and as the spec takes shape, I will move the content of this comment to doc with a PR.

## References

- [\[1\] https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
