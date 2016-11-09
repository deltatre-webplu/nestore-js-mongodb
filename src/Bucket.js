"use strict";

//const debug = require("debug")("Bucket");

class Bucket {
	constructor(eventStore, bucketName){
		this._eventStore = eventStore;
		this._bucketName = bucketName;

		const collectionName = `${bucketName}.commits`;
		this._collection =  this._eventStore._db.collection(collectionName);
	}

	getCommits(filters){
		return this._collection
		.find({})
		.sort({ _id : 1 })
		.stream();
	}
}

module.exports = Bucket;
