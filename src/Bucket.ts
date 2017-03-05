import * as createDebug from "debug";
import {ProjectionStream} from "./ProjectionStream";
import {EventStore} from "./EventStore";
import {Readable as ReadableStream} from "stream";
import {Collection as MongoCollection, Cursor as MongoCursor} from "mongodb";

import {WriteResult, WriteOptions, CommitsFilters, CommitsOptions, CommitData,
	ProjectionStreamOptions, MongoDbCommit,
	ConcurrencyError, UndispatchedEventsFoundError} from "./nestore-types";
import {MongoHelpers} from "./mongoHelpers";
import * as uuid from "uuid";

const debug = createDebug("nestore.Bucket");

export class Bucket {
	private collection: MongoCollection;
	private indexesEnsured = false;

	constructor(
		readonly eventStore: EventStore,
		readonly bucketName: string) {

		this.collection =  this.eventStore.mongoCollection(bucketName);
	}

	randomStreamId(): string {
		return uuid.v4();
	}

	async ensureIndexes(): Promise<void> {
		if (this.indexesEnsured) {
			return;
		}

		await this.collection.createIndexes([
			// BucketRevision is _id (automatically indexed and unique)
			{
				key: { Dispatched: 1 }, // TODO Consider creating a partial index to just have one dispatched=false
				name: "Dispatched"
			},
			{
				key: { StreamId: 1 },
				name: "StreamId"
			},
			{
				key: { StreamId: 1, StreamRevisionStart: 1 },
				name: "StreamRevision",
				unique: true
			}
		]);

		this.indexesEnsured = true;
	}

	async write(
		streamId: string,
		expectedStreamRevision: number,
		events: any[],
		options: WriteOptions = { dispatched: false }): Promise<WriteResult> {

		// sanity check
		if (!options.dispatched) {
			throw new Error("Automatic dispatching not yet supported");
		}
		if (!streamId) {
			throw new Error("Invalid stream id");
		}
		if (expectedStreamRevision < 0) {
			throw new Error("Invalid stream revision");
		}
		if (events.length === 0) {
			throw new Error("Invalid stream events");
		}

		await this.ensureIndexes();

		// stream revision check
		const lastCommit = await this.lastCommit({ dispatched: -1 });
		const currentStreamRevision = lastCommit && lastCommit.StreamId === streamId
			? lastCommit.StreamRevisionEnd
			: await this.streamRevision(streamId);
		if (expectedStreamRevision < currentStreamRevision) {
			throw new ConcurrencyError(`Concurrency error, expected stream revision ${currentStreamRevision}`);
		}
		if (expectedStreamRevision > currentStreamRevision) {
			throw new Error(`Invalid stream revision, expected '${currentStreamRevision}'`);
		}

		// Check for undispatched
		if (lastCommit && lastCommit.Dispatched === false) {
			throw new UndispatchedEventsFoundError(`Undispatched events found for stream ${streamId}`);
		}

		const commit = await this.createCommit(
			streamId,
			expectedStreamRevision,
			events,
			options.dispatched,
			lastCommit);

		try {
			await this.collection.insertOne(commit);
		} catch (err) {
			if (MongoHelpers.isDuplicateError(err)) {
				throw new ConcurrencyError("Concurrency error, bucket revision duplicate key");
			}

			throw err;
		}

		return {
			commit: MongoHelpers.mongoDocToCommitData(commit)
		};
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

	async streamRevision(streamId: string): Promise<number> {
		const lastCommit = await this.lastCommit({ streamId, dispatched: -1 });
		if (!lastCommit) {
			return 0;
		}

		return lastCommit.StreamRevisionEnd;
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

	private async createCommit(
		streamId: string,
		expectedStreamRevision: number,
		events: any[],
		dispatched: boolean,
		lastCommit?: CommitData): Promise<MongoDbCommit> {

		const bucketRevision = await this.eventStore.autoIncrementStrategy
			.increment(this.bucketName, lastCommit);

		return {
			_id: bucketRevision,
			Dispatched: dispatched,
			Events: events,
			StreamId: MongoHelpers.stringToBinaryUUID(streamId),
			StreamRevisionStart: expectedStreamRevision,
			StreamRevisionEnd: expectedStreamRevision + events.length
		};
	}
}
