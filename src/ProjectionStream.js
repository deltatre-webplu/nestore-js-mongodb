"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const createDebug = require("debug");
const stream_1 = require("stream");
const mongoHelpers_1 = require("./mongoHelpers");
const debug = createDebug("nestore.ProjectionStream");
const debugSource = createDebug("nestore.ProjectionStream.source");
class ProjectionStream extends stream_1.Readable {
    constructor(bucket, filters, options) {
        super({ objectMode: true });
        this.bucket = bucket;
        this.closed = false;
        this.filters = Object.assign({}, filters); // clone it because I will modify it...
        this.options = Object.assign({}, options); // clone it because I will modify it...
        this.options.waitInterval = this.options.waitInterval || 5000;
    }
    // return a Promise
    close() {
        debug("close");
        this.closed = true;
        this._stopTimer();
        if (this.source) {
            return this.source.close();
        }
        // force a close event and exit
        this.emit("close");
        return Promise.resolve();
    }
    isClosed() {
        return this.closed;
    }
    resume() {
        debug("resume");
        super.resume();
        if (this.source) {
            this.source.resume();
        }
        return this;
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    pause() {
        debug("pause");
        super.pause();
        if (this.source) {
            this.source.pause();
        }
        return this;
    }
    // virtual method called by base class each time it needs more data
    _read() {
        debug("_read");
        if (!this.timeoutObj && !this.isClosed()) {
            this._startTimer(1);
        }
    }
    _startTimer(interval) {
        debug("_startTimer");
        if (this.isClosed()) {
            return;
        }
        this._stopTimer();
        this.timeoutObj = setTimeout(() => this._loadNextStream(), interval || this.options.waitInterval);
    }
    _stopTimer() {
        if (this.timeoutObj) {
            clearTimeout(this.timeoutObj);
        }
        this.timeoutObj = undefined;
    }
    _loadNextStream() {
        debug("_loadNextStream");
        // read last commit to know from where to start next time
        //  (note that I don't use a filter, to ensure that next time I start from next commits, if any)
        //  TODO Think if there is a way to exclude this call for performance reason, at least after first calls...
        this.bucket.lastCommit({}, this.options)
            .then((lastCommit) => {
            let lastBucketRevision = lastCommit ? lastCommit._id : 0;
            const sourceCursor = this.bucket._getCommitsCursor(this.filters, this.options);
            this.source = sourceCursor;
            sourceCursor
                .on("data", (doc) => {
                if (doc._id > lastBucketRevision) { // if read doc contains new commits update lastBucketRevision
                    lastBucketRevision = doc._id;
                }
                const commit = mongoHelpers_1.MongoHelpers.mongoDocToCommitData(doc);
                if (!this.push(commit)) {
                    sourceCursor.close();
                }
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
                    // change the starting point of the next read
                    this.filters.fromBucketRevision = lastBucketRevision + 1;
                    this.emit("wait", { filters: this.filters });
                    this._startTimer();
                }
            });
            // isPaused because is missing from Readable stream...
            if (this.isPaused()) {
                sourceCursor.pause();
            }
        });
    }
}
exports.ProjectionStream = ProjectionStream;
//# sourceMappingURL=ProjectionStream.js.map