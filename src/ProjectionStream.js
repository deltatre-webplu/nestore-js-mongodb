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

		this._source = null;
		this._timeoutObject = null;
		this._closed = false;
	}

	// return a Promise
	close(){
		debug("close");

		this._closed = true;
		this._stopTimer();

		if (this._source)
			return this._source.close();

		// force a close event and exit
		this.emit("close");
		return Promise.resolve();
	}

	isClosed(){
		return this._closed;
	}

	resume(){
		debug("resume");
		super.resume();

		if (this._source)
			this._source.resume();
	}

	pause(){
		debug("pause");
		super.pause();

		if (this._source)
			this._source.pause();
	}

	// virtual method called by base class each time it needs more data
	_read(){
		debug("_read");

		if (!this._timeoutObject)
			this._startTimer(1);
	}

	_startTimer(interval){
		this._stopTimer();
		this._timeoutObject = setTimeout(
			() => this._loadNextStream(),
			interval || this._options.waitInterval);
	}

	_stopTimer(){
		if (this._timeoutObject){
			clearTimeout(this._timeoutObject);
		}
		this._timeoutObject = null;
	}

	_loadNextStream(){
		// read last commit to know from where to start next time (note that I don't use a filter, to ensure that next time I start from next commits, if any)
		this._bucket.lastCommit({}, this._options)
		.then((lastCommit) => {
			let lastBucketRevision = lastCommit ? lastCommit._id : 0;

			let sourceCursor = this._bucket._getCommitsCursor(this._filters, this._options);
			this._source = sourceCursor;

			sourceCursor
			.on("data", (doc) => {
				if (doc._id > lastBucketRevision) // if read doc contains new commits update lastBucketRevision
					lastBucketRevision = doc._id;

				if (!this.push(doc))
					sourceCursor.close();
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

					// change the starting point of the next read
					this._filters.fromBucketRevision = lastBucketRevision + 1;

					this.emit("wait", { filters : this._filters });

					this._startTimer();
				}
			});

			if (this.isPaused()){
				sourceCursor.pause();
			}
		});
	}
}

module.exports = ProjectionStream;
