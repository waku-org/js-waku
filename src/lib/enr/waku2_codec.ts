import { WAKU2_FIELD_LENGTH } from "./constants";

export interface Waku2 {
  relay: boolean;
  store: boolean;
  filter: boolean;
  lightpush: boolean;
}

enum Waku2FieldPositions {
  RELAY = 0,
  STORE = 1,
  FILTER = 2,
  LIGHTPUSH = 3,
}

const protocols = ["relay", "store", "filter", "lightpush"];

export function encodeWaku2(protocols: Waku2): Uint8Array {
  const bytes = new Uint8Array(WAKU2_FIELD_LENGTH);

  for (const [key, value] of Object.entries(protocols)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const position = (<any>Waku2FieldPositions)[key.toUpperCase()];
    const valueArray = [value | 0];

    bytes.set(valueArray, position);
  }

  return bytes;
}

export function decodeWaku2(bytes: Uint8Array): Waku2 {
  const waku2: Waku2 = {
    relay: false,
    store: false,
    filter: false,
    lightpush: false,
  };

  const object: { [key: string]: boolean } = {};

  protocols.forEach((protocol, index) => {
    object[protocol] = !!bytes[index];
  });

  Object.assign(waku2, object);

  return waku2;
}
