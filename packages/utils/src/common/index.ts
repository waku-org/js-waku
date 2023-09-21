export * from "./is_defined";
export * from "./random_subset";
export * from "./group_by";
export * from "./to_async_iterator";
export * from "./is_size_valid";

export function removeItemFromArray(arr: unknown[], value: unknown): unknown[] {
  const index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}
