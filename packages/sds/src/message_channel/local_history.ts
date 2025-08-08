import { Message } from "./events.js";

type ContentMessage = Message & {
  lamportTimestamp: number;
  content: Uint8Array<ArrayBufferLike>;
};

type SortedArrayInterface<T> = Omit<Array<T>, "reverse" | "sort">;

/**
 * Base class that implements a sorted array interface.
 * Automatically maintains sort order after any mutating operation.
 */
abstract class SortedArrayBase<T> implements SortedArrayInterface<T> {
  protected readonly items: Array<T>;

  public constructor() {
    this.items = [];
  }

  [n: number]: T;

  public get length(): number {
    return this.items.length;
  }

  public toString(): string {
    return this.items.toString();
  }

  public toLocaleString(): string {
    return this.items.toLocaleString();
  }

  public pop(): T | undefined {
    return this.items.pop();
  }

  public push(...items: T[]): number {
    const result = this.items.push(...items);
    this.sort();
    return result;
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
    return this.items.shift();
  }

  public slice(start?: number, end?: number): T[] {
    return this.items.slice(start, end);
  }

  public splice(start: number, deleteCount?: number, ...items: T[]): T[] {
    const result = this.items.splice(start, deleteCount!, ...items);
    this.sort();
    return result;
  }

  public unshift(...items: T[]): number {
    const result = this.items.unshift(...items);
    this.sort();
    return result;
  }

  public indexOf(searchElement: T, fromIndex?: number): number {
    return this.items.indexOf(searchElement, fromIndex);
  }

  public lastIndexOf(searchElement: T, fromIndex?: number): number {
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
    this.items.fill(value, start, end);
    this.sort();
    return this.items;
  }

  public copyWithin(target: number, start: number, end?: number): T[] {
    this.items.copyWithin(target, start, end);
    this.sort();
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

/**
 * In-Memory implementation of a local store of messages.
 *
 * Messages are store in SDS chronological order:
 * - messages[0] is the oldest message
 * - messages[n] is the newest message
 *
 * Only stores content message: `message.lamportTimestamp` and `message.content` are present.
 */
export class LocalHistory extends SortedArrayBase<ContentMessage> {
  protected getCompareFn(): (a: ContentMessage, b: ContentMessage) => number {
    return Message.compare;
  }

  public push(...items: ContentMessage[]): number {
    for (const item of items) {
      this.validateAndAddMessage(item);
    }
    this.sort();
    return this.items.length;
  }

  public unshift(...items: ContentMessage[]): number {
    for (const item of items) {
      this.validateMessage(item);
    }
    const result = this.items.unshift(...items);
    this.sort();
    return result;
  }

  public fill(
    value: ContentMessage,
    start?: number,
    end?: number
  ): ContentMessage[] {
    this.validateMessage(value);
    this.items.fill(value, start, end);
    this.sort();
    return this.items;
  }

  private validateMessage(message: ContentMessage): void {
    if (
      !message.lamportTimestamp ||
      !message.content ||
      !message.content.length ||
      !message.messageId
    ) {
      throw new Error(
        "Message must have lamportTimestamp and content defined, sync and ephemeral messages cannot be stored"
      );
    }
  }

  private validateAndAddMessage(newMessage: ContentMessage): void {
    this.validateMessage(newMessage);

    // Check if the entry is already present
    const existingHistoryEntry = this.items.find(
      ({ messageId }) => newMessage.messageId === messageId
    );

    // If history entry is already present, no need to re-add
    if (!existingHistoryEntry) {
      this.items.push(newMessage);
    }
  }
}
