declare module "time-cache" {

  interface ITimeCache {
    put(key: string, value: any, validity: number): void;
    get(key: string): any;  
    has(key: string): boolean;
  }

  type TimeCache = ITimeCache;

  function TimeCache(options: object): TimeCache;

  export = TimeCache;

}
