/**
 * Return pseudo random subset of the input.
 */
export function getPseudoRandomSubset<T>(
  values: T[],
  wantedNumber: number
): T[] {
  if (values.length <= wantedNumber || values.length <= 1) {
    return values;
  }

  return shuffle(values).slice(0, wantedNumber);
}

export function shuffle<T>(arr: T[]): T[] {
  if (arr.length <= 1) {
    return arr;
  }
  const randInt = (): number => {
    return Math.floor(Math.random() * Math.floor(arr.length));
  };

  for (let i = 0; i < arr.length; i++) {
    const j = randInt();
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
