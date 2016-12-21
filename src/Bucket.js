"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const createDebug = require("debug");
const ProjectionStream_1 = require("./ProjectionStream");
const debug = createDebug("nestore.Bucket");
class Bucket {
    constructor(eventStore, bucketName) {
        this.eventStore = eventStore;
        this.bucketName = bucketName;
        this.collection = this.eventStore.mongoCollection(bucketName);
    }
    getCommitById(id) {
        return this.collection
            .findOne({ _id: id });
    }
    getCommitsStream(filters, options) {
        return this._getCommitsCursor(filters, options)
            .stream();
    }
    getCommitsArray(filters, options) {
        return this._getCommitsCursor(filters, options)
            .toArray();
    }
    projectionStream(filters, options) {
        filters = filters || {};
        options = options || {};
        return new ProjectionStream_1.ProjectionStream(this, filters, options);
    }
    lastCommit(filters, options) {
        return this._getCommitsCursor(filters, options, { _id: -1 })
            .limit(1)
            .toArray()
            .then((data) => {
            if (data.length)
                return data[0];
            return null;
        });
    }
    updateCommit(id, events) {
        return __awaiter(this, void 0, void 0, function* () {
            let commit = yield this.getCommitById(id);
            if (!commit)
                return null;
            if (events) {
                if (commit.Events.length != events.length)
                    throw new Error("Events count must be the same");
                commit.Events = events;
            }
            yield this.collection.updateOne({ _id: id }, commit);
            return commit;
        });
    }
    _getCommitsCursor(filters, options, sort) {
        filters = filters || {};
        options = options || {};
        sort = sort || { _id: 1 };
        let mongoFilters = {};
        if (filters.eventFilters) {
            Object.getOwnPropertyNames(filters.eventFilters)
                .forEach(function (name) {
                mongoFilters["Events." + name] = filters.eventFilters[name];
            });
        }
        if (!filters.hasOwnProperty("dispatched"))
            mongoFilters.Dispatched = true;
        else if (filters.dispatched == 0)
            mongoFilters.Dispatched = false;
        else if (filters.dispatched == 1)
            mongoFilters.Dispatched = true;
        else if (filters.dispatched == -1) {
        }
        if (filters.streamId)
            mongoFilters.StreamId = filters.streamId;
        if (filters.fromBucketRevision || filters.toBucketRevision) {
            mongoFilters._id = {};
            if (filters.fromBucketRevision)
                mongoFilters._id["$gte"] = filters.fromBucketRevision;
            if (filters.toBucketRevision)
                mongoFilters._id["$lte"] = filters.toBucketRevision;
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
