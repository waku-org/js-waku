if (typeof CustomEvent === "undefined") {
  class CustomEvent<T = unknown> extends Event {
    public detail: T;

    public constructor(type: string, eventInitDict?: CustomEventInit<T>) {
      super(type, eventInitDict);
      this.detail = eventInitDict?.detail ?? (null as T);
    }
  }

  (globalThis as Record<string, unknown>).CustomEvent = CustomEvent;
}
