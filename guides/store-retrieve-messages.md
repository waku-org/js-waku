# Retrieve Messages Using Waku Store

When running a web dApp or a mobile phone application,
internet can be unreliable disconnect.

[Waku Relay](https://rfc.vac.dev/spec/18/) is a gossip protocol.
As a user, it means that your peers send you messages they just received,
and you in turn forward these messages.
If you cannot be reached by your peers, then messages are not relayed;
relay peers do not save messages for later.
However, [store](https://rfc.vac.dev/spec/13/) peers to save messages they relayed,
allowing you to retrieve messages you may have missed.

In this guide, we'll review how you can use Waku Store to retrieve messages when loading the dApp
or after resuming connectivity.
