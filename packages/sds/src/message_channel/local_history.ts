import { Message } from "./events.js";

type ContentMessage = Message & {
  lamportTimestamp: number;
  content: Uint8Array<ArrayBufferLike>;
};

type SortedArray<T> = Omit<Array<T>, "reverse" | "sort">;

/**
 * In-Memory implementation of [[ILocalHistory]].
 *
 * Messages are store in SDS chronological order:
 * - messages[0] is the oldest message
 * - messages[n] is the newest message
 *
 * Only stores content message: `message.lamportTimestamp` and `message.content` are present.
 */
export class LocalHistory implements SortedArray<ContentMessage> {
  private readonly messages: Array<ContentMessage>;

  public constructor() {
    this.messages = [];
  }

  [n: number]: ContentMessage;

  public get length(): number {
    return this.messages.length;
  }

  public toString(): string {
    return this.messages.toString();
  }

  public toLocaleString(): string {
    return this.messages.toLocaleString();
  }

  public pop(): ContentMessage | undefined {
    return this.messages.pop();
  }

  public push(...items: ContentMessage[]): number {
    for (const item of items) {
      this._validateAndAddMessage(item);
    }
    this._sort();
    return this.messages.length;
  }

  public concat(...items: ConcatArray<ContentMessage>[]): ContentMessage[];
  public concat(
    ...items: (ContentMessage | ConcatArray<ContentMessage>)[]
  ): ContentMessage[];
  public concat(
    ...items: (ContentMessage | ConcatArray<ContentMessage>)[]
  ): ContentMessage[] {
    const result = this.messages.concat(...items);
    return result.sort(Message.compare);
  }

  public join(separator?: string): string {
    return this.messages.join(separator);
  }

  public shift(): ContentMessage | undefined {
    return this.messages.shift();
  }

  public slice(start?: number, end?: number): ContentMessage[] {
    return this.messages.slice(start, end);
  }

  public splice(
    start: number,
    deleteCount?: number,
    ...items: ContentMessage[]
  ): ContentMessage[] {
    const result = this.messages.splice(start, deleteCount!, ...items);
    this._sort();
    return result;
  }

  public unshift(...items: ContentMessage[]): number {
    for (const item of items) {
      this._validateMessage(item);
    }
    const result = this.messages.unshift(...items);
    this._sort();
    return result;
  }

  public indexOf(searchElement: ContentMessage, fromIndex?: number): number {
    return this.messages.indexOf(searchElement, fromIndex);
  }

  public lastIndexOf(
    searchElement: ContentMessage,
    fromIndex?: number
  ): number {
    return this.messages.lastIndexOf(searchElement, fromIndex);
  }

  public every<S extends ContentMessage>(
    predicate: (
      value: ContentMessage,
      index: number,
      array: ContentMessage[]
    ) => value is S,
    thisArg?: any
  ): this is S[];
  public every(
    predicate: (
      value: ContentMessage,
      index: number,
      array: ContentMessage[]
    ) => unknown,
    thisArg?: any
  ): boolean {
    return this.messages.every(predicate, thisArg);
  }

  public some(
    predicate: (
      value: ContentMessage,
      index: number,
      array: ContentMessage[]
    ) => unknown,
    thisArg?: any
  ): boolean {
    return this.messages.some(predicate, thisArg);
  }

  public forEach(
    callbackfn: (
      value: ContentMessage,
      index: number,
      array: ContentMessage[]
    ) => void,
    thisArg?: any
  ): void {
    this.messages.forEach(callbackfn, thisArg);
  }

  public map<U>(
    callbackfn: (
      value: ContentMessage,
      index: number,
      array: ContentMessage[]
    ) => U,
    thisArg?: any
  ): U[] {
    return this.messages.map(callbackfn, thisArg);
  }

  public filter<S extends ContentMessage>(
    predicate: (
      value: ContentMessage,
      index: number,
      array: ContentMessage[]
    ) => value is S,
    thisArg?: any
  ): S[];
  public filter(
    predicate: (
      value: ContentMessage,
      index: number,
      array: ContentMessage[]
    ) => unknown,
    thisArg?: any
  ): ContentMessage[] {
    return this.messages.filter(predicate, thisArg);
  }

  public reduce<U>(
    callbackfn: (
      previousValue: U,
      currentValue: ContentMessage,
      currentIndex: number,
      array: ContentMessage[]
    ) => U,
    initialValue?: U
  ): U {
    if (arguments.length >= 2) {
      return this.messages.reduce(callbackfn, initialValue!);
    } else {
      return this.messages.reduce(callbackfn as any) as U;
    }
  }

  public reduceRight<U>(
    callbackfn: (
      previousValue: U,
      currentValue: ContentMessage,
      currentIndex: number,
      array: ContentMessage[]
    ) => U,
    initialValue?: U
  ): U {
    if (arguments.length >= 2) {
      return this.messages.reduceRight(callbackfn, initialValue!);
    } else {
      return this.messages.reduceRight(callbackfn as any) as U;
    }
  }

  public find<S extends ContentMessage>(
    predicate: (
      this: void,
      value: ContentMessage,
      index: number,
      obj: ContentMessage[]
    ) => value is S,
    thisArg?: any
  ): S | undefined;
  public find(
    predicate: (
      value: ContentMessage,
      index: number,
      obj: ContentMessage[]
    ) => unknown,
    thisArg?: any
  ): ContentMessage | undefined {
    return this.messages.find(predicate, thisArg);
  }

  public findIndex(
    predicate: (
      value: ContentMessage,
      index: number,
      obj: ContentMessage[]
    ) => unknown,
    thisArg?: any
  ): number {
    return this.messages.findIndex(predicate, thisArg);
  }

  public entries(): ArrayIterator<[number, ContentMessage]> {
    return this.messages.entries();
  }

  public keys(): ArrayIterator<number> {
    return this.messages.keys();
  }

  public values(): ArrayIterator<ContentMessage> {
    return this.messages.values();
  }

  public includes(searchElement: ContentMessage, fromIndex?: number): boolean {
    return this.messages.includes(searchElement, fromIndex);
  }

  public flatMap<U, This = undefined>(
    callback: (
      this: This,
      value: ContentMessage,
      index: number,
      array: ContentMessage[]
    ) => U | readonly U[],
    thisArg?: This | undefined
  ): U[] {
    return this.messages.flatMap(callback, thisArg);
  }

  public flat<A, D extends number = 1>(
    this: A,
    depth?: D | undefined
  ): FlatArray<A, D>[] {
    return ((this as any).messages as any).flat(depth);
  }

  public at(index: number): ContentMessage | undefined {
    return this.messages.at(index);
  }

  public [Symbol.iterator](): ArrayIterator<ContentMessage> {
    return this.messages[Symbol.iterator]();
  }
  public readonly [Symbol.unscopables]: any = {
    entries: true,
    find: true,
    findIndex: true,
    keys: true,
    values: true
  };

  private _validateMessage(message: ContentMessage): void {
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

  private _validateAndAddMessage(newMessage: ContentMessage): void {
    this._validateMessage(newMessage);

    // Check if the entry is already present
    const existingHistoryEntry = this.messages.find(
      ({ messageId }) => newMessage.messageId === messageId
    );

    // If history entry is already present, no need to re-add
    if (!existingHistoryEntry) {
      this.messages.push(newMessage);
    }
  }

  private _sort(): void {
    this.messages.sort(Message.compare);
  }
}
