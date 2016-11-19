"use strict";

const debug = require("debug")("ProjectionStream");
const debugSource = require("debug")("ProjectionStream.source");

const ReadableStream = require("stream").Readable;

class ProjectionStream extends ReadableStream {
	constructor(bucket, filters, options) {
		super({ objectMode : true });

		this._bucket = bucket;
		this._filters = Object.assign({}, filters);
		this._options = options;
		this._options.waitInterval = this._options.waitInterval || 5000;

		this._timeoutObject = null;
		this._closed = false;

		this._nextStream();
		this._source.pause();
	}

	// return a Promise
	close(){
		debug("close");

		this._closed = true;
		this._stopTimer();

		if (this._source)
			return this._source.close();

		return Promise.resolve();
	}

	isClosed(){
		return this._closed;
	}

	resume(){
		debug("resume");
		super.resume();

		this._source.resume();
	}

	pause(){
		debug("pause");
		super.pause();

		this._source.pause();
	}

	_read(){
		this._source.resume();
	}

	_startTimer(){
		this._stopTimer();
		this._timeoutObject = setTimeout(
			() => this._nextStream(),
			this._options.waitInterval);
	}

	_stopTimer(){
		if (this._timeoutObject){
			clearTimeout(this._timeoutObject);
		}
		this._timeoutObject = null;
	}

	_nextStream(){
		this._source = this._bucket._getCommitsCursor(this._filters, this._options);

		this._source
		.on("data", (doc) => {
			this._filters.fromBucketRevision = doc._id + 1;

			if (!this.push(doc))
				this._source.pause();
		})
		.on("error", (err) => {
			debugSource("Error");
			this.emit("error", err);
		})
		.on("close", () => {
			debugSource("Closed");
			this._stopTimer();
			this.emit("close");
		})
		.on("end", () => {
			debugSource("End");

			if (!this.isClosed()){
				debug("Waiting...");
				this.emit("wait", { filters : this._filters });
				this._startTimer();
			}
		});

		if (this.isPaused()){
			this._source.pause();
		}
	}
}

module.exports = ProjectionStream;
