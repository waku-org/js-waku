import { shuffle } from 'libp2p-gossipsub/src/utils';

export { getNodesFromHostedJson } from './hosted_json';
export { parseBootstrap, BootstrapOptions, BootstrapFn } from './bootstrap';

export function getPseudoRandomSubset<T>(
  values: T[],
  wantedNumber: number
): T[] {
  if (values.length <= wantedNumber) {
    return values;
  }

  return shuffle(values).slice(0, wantedNumber);
}
