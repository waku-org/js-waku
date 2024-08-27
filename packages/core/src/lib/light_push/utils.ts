import { ProtocolError } from "@waku/interfaces";

// should match nwaku
// https://github.com/waku-org/nwaku/blob/c3cb06ac6c03f0f382d3941ea53b330f6a8dd127/waku/waku_rln_relay/rln_relay.nim#L309
// https://github.com/waku-org/nwaku/blob/c3cb06ac6c03f0f382d3941ea53b330f6a8dd127/tests/waku_rln_relay/rln/waku_rln_relay_utils.nim#L20
const RLN_GENERATION_PREFIX_ERROR = "could not generate rln-v2 proof";

export const isRLNResponseError = (info?: string): boolean => {
  if (!info) {
    return false;
  }

  return info.includes(RLN_GENERATION_PREFIX_ERROR);
};

export const matchRLNErrorMessage = (info: string): ProtocolError => {
  const rlnErrorMap: { [key: string]: ProtocolError } = {
    [ProtocolError.RLN_IDENTITY_MISSING]: ProtocolError.RLN_IDENTITY_MISSING,
    [ProtocolError.RLN_MEMBERSHIP_INDEX]: ProtocolError.RLN_MEMBERSHIP_INDEX,
    [ProtocolError.RLN_LIMIT_MISSING]: ProtocolError.RLN_LIMIT_MISSING
  };

  const infoLowerCase = info.toLowerCase();
  for (const errorKey in rlnErrorMap) {
    if (infoLowerCase.includes(errorKey.toLowerCase())) {
      return rlnErrorMap[errorKey];
    }
  }

  return ProtocolError.RLN_PROOF_GENERATION;
};
