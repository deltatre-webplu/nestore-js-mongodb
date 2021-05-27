"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const index_1 = require("../src/index");
const mongodb_1 = require("mongodb");
const config = require("./config.json"); // tslint:disable-line
describe("EventStore", function () {
    this.slow(500);
    this.timeout(20000);
    before(function () { });
    after(function () { });
    describe("When connected", function () {
        let eventStore;
        beforeEach(function () {
            return __awaiter(this, void 0, void 0, function* () {
                eventStore = new index_1.EventStore(config);
                yield eventStore.connect();
            });
        });
        afterEach(function () {
            return __awaiter(this, void 0, void 0, function* () {
                if (!eventStore || !eventStore.db) {
                    return;
                }
                yield eventStore.close();
            });
        });
        it("should have a database instance", function () {
            chai_1.assert.isNotNull(eventStore.db);
        });
        describe("Giving a bucket", function () {
            let bucket;
            let SAMPLE_BUCKETNAME;
            function insertSampleBucket(docs) {
                const col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);
                const mongoDbDocs = docs.map((d) => {
                    const newDoc = Object.assign({}, d);
                    newDoc.StreamId = index_1.MongoHelpers.stringToBinaryUUID(newDoc.StreamId);
                    return newDoc;
                });
                return col.insertMany(mongoDbDocs);
            }
            function clearSampleBucket() {
                return __awaiter(this, void 0, void 0, function* () {
                    if (!eventStore || !eventStore.db || !SAMPLE_BUCKETNAME) {
                        return;
                    }
                    const col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);
                    try {
                        yield col.drop();
                    }
                    catch (err) {
                        // ignore if not found...
                    }
                    const colCounters = eventStore.db.collection("counters");
                    yield colCounters.deleteOne({ _id: SAMPLE_BUCKETNAME });
                });
            }
            beforeEach(function () {
                return __awaiter(this, void 0, void 0, function* () {
                    SAMPLE_BUCKETNAME = makeId();
                    bucket = eventStore.bucket(SAMPLE_BUCKETNAME);
                });
            });
            afterEach(function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield clearSampleBucket();
                });
            });
            it("should be possible to get a bucket instance", function () {
                chai_1.assert.isNotNull(bucket);
                chai_1.assert.equal(bucket.bucketName, SAMPLE_BUCKETNAME);
                chai_1.assert.equal(bucket.eventStore, eventStore);
            });
            it("should be possible to ensure indexes", function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);
                    yield bucket.ensureIndexes();
                    const indexes = yield col.indexes();
                    chai_1.assert.equal(indexes[0].name, "_id_");
                    chai_1.assert.equal(indexes[1].name, "Dispatched");
                    chai_1.assert.equal(indexes[2].name, "StreamId");
                    chai_1.assert.equal(indexes[3].name, "StreamRevision");
                });
            });
            describe("Auto Increment strategy using counters", function () {
                it("can increment counters", function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        let revision = yield eventStore.autoIncrementStrategy.increment(SAMPLE_BUCKETNAME);
                        chai_1.assert.equal(revision, 1);
                        revision = yield eventStore.autoIncrementStrategy.increment(SAMPLE_BUCKETNAME);
                        chai_1.assert.equal(revision, 2);
                        revision = yield eventStore.autoIncrementStrategy.increment(SAMPLE_BUCKETNAME);
                        chai_1.assert.equal(revision, 3);
                    });
                });
                it("can increment counters starting from last commit", function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const lastCommit = {
                            _id: 263,
                            Dispatched: true,
                            Events: ["e1"],
                            StreamId: bucket.randomStreamId(),
                            StreamRevisionStart: 1,
                            StreamRevisionEnd: 2,
                        };
                        let revision = yield eventStore.autoIncrementStrategy.increment(SAMPLE_BUCKETNAME, lastCommit);
                        chai_1.assert.equal(revision, 264);
                        revision = yield eventStore.autoIncrementStrategy.increment(SAMPLE_BUCKETNAME);
                        chai_1.assert.equal(revision, 265);
                        revision = yield eventStore.autoIncrementStrategy.increment(SAMPLE_BUCKETNAME);
                        chai_1.assert.equal(revision, 266);
                    });
                });
            });
            describe("Write commits", function () {
                it("cannot write a commit with an invalid stream id", function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const invalidStreamIds = [undefined, null, ""];
                        for (const streamId of invalidStreamIds) {
                            try {
                                yield bucket.write(streamId, 0, [""], {
                                    dispatched: true,
                                });
                            }
                            catch (err) {
                                // error expected
                                chai_1.assert.equal(err.message, "Invalid stream id");
                                continue;
                            }
                            throw new Error(`Expected to fail with stream id '${streamId}'`);
                        }
                    });
                });
                it("cannot write a commit with an invalid stream revision", function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const streamRevision = -1;
                        try {
                            yield bucket.write(bucket.randomStreamId(), streamRevision, [""], {
                                dispatched: true,
                            });
                        }
                        catch (err) {
                            // error expected
                            chai_1.assert.equal(err.message, "Invalid stream revision");
                            return;
                        }
                        throw new Error(`Expected to fail with stream revision '${streamRevision}'`);
                    });
                });
                it("cannot write a commit with an invalid events", function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const streamRevision = 0;
                        try {
                            yield bucket.write(bucket.randomStreamId(), streamRevision, [], {
                                dispatched: true,
                            });
                        }
                        catch (err) {
                            // error expected
                            chai_1.assert.equal(err.message, "Invalid stream events");
                            return;
                        }
                        throw new Error(`Expected to fail with empty stream events`);
                    });
                });
                describe("Write commits with existing data", function () {
                    beforeEach(function () {
                        return __awaiter(this, void 0, void 0, function* () {
                            yield insertSampleBucket([
                                SAMPLE_EVENT2,
                                SAMPLE_EVENT3,
                                SAMPLE_EVENT1,
                            ]);
                        });
                    });
                    it("cannot write a commit with an old stream revision", function () {
                        return __awaiter(this, void 0, void 0, function* () {
                            const streamRevision = 0;
                            try {
                                yield bucket.write(SAMPLE_EVENT1.StreamId, streamRevision, [""], {
                                    dispatched: true,
                                });
                            }
                            catch (err) {
                                // error expected
                                chai_1.assert.isTrue(err instanceof index_1.ConcurrencyError);
                                chai_1.assert.equal(err.errorType, "ConcurrencyError");
                                chai_1.assert.equal(err.currentStreamRevision, 3);
                                return;
                            }
                            throw new Error(`Expected to fail with a concurrency error`);
                        });
                    });
                    it("cannot write a commit with a stream revision already used", function () {
                        return __awaiter(this, void 0, void 0, function* () {
                            const streamRevision = 2;
                            try {
                                yield bucket.write(SAMPLE_EVENT1.StreamId, streamRevision, [""], {
                                    dispatched: true,
                                });
                            }
                            catch (err) {
                                // error expected
                                chai_1.assert.isTrue(err instanceof index_1.ConcurrencyError);
                                chai_1.assert.equal(err.errorType, "ConcurrencyError");
                                chai_1.assert.equal(err.currentStreamRevision, 3);
                                return;
                            }
                            throw new Error(`Expected to fail`);
                        });
                    });
                    it("cannot write a commit with a stream revision not sequential", function () {
                        return __awaiter(this, void 0, void 0, function* () {
                            const streamRevision = 4;
                            try {
                                yield bucket.write(SAMPLE_EVENT1.StreamId, streamRevision, [""], {
                                    dispatched: true,
                                });
                            }
                            catch (err) {
                                // error expected
                                chai_1.assert.equal(err.message, "Invalid stream revision, expected '3'");
                                return;
                            }
                            throw new Error(`Expected to fail`);
                        });
                    });
                    it("cannot write a commit if there are undispatched events", function () {
                        return __awaiter(this, void 0, void 0, function* () {
                            yield insertSampleBucket([SAMPLE_EVENT4_NOT_DISPATCHED]);
                            const streamRevision = 2;
                            try {
                                yield bucket.write(SAMPLE_EVENT4_NOT_DISPATCHED.StreamId, streamRevision, [""], { dispatched: true });
                            }
                            catch (err) {
                                // error expected
                                chai_1.assert.isTrue(err instanceof index_1.UndispatchedEventsFoundError, err.message);
                                return;
                            }
                            throw new Error(`Expected to fail`);
                        });
                    });
                });
                it("write an event", function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const streamId = bucket.randomStreamId();
                        yield bucket.write(streamId, 0, ["e1"], { dispatched: true });
                        const commits = yield bucket.getCommitsArray({ streamId });
                        chai_1.assert.equal(commits.length, 1);
                        chai_1.assert.equal(commits[0]._id, 1);
                        chai_1.assert.equal(commits[0].Dispatched, true);
                        chai_1.assert.equal(commits[0].Events[0], "e1");
                        chai_1.assert.equal(commits[0].StreamId, streamId);
                        chai_1.assert.equal(commits[0].StreamRevisionStart, 0);
                        chai_1.assert.equal(commits[0].StreamRevisionEnd, 1);
                    });
                });
                it("write multiple events", function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const streamId = bucket.randomStreamId();
                        yield bucket.write(streamId, 0, ["e1", "e2"], { dispatched: true });
                        const commits = yield bucket.getCommitsArray({ streamId });
                        chai_1.assert.equal(commits.length, 1);
                        chai_1.assert.equal(commits[0]._id, 1);
                        chai_1.assert.equal(commits[0].Dispatched, true);
                        chai_1.assert.equal(commits[0].Events[0], "e1");
                        chai_1.assert.equal(commits[0].Events[1], "e2");
                        chai_1.assert.equal(commits[0].StreamId, streamId);
                        chai_1.assert.equal(commits[0].StreamRevisionStart, 0);
                        chai_1.assert.equal(commits[0].StreamRevisionEnd, 2);
                    });
                });
                it("write multiple commits", function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const streamId = bucket.randomStreamId();
                        yield bucket.write(streamId, 0, ["e1", "e2"], { dispatched: true });
                        yield bucket.write(streamId, 2, ["e3", "e4"], { dispatched: true });
                        const commits = yield bucket.getCommitsArray({ streamId });
                        chai_1.assert.equal(commits.length, 2);
                        chai_1.assert.equal(commits[0]._id, 1);
                        chai_1.assert.equal(commits[0].Dispatched, true);
                        chai_1.assert.equal(commits[0].Events[0], "e1");
                        chai_1.assert.equal(commits[0].Events[1], "e2");
                        chai_1.assert.equal(commits[0].StreamId, streamId);
                        chai_1.assert.equal(commits[0].StreamRevisionStart, 0);
                        chai_1.assert.equal(commits[0].StreamRevisionEnd, 2);
                        chai_1.assert.equal(commits[1]._id, 2);
                        chai_1.assert.equal(commits[1].Dispatched, true);
                        chai_1.assert.equal(commits[1].Events[0], "e3");
                        chai_1.assert.equal(commits[1].Events[1], "e4");
                        chai_1.assert.equal(commits[1].StreamId, streamId);
                        chai_1.assert.equal(commits[1].StreamRevisionStart, 2);
                        chai_1.assert.equal(commits[1].StreamRevisionEnd, 4);
                    });
                });
            });
            describe("Read commits", function () {
                beforeEach(function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield insertSampleBucket([
                            SAMPLE_EVENT2,
                            SAMPLE_EVENT3,
                            SAMPLE_EVENT1,
                        ]);
                    });
                });
                it("should be possible to read commits as array (default ascending)", function () {
                    return bucket.getCommitsArray().then((docs) => {
                        chai_1.assert.equal(docs.length, 3);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT1);
                        chai_1.assert.deepEqual(docs[1], SAMPLE_EVENT2);
                        chai_1.assert.deepEqual(docs[2], SAMPLE_EVENT3);
                    });
                });
                it("should be possible to read commits as array ascending", function () {
                    return bucket
                        .getCommitsArray(undefined, { sortDirection: 1 })
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 3);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT1);
                        chai_1.assert.deepEqual(docs[1], SAMPLE_EVENT2);
                        chai_1.assert.deepEqual(docs[2], SAMPLE_EVENT3);
                    });
                });
                it("should be possible to read commits as array descending", function () {
                    return bucket
                        .getCommitsArray(undefined, { sortDirection: -1 })
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 3);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT3);
                        chai_1.assert.deepEqual(docs[1], SAMPLE_EVENT2);
                        chai_1.assert.deepEqual(docs[2], SAMPLE_EVENT1);
                    });
                });
                it("should be possible to read commits using read preference", function () {
                    return bucket
                        .getCommitsArray(undefined, {
                        readPreference: mongodb_1.ReadPreference.SECONDARY_PREFERRED,
                    })
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 3);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT1);
                        chai_1.assert.deepEqual(docs[1], SAMPLE_EVENT2);
                        chai_1.assert.deepEqual(docs[2], SAMPLE_EVENT3);
                    });
                });
                it("should be possible to get last commit", function () {
                    return bucket.lastCommit().then((doc) => {
                        chai_1.assert.deepEqual(doc, SAMPLE_EVENT3);
                    });
                });
                it("should be possible to read commits and undispatched are not returned", function () {
                    return insertSampleBucket([SAMPLE_EVENT4_NOT_DISPATCHED])
                        .then(() => bucket.getCommitsArray())
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 3);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT1);
                        chai_1.assert.deepEqual(docs[1], SAMPLE_EVENT2);
                        chai_1.assert.deepEqual(docs[2], SAMPLE_EVENT3);
                    });
                });
                it("should be possible to read commits with also undispatched", function () {
                    return insertSampleBucket([SAMPLE_EVENT4_NOT_DISPATCHED])
                        .then(() => bucket.getCommitsArray({ dispatched: -1 }))
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 4);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT1);
                        chai_1.assert.deepEqual(docs[1], SAMPLE_EVENT2);
                        chai_1.assert.deepEqual(docs[2], SAMPLE_EVENT3);
                        chai_1.assert.deepEqual(docs[3], SAMPLE_EVENT4_NOT_DISPATCHED);
                    });
                });
                it("should be possible to read commits only undispatched", function () {
                    return insertSampleBucket([SAMPLE_EVENT4_NOT_DISPATCHED])
                        .then(() => bucket.getCommitsArray({ dispatched: 0 }))
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 1);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT4_NOT_DISPATCHED);
                    });
                });
                it("should be possible to read commits filtering by event properties", function () {
                    return bucket
                        .getCommitsArray({
                        eventFilters: { Field1: "X" },
                    })
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 1);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT3);
                    });
                });
                it("should be possible to read commits filtering by bucket revision", function () {
                    return bucket
                        .getCommitsArray({ fromBucketRevision: 2, toBucketRevision: 2 })
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 1);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT2);
                    });
                });
                it("should be possible to read 2 commits filtering by bucket revision ascending", function () {
                    return bucket
                        .getCommitsArray({ fromBucketRevision: 2, toBucketRevision: 3 }, { sortDirection: 1 })
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 2);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT2);
                        chai_1.assert.deepEqual(docs[1], SAMPLE_EVENT3);
                    });
                });
                it("should be possible to read 2 commits filtering by bucket revision descending", function () {
                    return bucket
                        .getCommitsArray({ fromBucketRevision: 3, toBucketRevision: 2 }, { sortDirection: -1 })
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 2);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT3);
                        chai_1.assert.deepEqual(docs[1], SAMPLE_EVENT2);
                    });
                });
                it("should be possible to read 1 commits using limit ascending", function () {
                    return bucket
                        .getCommitsArray({}, { sortDirection: 1, limit: 1 })
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 1);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT1);
                    });
                });
                it("should be possible to read 1 commits using limit descending", function () {
                    return bucket
                        .getCommitsArray({}, { sortDirection: -1, limit: 1 })
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 1);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT3);
                    });
                });
                it("should be possible to read commits filtering by stream id", function () {
                    return bucket
                        .getCommitsArray({
                        streamId: "30000003-3003-3003-3003-300000000003",
                    })
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 1);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT3);
                    });
                });
                it("should be possible to get a commit by id", function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        const doc = yield bucket.getCommitById(SAMPLE_EVENT1._id);
                        if (!doc) {
                            throw new Error("Commit not found");
                        }
                        chai_1.assert.equal(typeof doc._id, "number");
                        chai_1.assert.equal(typeof doc.StreamId, "string");
                        chai_1.assert.isTrue(doc.Events instanceof Array);
                        chai_1.assert.deepEqual(doc, SAMPLE_EVENT1);
                    });
                });
                it("should not be possible to update commit events with a different events number", function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        // Clone events
                        const newEvents = [...SAMPLE_EVENT1.Events, ...SAMPLE_EVENT2.Events];
                        try {
                            yield bucket.updateCommit(SAMPLE_EVENT1._id, newEvents);
                            chai_1.assert.fail("Should throw an error");
                        }
                        catch (err) {
                            chai_1.assert.equal("Events count must be the same", err.message);
                        }
                    });
                });
                it("should be possible to update commit events", function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        let doc = yield bucket.getCommitById(SAMPLE_EVENT1._id);
                        chai_1.assert.deepEqual(doc, SAMPLE_EVENT1);
                        // Clone events
                        const newEvents = Array.from(SAMPLE_EVENT1.Events);
                        newEvents[0] = Object.assign({}, newEvents[0]);
                        newEvents[0].Field1 = "A modified";
                        // Update events
                        yield bucket.updateCommit(SAMPLE_EVENT1._id, newEvents);
                        doc = yield bucket.getCommitById(SAMPLE_EVENT1._id);
                        if (!doc) {
                            throw new Error("Commit not found");
                        }
                        chai_1.assert.notDeepEqual(doc, SAMPLE_EVENT1);
                        chai_1.assert.equal(doc.Events[0].Field1, "A modified");
                        // if I restore the old value then all other properties should be the same
                        doc.Events[0].Field1 = SAMPLE_EVENT1.Events[0].Field1;
                        chai_1.assert.deepEqual(doc, SAMPLE_EVENT1);
                    });
                });
                describe("Read commits filtering by stream id", function () {
                    beforeEach(function () {
                        return __awaiter(this, void 0, void 0, function* () {
                            yield insertSampleBucket([
                                STREAM_SAMPLE_EVENT_5,
                                STREAM_SAMPLE_EVENT_6,
                                STREAM_SAMPLE_EVENT_7,
                            ]);
                        });
                    });
                    it("should be possible to read 2 commits filtering by bucket revision ascending", function () {
                        return bucket
                            .getCommitsArray({ fromBucketRevision: 6, streamId: STEAM_SAMPLE_ID }, { limit: 2, sortDirection: 1 })
                            .then((docs) => {
                            chai_1.assert.equal(docs.length, 2);
                            chai_1.assert.deepEqual(docs[0], STREAM_SAMPLE_EVENT_6);
                            chai_1.assert.deepEqual(docs[1], STREAM_SAMPLE_EVENT_7);
                        });
                    });
                    it("should be possible to read 2 commits filtering by bucket revision descending", function () {
                        return bucket
                            .getCommitsArray({ fromBucketRevision: 6, streamId: STEAM_SAMPLE_ID }, { limit: 2, sortDirection: -1 })
                            .then((docs) => {
                            chai_1.assert.equal(docs.length, 2);
                            chai_1.assert.deepEqual(docs[0], STREAM_SAMPLE_EVENT_6);
                            chai_1.assert.deepEqual(docs[1], STREAM_SAMPLE_EVENT_5);
                        });
                    });
                });
            });
        });
    });
});
function makeId() {
    let text = "";
    const possible = "abcdefghijklmnopqrstuvwxyz";
    for (let i = 0; i < 5; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
const SAMPLE_EVENT1 = {
    _id: 1,
    StreamId: "20000002-2002-2002-2002-200000000002",
    StreamRevisionStart: 0,
    StreamRevisionEnd: 1,
    Dispatched: true,
    Events: [
        {
            _t: "MyEventA",
            Field1: "A",
        },
    ],
};
const SAMPLE_EVENT2 = {
    _id: 2,
    StreamId: "20000002-2002-2002-2002-200000000002",
    StreamRevisionStart: 1,
    StreamRevisionEnd: 3,
    Dispatched: true,
    Events: [
        {
            _t: "MyEventA",
            Field1: "A",
        },
        {
            _t: "MyEventB",
            Field1: "B",
        },
    ],
};
const SAMPLE_EVENT3 = {
    _id: 3,
    StreamId: "30000003-3003-3003-3003-300000000003",
    StreamRevisionStart: 0,
    StreamRevisionEnd: 1,
    Dispatched: true,
    Events: [
        {
            _t: "MyEventX",
            Field1: "X",
        },
    ],
};
const SAMPLE_EVENT4_NOT_DISPATCHED = {
    _id: 4,
    StreamId: "30000003-3003-3003-3003-300000000003",
    StreamRevisionStart: 1,
    StreamRevisionEnd: 2,
    Dispatched: false,
    Events: [
        {
            _t: "MyEventX",
            Field1: "Y",
        },
    ],
};
const STEAM_SAMPLE_ID = "50000005-5005-5005-5005-500000000005";
const STREAM_SAMPLE_EVENT_5 = {
    _id: 5,
    StreamId: STEAM_SAMPLE_ID,
    StreamRevisionStart: 0,
    StreamRevisionEnd: 1,
    Dispatched: true,
    Events: [
        {
            _t: "MyEventA",
            Field1: "A",
        },
    ],
};
const STREAM_SAMPLE_EVENT_6 = {
    _id: 6,
    StreamId: STEAM_SAMPLE_ID,
    StreamRevisionStart: 1,
    StreamRevisionEnd: 2,
    Dispatched: true,
    Events: [
        {
            _t: "MyEventA",
            Field1: "A",
        },
    ],
};
const STREAM_SAMPLE_EVENT_7 = {
    _id: 7,
    StreamId: STEAM_SAMPLE_ID,
    StreamRevisionStart: 2,
    StreamRevisionEnd: 3,
    Dispatched: true,
    Events: [
        {
            _t: "MyEventX",
            Field1: "X",
        },
    ],
};
//# sourceMappingURL=EventStore.test.js.map