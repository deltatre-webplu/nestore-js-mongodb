import {Collection as MongoCollection} from "mongodb";
import {MongoHelpers} from "./mongoHelpers";

import {CommitData} from "./nestore-types";
import {EventStore} from "./EventStore";

export interface AutoIncrementStrategy {
	increment(bucketName: string, lastCommit?: CommitData): Promise<number>;
}

export class IncrementCountersStrategy implements AutoIncrementStrategy {
	private collection: MongoCollection;

	constructor(private eventStore: EventStore) {
	}

	async increment(bucketName: string, lastCommit?: CommitData): Promise<number> {

		if (!this.collection) {
			if (!this.eventStore.db) {
				throw new Error("Event store not connected");
			}

			this.collection = this.eventStore.db.collection("counters");
		}

		const result = await this.collection
		.findOneAndUpdate(
			{ _id: bucketName },
			{ $inc: { BucketRevision: 1 }},
			{
				returnOriginal: false,
				upsert: false
			}
		);

		// If found
		if (result.value) {
			return result.value.BucketRevision;
		}

		// If not found create a new record
		const lastRevision = lastCommit ? lastCommit._id : 0;
		await this.createCounterAsync({ _id: bucketName, BucketRevision: lastRevision });

		// try to increment again
		return this.increment(bucketName, lastCommit);
	}

	private async createCounterAsync(counter: Counter) {
		try {
			await this.collection.insertOne(counter);
		} catch (err) {
			if (!MongoHelpers.isDuplicateError(err)) {
				throw err;
			}
		}
	}
}

interface Counter {
	_id: string; // tslint:disable-line
	BucketRevision: number;
}
