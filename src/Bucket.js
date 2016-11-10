"use strict";

//const debug = require("debug")("Bucket");

class Bucket {
	constructor(eventStore, bucketName){
		this._eventStore = eventStore;
		this._bucketName = bucketName;

		const collectionName = `${bucketName}.commits`;
		this._collection =  this._eventStore._db.collection(collectionName);
	}

	getCommitsStream(filters){
		return this._getCommits(filters)
		.stream();
	}

	getCommitsArray(filters){
		return this._getCommits(filters)
		.toArray();
	}

	_getCommits(filters){
		filters = filters || {};

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

		return this._collection
		.find(mongoFilters)
		.sort({ _id : 1 });
	}
}

module.exports = Bucket;
