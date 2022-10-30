export function pushOrInitMapSet<K, V>(
  map: Map<K, Set<V>>,
  key: K,
  newValue: V
): void {
  let arr = map.get(key);
  if (typeof arr === "undefined") {
    map.set(key, new Set());
    arr = map.get(key) as Set<V>;
  }

  arr.add(newValue);
}
