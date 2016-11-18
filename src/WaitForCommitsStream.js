"use strict";

const debug = require("debug")("WaitForCommitsStream");
const debugSource = require("debug")("WaitForCommitsStream.source");

const ReadableStream = require("stream").Readable;

class WaitForCommitsStream extends ReadableStream {
	constructor(opt) {
		super({ objectMode : true });

		this._getNextCommits = opt.getNextCommits; // callback function to get commits
		this._fromBucketRevision = opt.fromBucketRevision; // initial revision
		this._waitInterval = opt.waitInterval;
		this._timeoutObject = null;

		this._readNextCommits();
		this._source.pause();
	}

	// return a Promise
	close(){
		debug("close");

		if (this._source)
			return this._source.close();

		return Promise.resolve();
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
			if (this._timeoutObject){
				clearTimeout(this._timeoutObject);
			}
			this.emit("close");
		})
		.on("end", () => {
			debug("Waiting...");
			this.emit("wait", { fromBucketRevision : this._fromBucketRevision });
			this._timeoutObject = setTimeout(
				() => this._readNextCommits(),
				this._waitInterval);
		});

		if (this.isPaused()){
			this._source.pause();
		}
	}
}

module.exports = WaitForCommitsStream;
