"use strict";

const debug = require("debug")("Bucket");
const WaitForCommitsStream = require("./WaitForCommitsStream");

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

	waitForCommitsStream(filters, options){
		filters = filters || {};
		options = options || {};

		filters = Object.assign({}, filters); // clone it to modify without problems
		let bucket = this;
		function _getNextCommits(fromBucketRevision){
			filters.fromBucketRevision = fromBucketRevision;
			return bucket._getCommitsCursor(filters, options);
		}

		return new WaitForCommitsStream({
			fromBucketRevision : filters.fromBucketRevision,
			getNextCommits : _getNextCommits,
			waitInterval : options.waitInterval || 5000
		});
	}

	_getCommitsCursor(filters, options){
		filters = filters || {};
		options = options || {};

		debug(`_getCommitsCursor from ${filters.fromBucketRevision}`);

		let mongoFilters = {};

		if (filters.eventFilters){
			Object.getOwnPropertyNames(filters.eventFilters)
			.forEach(function(name) {
				mongoFilters["Events." + name] = filters.eventFilters[name];
			});
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

		debug("mongoFilters", mongoFilters);

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
