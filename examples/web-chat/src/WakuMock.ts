class EventEmitter<T> {
  public callbacks: { [key: string]: Array<(data: T) => void> };

  constructor() {
    this.callbacks = {};
  }

  on(event: string, cb: (data: T) => void) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(cb);
  }

  emit(event: string, data: T) {
    let cbs = this.callbacks[event];
    if (cbs) {
      cbs.forEach((cb) => cb(data));
    }
  }
}

export interface Message {
  timestamp: Date;
  handle: string;
  message: string;
}

export default class WakuMock extends EventEmitter<Message> {
  index: number;
  intervalId?: number | NodeJS.Timeout;

  private constructor() {
    super();
    this.index = 0;
  }

  public static async create(): Promise<WakuMock> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const wakuMock = new WakuMock();
    wakuMock.startInterval();
    return wakuMock;
  }

  public async send(message: string): Promise<void> {
    const timestamp = new Date();
    const handle = "me";
    this.emit("message", {
      timestamp,
      handle,
      message,
    });
  }

  private startInterval() {
    if (this.intervalId === undefined) {
      this.intervalId = setInterval(this.emitMessage.bind(this), 1000);
    }
  }

  private emitMessage() {
    const handle = "you";
    const timestamp = new Date();
    this.emit("message", {
      timestamp,
      handle,
      message: `This is message #${this.index++}.`,
    });
  }
}
