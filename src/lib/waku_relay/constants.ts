export const second = 1000;
export const minute = 60 * second;

/**
 * RelayCodec is the libp2p identifier for the waku relay protocol
 */
export const RelayCodec = '/vac/waku/relay/2.0.0-beta2';

/**
 * RelayDefaultTopic is the default gossipsub topic to use for waku relay
 */
export const RelayDefaultTopic = '/waku/2/default-waku/proto';

/**
 * GossipsubHeartbeatInitialDelay is the short delay before the heartbeat timer begins
 * after the router is initialized.
 */
export const RelayHeartbeatInitialDelay = 100;

/**
 * RelayHeartbeatInterval controls the time between heartbeats.
 */
export const RelayHeartbeatInterval = second;

/**
 * RelayFanoutTTL controls how long we keep track of the fanout state. If it's been
 * RelayFanoutTTL since we've published to a topic that we're not subscribed to,
 * we'll delete the fanout map for that topic.
 */
export const RelayFanoutTTL = minute;

/**
 * RelayOpportunisticGraftTicks is the number of heartbeat ticks for attempting to improve the mesh
 * with opportunistic grafting. Every RelayOpportunisticGraftTicks we will attempt to select some
 * high-scoring mesh peers to replace lower-scoring ones, if the median score of our mesh peers falls
 * below a threshold
 */
export const RelayOpportunisticGraftTicks = 60;

/**
 * RelayOpportunisticGraftPeers is the number of peers to opportunistically graft.
 */
export const RelayOpportunisticGraftPeers = 2;
