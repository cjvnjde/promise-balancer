const defaultOptions = {
  loadingQueueLimit: 1,
  minLoadingQueueLimit: 1,
  loadingQueueStartSize: 1,
  limit: 1000,
  delta: 500,
};

type DecoratedItem = {
  startTime: number;
  item: any;
  endTime: number;
}

export class Balancer {
  queue: DecoratedItem[] = [];
  loadingQueueSize: number;
  loadingQueueLimit: number;
  minLoadingQueueLimit: number;
  promiseMaker: (...items: any[]) => Promise<any>;
  isStarted = false;
  limit: number;
  delta: number;

  constructor(promiseMaker: (...items: any[]) => Promise<any>, options = {}) {
    this.promiseMaker = promiseMaker;
    const optionsWithDefault = {
      ...defaultOptions,
      ...options,
    };

    this.loadingQueueLimit = optionsWithDefault.loadingQueueLimit;
    this.loadingQueueSize = optionsWithDefault.loadingQueueStartSize;
    this.minLoadingQueueLimit = optionsWithDefault.minLoadingQueueLimit;
    this.limit = optionsWithDefault.limit;
    this.delta = optionsWithDefault.delta;
  }

  addToQueue(...items: any[]) {
    this.queue.push(...items.map(this.decorateItem));

    this.start();
  }

  decorateItem(item: any): DecoratedItem {
    return {
      item,
      startTime: 0,
      endTime: 0,
    };
  }

  start() {
    if (!this.isStarted) {
      this.fillLoadingQueue();
    }
  }

  fillLoadingQueue() {
    const delta = this.loadingQueueLimit - this.loadingQueueSize;

    if (delta > 0) {
      Array.from({length: delta}, () => null).forEach(() => {
        const wrappedItem = this.queue.shift();

        if (wrappedItem) {
          this.isStarted = true;
          wrappedItem.startTime = new Date().getTime();
          this.loadingQueueSize += 1;
          this.promiseMaker(wrappedItem.item)
            .then(() => {
              wrappedItem.endTime = new Date().getTime();
              this.loadingQueueSize -= 1;
              this.analiseTime(wrappedItem);
              this.fillLoadingQueue();
            });
        } else {
          this.isStarted = false;
        }
      });
    }
  }

  analiseTime(decoratedItem: DecoratedItem) {
    const diff = decoratedItem.endTime - decoratedItem.startTime;

    if (diff < this.limit) {
      this.loadingQueueLimit += 1;
    } else if (diff > this.limit + this.delta) {
      if (this.loadingQueueLimit > this.minLoadingQueueLimit) {
        this.loadingQueueLimit -= 1;
      } else {
        this.loadingQueueLimit = this.minLoadingQueueLimit;
      }
    }
  }
}
