"use strict";

const EventEmitter = require("events");
class Projection extends EventEmitter {
	constructor(bucket){
		super();
		this._bucket = bucket;
		this._stream = null;
	}

	start(filters, options){

		this._startPromise = new Promise((resolve) => {
			this._stream = this._bucket.waitForCommitsStream(filters, options);

			this._stream
			.on("data", (doc) => {
				this.emit("commit", doc);
			})
			.on("error", (err) => {
				this.emit("error", err);
			})
			.on("close", () => {
				resolve();
			});
		});

		return this._startPromise;
	}

	stop(){
		if (this._stream)
			return this._stream.close();
		if (this._startPromise)
			return this._startPromise;

		return Promise.resolve();
	}
}

module.exports = Projection;
