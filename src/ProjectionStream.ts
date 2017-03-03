import * as createDebug from "debug";
import {Readable as ReadableStream} from "stream";
// use module augmentation to add isPaused because is missing...
declare module "stream" {
    interface Readable {
        isPaused(): Boolean;
    }
}

import {Bucket} from "./Bucket";
import {CommitsFilters, ProjectionStreamOptions, CommitData} from "./nestore-types";
import {Cursor as MongoCursor} from "mongodb";

const debug = createDebug("nestore.ProjectionStream");
const debugSource = createDebug("nestore.ProjectionStream.source");

export class ProjectionStream extends ReadableStream {

	private filters : CommitsFilters;
	private options : ProjectionStreamOptions;
	private closed : Boolean = false;
	private source : MongoCursor<CommitData>;
	private timeoutObj : number | undefined;

	constructor(
		private bucket:Bucket,
		filters : CommitsFilters,
		options : ProjectionStreamOptions) {
		super({ objectMode : true });

		this.filters = Object.assign({}, filters); // clone it because I will modify it...
		this.options = Object.assign({}, options); // clone it because I will modify it...
		this.options.waitInterval = this.options.waitInterval || 5000;
	}

	// return a Promise
	close(){
		debug("close");

		this.closed = true;
		this._stopTimer();

		if (this.source)
			return this.source.close();

		// force a close event and exit
		this.emit("close");
		return Promise.resolve();
	}

	isClosed(){
		return this.closed;
	}

	resume() : ReadableStream{
		debug("resume");
		super.resume();

		if (this.source)
			this.source.resume();

    return <any>this; // TODO how can I return base instance?
	}

  on(event: "close", listener: () => void): this;
  on(event: "data", listener: (chunk: Buffer | string | CommitData) => void): this;
  on(event: "end", listener: () => void): this;
  on(event: "readable", listener: () => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "wait", listener: (info: { filters : CommitsFilters }) => void): this;
  on(event: string, listener: Function): this{
    return super.on(event, listener);
  }

	pause() : ReadableStream {
		debug("pause");
		super.pause();

		if (this.source)
			this.source.pause();

		return <any>this; // TODO how can I return base instance?
	}

	// virtual method called by base class each time it needs more data
	_read(){
		debug("_read");

		if (!this.timeoutObj && !this.isClosed())
			this._startTimer(1);
	}

	private _startTimer(interval? : number){
		debug("_startTimer");

		if (this.isClosed())
			return;

		this._stopTimer();
		this.timeoutObj = setTimeout(
			() => this._loadNextStream(),
			interval || this.options.waitInterval);
	}

	private _stopTimer(){
		if (this.timeoutObj){
			clearTimeout(this.timeoutObj);
		}
		this.timeoutObj = undefined;
	}

	private _loadNextStream(){
		debug("_loadNextStream");

		// read last commit to know from where to start next time
		//  (note that I don't use a filter, to ensure that next time I start from next commits, if any)
		//  TODO Think if there is a way to exclude this call for performance reason, at least after first calls...
		this.bucket.lastCommit({}, this.options)
		.then((lastCommit) => {
			let lastBucketRevision = lastCommit ? lastCommit._id : 0;

			let sourceCursor = this.bucket._getCommitsCursor(this.filters, this.options);
			this.source = sourceCursor;

			sourceCursor
			.on("data", (doc : any) => {
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
					this.filters.fromBucketRevision = lastBucketRevision + 1;

					this.emit("wait", { filters : this.filters });

					this._startTimer();
				}
			});

			if (this.isPaused()){
				sourceCursor.pause();
			}
		});
	}
}
