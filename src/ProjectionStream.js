"use strict";
const createDebug = require("debug");
const stream_1 = require("stream");
const debug = createDebug("nestore.ProjectionStream");
const debugSource = createDebug("nestore.ProjectionStream.source");
class ProjectionStream extends stream_1.Readable {
    constructor(bucket, filters, options) {
        super({ objectMode: true });
        this.bucket = bucket;
        this.closed = false;
        this.filters = Object.assign({}, filters);
        this.options = Object.assign({}, options);
        this.options.waitInterval = this.options.waitInterval || 5000;
    }
    close() {
        debug("close");
        this.closed = true;
        this._stopTimer();
        if (this.source)
            return this.source.close();
        this.emit("close");
        return Promise.resolve();
    }
    isClosed() {
        return this.closed;
    }
    resume() {
        debug("resume");
        super.resume();
        if (this.source)
            this.source.resume();
        return this;
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    pause() {
        debug("pause");
        super.pause();
        if (this.source)
            this.source.pause();
        return this;
    }
    _read() {
        debug("_read");
        if (!this.timeoutObj && !this.isClosed())
            this._startTimer(1);
    }
    _startTimer(interval) {
        debug("_startTimer");
        if (this.isClosed())
            return;
        this._stopTimer();
        this.timeoutObj = setTimeout(() => this._loadNextStream(), interval || this.options.waitInterval);
    }
    _stopTimer() {
        if (this.timeoutObj) {
            clearTimeout(this.timeoutObj);
        }
        this.timeoutObj = null;
    }
    _loadNextStream() {
        debug("_loadNextStream");
        this.bucket.lastCommit({}, this.options)
            .then((lastCommit) => {
            let lastBucketRevision = lastCommit ? lastCommit._id : 0;
            let sourceCursor = this.bucket._getCommitsCursor(this.filters, this.options);
            this.source = sourceCursor;
            sourceCursor
                .on("data", (doc) => {
                if (doc._id > lastBucketRevision)
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
                if (!this.isClosed()) {
                    debug("Waiting...");
                    this.filters.fromBucketRevision = lastBucketRevision + 1;
                    this.emit("wait", { filters: this.filters });
                    this._startTimer();
                }
            });
            if (this.isPaused()) {
                sourceCursor.pause();
            }
        });
    }
}
exports.ProjectionStream = ProjectionStream;
