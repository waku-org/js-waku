// Custom and aliased types for ENRs

/**
 * We represent NodeId as a hex string, since node equality is used very heavily
 * and it is convenient to index data by NodeId
 */
export type NodeId = string;
export type SequenceNumber = bigint;

export type ENRKey = string;
export type ENRValue = Uint8Array;
