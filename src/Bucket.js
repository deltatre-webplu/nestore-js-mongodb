"use strict";

//const debug = require("debug")("Bucket");

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

	_getCommitsCursor(filters, options){
		filters = filters || {};
		options = options || {};

		let mongoFilters = {};
		if (filters.streamId)
			mongoFilters.StreamId = filters.streamId;
		if (filters.fromBucketRevision || filters.toBucketRevision) {
			mongoFilters._id = {};
			if (filters.fromBucketRevision)
				mongoFilters._id["$gte"] = filters.fromBucketRevision;
			if (filters.toBucketRevision)
				mongoFilters._id["$lte"] = filters.toBucketRevision;
		}

		let cursor = this._collection
		.find(mongoFilters)
		.sort({ _id : 1 });

		if (options.batchSize){
			cursor = cursor.batchSize(options.batchSize);
		}

		return cursor;
	}
}

module.exports = Bucket;
