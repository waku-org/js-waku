// should match nwaku
// https://github.com/waku-org/nwaku/blob/c3cb06ac6c03f0f382d3941ea53b330f6a8dd127/waku/waku_rln_relay/rln_relay.nim#L309
// https://github.com/waku-org/nwaku/blob/c3cb06ac6c03f0f382d3941ea53b330f6a8dd127/tests/waku_rln_relay/rln/waku_rln_relay_utils.nim#L20
const RLN_GENERATION_PREFIX_ERROR = "could not generate rln proof";
const RLN_MESSAGE_ID_PREFIX_ERROR =
  "could not get new message id to generate an rln proof";

// rare case on nwaku side
// https://github.com/waku-org/nwaku/blob/a4e92a3d02448fd708857b7b6cac2a7faa7eb4f9/waku/waku_lightpush/callbacks.nim#L49
// https://github.com/waku-org/nwaku/blob/a4e92a3d02448fd708857b7b6cac2a7faa7eb4f9/waku/node/waku_node.nim#L1117
const RLN_REMOTE_VALIDATION = "RLN validation failed";

export const isRLNResponseError = (info?: string): boolean => {
  if (!info) {
    return false;
  }

  return (
    info.includes(RLN_GENERATION_PREFIX_ERROR) ||
    info.includes(RLN_MESSAGE_ID_PREFIX_ERROR) ||
    info.includes(RLN_REMOTE_VALIDATION)
  );
};
