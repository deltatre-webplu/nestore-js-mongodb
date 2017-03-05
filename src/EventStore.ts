import {MongoClient, MongoClientOptions, Db as MongoDatabase, Collection as MongoCollection} from "mongodb";
import {Bucket} from "./Bucket";
import {AutoIncrementStrategy, IncrementCountersStrategy} from "./autoIncrementStrategies";

export interface EventStoreOptions {
	url: string;
	connectOptions?: MongoClientOptions;
}

export class EventStore {
	db: MongoDatabase | undefined;
	autoIncrementStrategy: AutoIncrementStrategy;

	constructor(private options: EventStoreOptions) {
		this.autoIncrementStrategy = new IncrementCountersStrategy(this);
	}

	async connect(): Promise<EventStore> {
		this.db = await MongoClient.connect(this.options.url, this.options.connectOptions);

		return this;
	}

	async close(): Promise<void> {
		if (this.db) {
			await this.db.close();
			this.db = undefined;
		}
	}

	bucket(bucketName: string) {
		if (!this.db) {
			throw new Error("Event store not connected");
		}

		return new Bucket(this, bucketName);
	}

	mongoCollection(bucketName: string): MongoCollection {
		if (!this.db) {
			throw new Error("Event store not connected");
		}

		const collectionName = `${bucketName}.commits`;
		return this.db.collection(collectionName);
	}
}
