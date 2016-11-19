"use strict";

const debug = require("debug")("ProjectionStream");
const debugSource = require("debug")("ProjectionStream.source");

const ReadableStream = require("stream").Readable;

class ProjectionStream extends ReadableStream {
	constructor(opt) {
		super({ objectMode : true });

		this._getNextCommits = opt.getNextCommits; // callback function to get commits
		this._fromBucketRevision = opt.fromBucketRevision; // initial revision
		this._waitInterval = opt.waitInterval;
		this._timeoutObject = null;
		this._closed = false;

		this._readNextCommits();
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
			() => this._readNextCommits(),
			this._waitInterval);
	}

	_stopTimer(){
		if (this._timeoutObject){
			clearTimeout(this._timeoutObject);
		}
		this._timeoutObject = null;
	}

	_readNextCommits(){
		this._source = this._getNextCommits(this._fromBucketRevision);

		this._source
		.on("data", (doc) => {
			this._fromBucketRevision = doc._id + 1;

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
				this.emit("wait", { fromBucketRevision : this._fromBucketRevision });
				this._startTimer();
			}
		});

		if (this.isPaused()){
			this._source.pause();
		}
	}
}

module.exports = ProjectionStream;
