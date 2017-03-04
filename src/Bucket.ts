import * as createDebug from "debug";
import {ProjectionStream} from "./ProjectionStream";
import {EventStore} from "./EventStore";
import {Readable as ReadableStream} from "stream";
import {Collection as MongoCollection, Cursor as MongoCursor} from "mongodb";

import {CommitsFilters, CommitsOptions, CommitData, ProjectionStreamOptions, MongoDbCommit} from "./nestore-types";
import {MongoHelpers} from "./mongoHelpers";

const debug = createDebug("nestore.Bucket");

export class Bucket {
	private collection: MongoCollection;

	constructor(
		readonly eventStore: EventStore,
		readonly bucketName: string) {

		this.collection =  this.eventStore.mongoCollection(bucketName);
	}

	async getCommitById(id: number): Promise<CommitData | undefined> {
		const doc = await this.collection
		.findOne({_id : id});

		return MongoHelpers.mongoDocToCommitData(doc);
	}

	getCommitsStream(filters?: CommitsFilters, options?: CommitsOptions): ReadableStream {
		return this._getCommitsCursor(filters, options)
		.stream({
			transform: MongoHelpers.mongoDocToCommitData
		});
	}

	async getCommitsArray(filters?: CommitsFilters, options?: CommitsOptions): Promise<CommitData[]> {
		const docs = await this._getCommitsCursor(filters, options)
		.toArray();

		return docs
			.map((d) => MongoHelpers.mongoDocToCommitData(d) );
	}

	projectionStream(filters?: CommitsFilters, options?: ProjectionStreamOptions): ProjectionStream {
		filters = filters || {};
		options = options || {};

		return new ProjectionStream(this, filters, options);
	}

	async lastCommit(filters?: CommitsFilters, options?: CommitsOptions): Promise<CommitData | undefined> {
		const docs = await this._getCommitsCursor(filters, options, { _id : -1 })
		.limit(1)
		.toArray();

		if (docs.length) {
			return MongoHelpers.mongoDocToCommitData(docs[0]);
		}

		return undefined;
	}

	async updateCommit(id: number, events: any[]): Promise<CommitData | undefined> {
		const commit = await this.getCommitById(id);
		if (!commit) {
			return undefined;
		}

		if (events) {
			if (commit.Events.length !== events.length) {
				throw new Error("Events count must be the same");
			}

			commit.Events = events;
		}

		await this.collection.updateOne(
				{_id : id},
				{$set: { Events: commit.Events } }
			);

		return commit;
	}

	_getCommitsCursor(filters?: CommitsFilters, options?: CommitsOptions, sort?: any): MongoCursor<MongoDbCommit> {
		filters = filters || {};
		options = options || {};
		sort = sort || { _id : 1 };

		const mongoFilters: any = {};

		const eFilters = filters.eventFilters;
		if (eFilters) {
			Object.getOwnPropertyNames(eFilters)
			.forEach(function(name) {
				mongoFilters["Events." + name] = eFilters[name];
			});
		}

		if (!filters.hasOwnProperty("dispatched")) { // by default returns only dispatched
			mongoFilters.Dispatched = true;
		} else if (filters.dispatched === 0) { // returns only undispatched
			mongoFilters.Dispatched = false;
		} else if (filters.dispatched === 1) { // returns only dispatched
			mongoFilters.Dispatched = true;
		} else if (filters.dispatched === -1) {
			// returns all
		}

		if (filters.streamId) {
			mongoFilters.StreamId = MongoHelpers.stringToBinaryUUID(filters.streamId);
		}
		if (filters.fromBucketRevision || filters.toBucketRevision) {
			mongoFilters._id = {};
			if (filters.fromBucketRevision) {
				mongoFilters._id.$gte = filters.fromBucketRevision;
			}
			if (filters.toBucketRevision) {
				mongoFilters._id.$lte = filters.toBucketRevision;
			}
		}

		debug("_getCommitsCursor", mongoFilters);

		let cursor = this.collection
		.find(mongoFilters)
		.sort(sort);

		if (options.batchSize) {
			cursor = cursor.batchSize(options.batchSize);
		}

		return cursor;
	}
}
