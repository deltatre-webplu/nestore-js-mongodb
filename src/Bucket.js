"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const createDebug = require("debug");
const ProjectionStream_1 = require("./ProjectionStream");
const nestore_types_1 = require("./nestore-types");
const mongoHelpers_1 = require("./mongoHelpers");
const uuid = require("uuid");
const debug = createDebug("nestore.Bucket");
class Bucket {
    constructor(eventStore, bucketName) {
        this.eventStore = eventStore;
        this.bucketName = bucketName;
        this.indexesEnsured = false;
        this.collection = this.eventStore.mongoCollection(bucketName);
    }
    randomStreamId() {
        return uuid.v4();
    }
    ensureIndexes() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.indexesEnsured) {
                return;
            }
            yield this.collection.createIndexes([
                // BucketRevision is _id (automatically indexed and unique)
                {
                    key: { Dispatched: 1 },
                    name: "Dispatched"
                },
                {
                    key: { StreamId: 1 },
                    name: "StreamId"
                },
                {
                    key: { StreamId: 1, StreamRevisionStart: 1 },
                    name: "StreamRevision",
                    unique: true
                }
            ]);
            this.indexesEnsured = true;
        });
    }
    write(streamId, expectedStreamRevision, events, options) {
        return __awaiter(this, void 0, void 0, function* () {
            // sanity check
            if (!streamId) {
                throw new Error("Invalid stream id");
            }
            if (expectedStreamRevision < 0) {
                throw new Error("Invalid stream revision");
            }
            if (events.length === 0) {
                throw new Error("Invalid stream events");
            }
            yield this.ensureIndexes();
            // stream revision check
            const lastCommit = yield this.lastCommit({ dispatched: -1 });
            const currentStreamRevision = lastCommit && lastCommit.StreamId === streamId
                ? lastCommit.StreamRevisionEnd
                : yield this.streamRevision(streamId);
            if (expectedStreamRevision < currentStreamRevision) {
                throw new nestore_types_1.ConcurrencyError(`Expected stream revision ${currentStreamRevision}`);
            }
            if (expectedStreamRevision > currentStreamRevision) {
                throw new Error(`Invalid stream revision, expected '${currentStreamRevision}'`);
            }
            // Check for undispatched
            if (lastCommit && lastCommit.Dispatched === false) {
                throw new nestore_types_1.UndispatchedEventsFoundError(`Undispatched events found for stream ${streamId}`);
            }
            // var commit = await CreateCommitAsync(streamId, expectedStreamRevision, eventsArray, lastCommit).ConfigureAwait(false);
            // try
            // {
            // 	await Collection.InsertOneAsync(commit)
            // 		.ConfigureAwait(false);
            // }
            // catch (MongoWriteException ex)
            // {
            // 	if (ex.IsDuplicateKeyException())
            // 		throw new ConcurrencyWriteException($"Someone else is working on the same bucket ({BucketName}) or stream ({commit.StreamId})", ex);
            // }
            // var dispatchTask = DispatchCommitAsync(commit);
            // return new WriteResult<T>(commit, dispatchTask);
            return new nestore_types_1.WriteResult();
        });
    }
    getCommitById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const doc = yield this.collection
                .findOne({ _id: id });
            return mongoHelpers_1.MongoHelpers.mongoDocToCommitData(doc);
        });
    }
    getCommitsStream(filters, options) {
        return this._getCommitsCursor(filters, options)
            .stream({
            transform: mongoHelpers_1.MongoHelpers.mongoDocToCommitData
        });
    }
    getCommitsArray(filters, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const docs = yield this._getCommitsCursor(filters, options)
                .toArray();
            return docs
                .map((d) => mongoHelpers_1.MongoHelpers.mongoDocToCommitData(d));
        });
    }
    projectionStream(filters, options) {
        filters = filters || {};
        options = options || {};
        return new ProjectionStream_1.ProjectionStream(this, filters, options);
    }
    lastCommit(filters, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const docs = yield this._getCommitsCursor(filters, options, { _id: -1 })
                .limit(1)
                .toArray();
            if (docs.length) {
                return mongoHelpers_1.MongoHelpers.mongoDocToCommitData(docs[0]);
            }
            return undefined;
        });
    }
    updateCommit(id, events) {
        return __awaiter(this, void 0, void 0, function* () {
            const commit = yield this.getCommitById(id);
            if (!commit) {
                return undefined;
            }
            if (events) {
                if (commit.Events.length !== events.length) {
                    throw new Error("Events count must be the same");
                }
                commit.Events = events;
            }
            yield this.collection.updateOne({ _id: id }, { $set: { Events: commit.Events } });
            return commit;
        });
    }
    streamRevision(streamId) {
        return __awaiter(this, void 0, void 0, function* () {
            const lastCommit = yield this.lastCommit({ streamId, dispatched: -1 });
            if (!lastCommit) {
                return 0;
            }
            return lastCommit.StreamRevisionEnd;
        });
    }
    _getCommitsCursor(filters, options, sort) {
        filters = filters || {};
        options = options || {};
        sort = sort || { _id: 1 };
        const mongoFilters = {};
        const eFilters = filters.eventFilters;
        if (eFilters) {
            Object.getOwnPropertyNames(eFilters)
                .forEach(function (name) {
                mongoFilters["Events." + name] = eFilters[name];
            });
        }
        if (!filters.hasOwnProperty("dispatched")) {
            mongoFilters.Dispatched = true;
        }
        else if (filters.dispatched === 0) {
            mongoFilters.Dispatched = false;
        }
        else if (filters.dispatched === 1) {
            mongoFilters.Dispatched = true;
        }
        else if (filters.dispatched === -1) {
            // returns all
        }
        if (filters.streamId) {
            mongoFilters.StreamId = mongoHelpers_1.MongoHelpers.stringToBinaryUUID(filters.streamId);
        }
        if (filters.fromBucketRevision || filters.toBucketRevision) {
            mongoFilters._id = {};
            if (filters.fromBucketRevision) {
                mongoFilters._id.$gte = filters.fromBucketRevision;
            }
            if (filters.toBucketRevision) {
                mongoFilters._id.$lte = filters.toBucketRevision;
            }
        }
        debug("_getCommitsCursor", mongoFilters);
        let cursor = this.collection
            .find(mongoFilters)
            .sort(sort);
        if (options.batchSize) {
            cursor = cursor.batchSize(options.batchSize);
        }
        return cursor;
    }
}
exports.Bucket = Bucket;
//# sourceMappingURL=Bucket.js.map