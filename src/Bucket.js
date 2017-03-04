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
const mongoHelpers_1 = require("./mongoHelpers");
const debug = createDebug("nestore.Bucket");
class Bucket {
    constructor(eventStore, bucketName) {
        this.eventStore = eventStore;
        this.bucketName = bucketName;
        this.collection = this.eventStore.mongoCollection(bucketName);
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