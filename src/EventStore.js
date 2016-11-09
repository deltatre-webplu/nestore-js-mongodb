"use strict";

//const debug = require("debug")("EventStore");
const MongoClient = require("mongodb").MongoClient;
const Bucket = require("./Bucket.js");

class EventStore {
	constructor(options){
		if (!options || !options.url){
			throw new Error("options.url required");
		}

		this._options = options;
	}

	connect(){
		return MongoClient.connect(this._options.url, this._options.connectOptions)
		.then(db => {
			this._db = db;
			return this;
		});
	}

	close(){
		if (this._db){
			this._db.close();
			this._db = null;
		}
	}

	bucket(bucketName){
		return new Bucket(this, bucketName);
	}
}

module.exports = EventStore;
