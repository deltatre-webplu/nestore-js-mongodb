import {MongoClient, MongoClientOptions, Db as MongoDatabase, Collection as MongoCollection} from "mongodb";
import {Bucket} from "./Bucket";

export interface EventStoreOptions {
	url : string;
	connectOptions? : MongoClientOptions
}

export class EventStore {
	db : MongoDatabase;

	constructor(private options : EventStoreOptions){
	}

	async connect() : Promise<EventStore> {
		this.db = await MongoClient.connect(this.options.url, this.options.connectOptions);

		return this;
	}

	async close() : Promise<void>{
		if (this.db){
			await this.db.close();
			this.db = null;
		}
	}

	bucket(bucketName : string){
		if (!this.db)
			throw new Error("Event store not connected");

		return new Bucket(this, bucketName);
	}

	mongoCollection(bucketName : string) : MongoCollection{
		if (!this.db)
			throw new Error("Event store not connected");

		const collectionName = `${bucketName}.commits`;
		return this.db.collection(collectionName);
	}
}
