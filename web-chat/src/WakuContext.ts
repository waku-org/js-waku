import { createContext, useContext } from 'react';
import WakuMock from './WakuMock';

export type WakuContextType = {
  waku?: WakuMock;
  // setWaku: (waku: WakuMock) => void;
}

export const WakuContext = createContext<WakuContextType>({ waku: undefined });
export const useWaku = () => useContext(WakuContext);
