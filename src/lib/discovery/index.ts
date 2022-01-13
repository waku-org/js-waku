import { shuffle } from 'libp2p-gossipsub/src/utils';

export { getNodesFromHostedJson } from './hosted_json';
export { parseBootstrap } from './bootstrap';

export function getPseudoRandomSubset(
  values: string[],
  wantedNumber: number
): string[] {
  if (values.length <= wantedNumber) {
    return values;
  }

  return shuffle(values).slice(0, wantedNumber);
}
