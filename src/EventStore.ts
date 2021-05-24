import { MongoClient, MongoClientOptions, Db, Collection } from "mongodb";
import { Bucket } from "./Bucket";
import {
  AutoIncrementStrategy,
  IncrementCountersStrategy,
} from "./autoIncrementStrategies";

export interface EventStoreOptions {
  url: string;
  connectOptions?: MongoClientOptions;
}

export class EventStore {
  private client: MongoClient;
  db: Db | undefined;
  autoIncrementStrategy: AutoIncrementStrategy;

  constructor(options: EventStoreOptions) {
    this.client = new MongoClient(options.url, {
      ...options.connectOptions,
      useUnifiedTopology: true,
    });

    this.autoIncrementStrategy = new IncrementCountersStrategy(this);
  }

  async connect(): Promise<EventStore> {
    if (!this.client.isConnected()) {
      await this.client.connect();

      if (!this.db) {
        this.db = this.client.db();
      }
    }

    return this;
  }

  async close(): Promise<void> {
    if (this.client.isConnected()) {
      await this.client.close();
      this.db = undefined;
    }
  }

  bucket(bucketName: string) {
    if (!this.client.isConnected() || !this.db) {
      throw new Error("Event store not connected");
    }

    return new Bucket(this, bucketName);
  }

  mongoCollection(bucketName: string): Collection {
    if (!this.client.isConnected() || !this.db) {
      throw new Error("Event store not connected");
    }

    const collectionName = `${bucketName}.commits`;
    return this.db.collection(collectionName);
  }
}
