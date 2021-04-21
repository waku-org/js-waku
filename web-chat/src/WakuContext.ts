import { createContext, useContext } from 'react';
import Waku from 'waku/waku';

export type WakuContextType = {
  waku?: Waku;
};

export const WakuContext = createContext<WakuContextType>({ waku: undefined });
export const useWaku = () => useContext(WakuContext);
