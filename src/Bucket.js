"use strict";

const debug = require("debug")("Bucket");
const ProjectionStream = require("./ProjectionStream");

class Bucket {
	constructor(eventStore, bucketName){
		this._eventStore = eventStore;
		this._bucketName = bucketName;

		const collectionName = `${bucketName}.commits`;
		this._collection =  this._eventStore._db.collection(collectionName);
	}

	getCommitsStream(filters, options){
		return this._getCommitsCursor(filters, options)
		.stream();
	}

	getCommitsArray(filters, options){
		return this._getCommitsCursor(filters, options)
		.toArray();
	}

	projectionStream(filters, options){
		filters = filters || {};
		options = options || {};

		return new ProjectionStream(this, filters, options);
	}

	lastCommit(filters, options){
		return this._getCommitsCursor(filters, options, { _id : -1 })
		.limit(1)
		.toArray()
		.then((data) => {
			if (data.length)
				return data[0];

			return null;
		});
	}

	_getCommitsCursor(filters, options, sort){
		filters = filters || {};
		options = options || {};
		sort = sort || { _id : 1 };

		let mongoFilters = {};

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

		let cursor = this._collection
		.find(mongoFilters)
		.sort(sort);

		if (options.batchSize){
			cursor = cursor.batchSize(options.batchSize);
		}

		return cursor;
	}

}

module.exports = Bucket;
