import * as _discovery from "./lib/discovery";
import * as _enr from "./lib/enr";
import * as _utils from "./lib/utils";
import * as _waku from "./lib/waku";
import * as _waku_light_push from "./lib/waku_light_push";
import * as _waku_message from "./lib/waku_message";
import * as _waku_relay from "./lib/waku_relay";
import * as _waku_store from "./lib/waku_store";

export { getPredefinedBootstrapNodes } from "./lib/discovery";

export const discovery = { ..._discovery };

export const enr = { ..._enr };

export const utils = { ..._utils };

export { Waku, DefaultPubSubTopic, Protocols } from "./lib/waku";
export const waku = { ..._waku };

export { WakuMessage } from "./lib/waku_message";
export const waku_message = { ..._waku_message };

export {
  generatePrivateKey,
  generateSymmetricKey,
  getPublicKey,
} from "./lib/waku_message/version_1";

export {
  WakuLightPush,
  LightPushCodec,
  PushResponse,
} from "./lib/waku_light_push";
export const waku_light_push = { ..._waku_light_push };

export { WakuRelay, RelayCodecs } from "./lib/waku_relay";
export const waku_relay = { ..._waku_relay };

export { PageDirection, WakuStore, StoreCodecs } from "./lib/waku_store";
export const waku_store = { ..._waku_store };
