import * as createDebug from "debug";
import {ProjectionStream} from "./ProjectionStream";
import {EventStore} from "./EventStore";
import {Readable as ReadableStream} from "stream";
import {Collection as MongoCollection, Cursor as MongoCursor} from "mongodb";

import {CommitsFilters, CommitsOptions} from "./nestore-types";

const debug = createDebug("nestore.Bucket");

export class Bucket {
	private collection : MongoCollection;

	constructor(
		private eventStore : EventStore,
		private bucketName : string){

		this.collection =  this.eventStore.mongoCollection(bucketName);
	}

	getCommitsStream(filters? : CommitsFilters, options? : CommitsOptions) : ReadableStream{
		return this._getCommitsCursor(filters, options)
		.stream();
	}

	getCommitsArray(filters? : CommitsFilters, options? : CommitsOptions){
		return this._getCommitsCursor(filters, options)
		.toArray();
	}

	projectionStream(filters? : CommitsFilters, options? : CommitsOptions){
		filters = filters || {};
		options = options || {};

		return new ProjectionStream(this, filters, options);
	}

	lastCommit(filters? : CommitsFilters, options? : CommitsOptions){
		return this._getCommitsCursor(filters, options, { _id : -1 })
		.limit(1)
		.toArray()
		.then((data) => {
			if (data.length)
				return data[0];

			return null;
		});
	}

	_getCommitsCursor(filters? : CommitsFilters, options? : CommitsOptions, sort?) : MongoCursor{
		filters = filters || {};
		options = options || {};
		sort = sort || { _id : 1 };

		let mongoFilters : any = {};

		if (filters.eventFilters){
			Object.getOwnPropertyNames(filters.eventFilters)
			.forEach(function(name) {
				mongoFilters["Events." + name] = filters.eventFilters[name];
			});
		}

		if (!filters.hasOwnProperty("dispatched")) // by default returns only dispatched
			mongoFilters.Dispatched = true;
		else if (filters.dispatched == 0) // returns only undispatched
			mongoFilters.Dispatched = false;
		else if (filters.dispatched == 1) // returns only dispatched
			mongoFilters.Dispatched = true;
		else if (filters.dispatched == -1) {
			// returns all
		}

		if (filters.streamId)
			mongoFilters.StreamId = filters.streamId;
		if (filters.fromBucketRevision || filters.toBucketRevision) {
			mongoFilters._id = {};
			if (filters.fromBucketRevision)
				mongoFilters._id["$gte"] = filters.fromBucketRevision;
			if (filters.toBucketRevision)
				mongoFilters._id["$lte"] = filters.toBucketRevision;
		}

		debug("_getCommitsCursor", mongoFilters);

		let cursor = this.collection
		.find(mongoFilters)
		.sort(sort);

		if (options.batchSize){
			cursor = cursor.batchSize(options.batchSize);
		}

		return cursor;
	}

}
