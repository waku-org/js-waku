type SortedArrayInterface<T> = Omit<Array<T>, "reverse" | "sort">;

/**
 * Base class that implements a sorted array interface.
 * Automatically maintains sort order after any mutating operation.
 */
export abstract class SortedArrayBase<T> implements SortedArrayInterface<T> {
  protected readonly items: Array<T>;
  private previousLength = 0;

  public constructor() {
    this.items = [];
    this.updateIndexedProperties();
  }

  [n: number]: T;

  public get length(): number {
    return this.items.length;
  }

  private updateIndexedProperties(): void {
    // Remove old properties
    for (let i = this.items.length; i < this.previousLength; i++) {
      delete (this as any)[i];
    }

    // Add/update current properties
    for (let i = 0; i < this.items.length; i++) {
      (this as any)[i] = this.items[i];
    }

    this.previousLength = this.items.length;
  }

  public toString(): string {
    return this.items.toString();
  }

  public toLocaleString(): string {
    return this.items.toLocaleString();
  }

  public pop(): T | undefined {
    const result = this.items.pop();
    this.updateIndexedProperties();
    return result;
  }

  public push(...items: T[]): number {
    // Filter out duplicates both from existing items and within the new items
    const uniqueItems: T[] = [];
    for (const item of items) {
      if (!this.items.includes(item) && !uniqueItems.includes(item)) {
        uniqueItems.push(item);
      }
    }
    this.items.push(...uniqueItems);
    this.sort();
    this.updateIndexedProperties();
    return this.items.length;
  }

  public concat(...items: ConcatArray<T>[]): T[];
  public concat(...items: (T | ConcatArray<T>)[]): T[];
  public concat(...items: (T | ConcatArray<T>)[]): T[] {
    const result = this.items.concat(...items);
    return this.sortArray(result);
  }

  public join(separator?: string): string {
    return this.items.join(separator);
  }

  public shift(): T | undefined {
    const result = this.items.shift();
    this.updateIndexedProperties();
    return result;
  }

  public slice(start?: number, end?: number): T[] {
    return this.items.slice(start, end);
  }

  public splice(start: number, deleteCount?: number, ...items: T[]): T[] {
    // First perform the deletion
    const result = this.items.splice(start, deleteCount || 0);

    // Then add unique items
    const uniqueItems: T[] = [];
    for (const item of items) {
      if (!this.items.includes(item) && !uniqueItems.includes(item)) {
        uniqueItems.push(item);
      }
    }
    this.items.push(...uniqueItems);
    this.sort();
    this.updateIndexedProperties();
    return result;
  }

  public unshift(...items: T[]): number {
    // Filter out duplicates both from existing items and within the new items
    const uniqueItems: T[] = [];
    for (const item of items) {
      if (!this.items.includes(item) && !uniqueItems.includes(item)) {
        uniqueItems.push(item);
      }
    }
    this.items.unshift(...uniqueItems);
    this.sort();
    this.updateIndexedProperties();
    return this.items.length;
  }

  public indexOf(searchElement: T, fromIndex?: number): number {
    if (fromIndex === undefined) {
      return this.items.indexOf(searchElement);
    }
    return this.items.indexOf(searchElement, fromIndex);
  }

  public lastIndexOf(searchElement: T, fromIndex?: number): number {
    if (fromIndex === undefined) {
      return this.items.lastIndexOf(searchElement);
    }
    return this.items.lastIndexOf(searchElement, fromIndex);
  }

  public every<S extends T>(
    predicate: (value: T, index: number, array: T[]) => value is S,
    thisArg?: any
  ): this is S[];
  public every(
    predicate: (value: T, index: number, array: T[]) => unknown,
    thisArg?: any
  ): boolean {
    return this.items.every(predicate, thisArg);
  }

  public some(
    predicate: (value: T, index: number, array: T[]) => unknown,
    thisArg?: any
  ): boolean {
    return this.items.some(predicate, thisArg);
  }

  public forEach(
    callbackfn: (value: T, index: number, array: T[]) => void,
    thisArg?: any
  ): void {
    this.items.forEach(callbackfn, thisArg);
  }

  public map<U>(
    callbackfn: (value: T, index: number, array: T[]) => U,
    thisArg?: any
  ): U[] {
    return this.items.map(callbackfn, thisArg);
  }

  public filter<S extends T>(
    predicate: (value: T, index: number, array: T[]) => value is S,
    thisArg?: any
  ): S[];
  public filter(
    predicate: (value: T, index: number, array: T[]) => unknown,
    thisArg?: any
  ): T[] {
    return this.items.filter(predicate, thisArg);
  }

  public reduce<U>(
    callbackfn: (
      previousValue: U,
      currentValue: T,
      currentIndex: number,
      array: T[]
    ) => U,
    initialValue?: U
  ): U {
    if (arguments.length >= 2) {
      return this.items.reduce(callbackfn, initialValue!);
    } else {
      return this.items.reduce(callbackfn as any) as unknown as U;
    }
  }

  public reduceRight<U>(
    callbackfn: (
      previousValue: U,
      currentValue: T,
      currentIndex: number,
      array: T[]
    ) => U,
    initialValue?: U
  ): U {
    if (arguments.length >= 2) {
      return this.items.reduceRight(callbackfn, initialValue!);
    } else {
      return this.items.reduceRight(callbackfn as any) as unknown as U;
    }
  }

  public find<S extends T>(
    predicate: (this: void, value: T, index: number, obj: T[]) => value is S,
    thisArg?: any
  ): S | undefined;
  public find(
    predicate: (value: T, index: number, obj: T[]) => unknown,
    thisArg?: any
  ): T | undefined {
    return this.items.find(predicate, thisArg);
  }

  public findIndex(
    predicate: (value: T, index: number, obj: T[]) => unknown,
    thisArg?: any
  ): number {
    return this.items.findIndex(predicate, thisArg);
  }

  public fill(value: T, start?: number, end?: number): T[] {
    // Perform the fill operation first
    this.items.fill(value, start, end);

    // Then remove duplicates by creating a unique set
    const uniqueItems = [...new Set(this.items)];
    this.items.length = 0;
    this.items.push(...uniqueItems);

    this.sort();
    this.updateIndexedProperties();
    return this.items;
  }

  public copyWithin(target: number, start: number, end?: number): T[] {
    this.items.copyWithin(target, start, end);
    this.sort();
    this.updateIndexedProperties();
    return this.items;
  }

  public entries(): ArrayIterator<[number, T]> {
    return this.items.entries();
  }

  public keys(): ArrayIterator<number> {
    return this.items.keys();
  }

  public values(): ArrayIterator<T> {
    return this.items.values();
  }

  public includes(searchElement: T, fromIndex?: number): boolean {
    return this.items.includes(searchElement, fromIndex);
  }

  public flatMap<U, This = undefined>(
    callback: (
      this: This,
      value: T,
      index: number,
      array: T[]
    ) => U | readonly U[],
    thisArg?: This | undefined
  ): U[] {
    return this.items.flatMap(callback, thisArg);
  }

  public flat<A, D extends number = 1>(
    this: A,
    depth?: D | undefined
  ): FlatArray<A, D>[] {
    return ((this as any).items as any).flat(depth);
  }

  public at(index: number): T | undefined {
    return this.items.at(index);
  }

  public [Symbol.iterator](): ArrayIterator<T> {
    return this.items[Symbol.iterator]();
  }

  public readonly [Symbol.unscopables]: any = {
    copyWithin: true,
    entries: true,
    fill: true,
    find: true,
    findIndex: true,
    keys: true,
    values: true
  };

  protected abstract getCompareFn(): (a: T, b: T) => number;

  protected sort(): void {
    this.items.sort(this.getCompareFn());
  }

  protected sortArray(array: T[]): T[] {
    return array.sort(this.getCompareFn());
  }
}
