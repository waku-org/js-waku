export * from "./is_defined.js";
export * from "./random_subset.js";
export * from "./group_by.js";
export * from "./to_async_iterator.js";
export * from "./is_size_valid.js";
export * from "./sharding.js";

export function removeItemFromArray(arr: unknown[], value: unknown): unknown[] {
  const index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}
