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
const chai_1 = require("chai");
const index_1 = require("../index");
const config = require("./config.json"); // tslint:disable-line
describe("EventStore", function () {
    this.slow(500);
    this.timeout(20000);
    let SAMPLE_BUCKETNAME;
    before(function () {
        SAMPLE_BUCKETNAME = makeId();
    });
    after(function () {
    });
    describe("When connected", function () {
        let eventStore;
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
            const col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);
            return col.drop();
        }
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
            beforeEach(function () {
                return __awaiter(this, void 0, void 0, function* () {
                    bucket = eventStore.bucket(SAMPLE_BUCKETNAME);
                });
            });
            afterEach(function () {
                return __awaiter(this, void 0, void 0, function* () {
                });
            });
            it("should be possible to get a bucket instance", function () {
                chai_1.assert.isNotNull(bucket);
                chai_1.assert.equal(bucket.bucketName, SAMPLE_BUCKETNAME);
                chai_1.assert.equal(bucket.eventStore, eventStore);
            });
            describe("Write commits", function () {
            });
            describe("Read commits", function () {
                beforeEach(function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield insertSampleBucket([SAMPLE_EVENT2, SAMPLE_EVENT3, SAMPLE_EVENT1]);
                    });
                });
                afterEach(function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield clearSampleBucket();
                    });
                });
                it("should be possible to read commits as stream", function () {
                    const stream = bucket.getCommitsStream({});
                    const docs = new Array();
                    return new Promise((resolve) => {
                        stream
                            .on("data", (doc) => {
                            docs.push(doc);
                        })
                            .on("end", () => {
                            resolve();
                        });
                    })
                        .then(() => {
                        chai_1.assert.equal(docs.length, 3);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT1);
                        chai_1.assert.deepEqual(docs[1], SAMPLE_EVENT2);
                        chai_1.assert.deepEqual(docs[2], SAMPLE_EVENT3);
                    });
                });
                it("should be possible to create a projection stream", function () {
                    const projection = bucket.projectionStream();
                    const docs = new Array();
                    return new Promise((resolve, reject) => {
                        projection
                            .on("data", (doc) => {
                            docs.push(doc);
                            if (doc._id === 3) {
                                projection.close();
                            }
                        })
                            .on("error", (err) => {
                            projection.close();
                            reject(err);
                        })
                            .on("close", () => {
                            resolve();
                        })
                            .on("end", () => {
                            reject(new Error("end should never be called"));
                        });
                    })
                        .then(() => {
                        chai_1.assert.equal(docs.length, 3);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT1);
                        chai_1.assert.deepEqual(docs[1], SAMPLE_EVENT2);
                        chai_1.assert.deepEqual(docs[2], SAMPLE_EVENT3);
                    });
                });
                it("should be possible to create a projection stream and wait for new events", function () {
                    const projection = bucket.projectionStream({}, { waitInterval: 100 });
                    const docs = new Array();
                    let waitCalls = 0;
                    return new Promise((resolve, reject) => {
                        projection
                            .on("data", (doc) => {
                            docs.push(doc);
                            if (doc._id === 4) {
                                projection.close();
                            }
                        })
                            .on("wait", (data) => {
                            waitCalls++;
                            chai_1.assert.equal(data.filters.fromBucketRevision, 4);
                            insertSampleBucket([SAMPLE_EVENT4]);
                        })
                            .on("error", (err) => {
                            projection.close();
                            reject(err);
                        })
                            .on("close", () => {
                            resolve();
                        })
                            .on("end", () => {
                            reject(new Error("end should never be called"));
                        });
                    })
                        .then(() => {
                        chai_1.assert.equal(waitCalls, 1);
                        chai_1.assert.equal(docs.length, 4);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT1);
                        chai_1.assert.deepEqual(docs[1], SAMPLE_EVENT2);
                        chai_1.assert.deepEqual(docs[2], SAMPLE_EVENT3);
                        chai_1.assert.deepEqual(docs[3], SAMPLE_EVENT4);
                    });
                });
                it("create a projection stream and when wait for new events start from the last one", function () {
                    const projection = bucket.projectionStream({ eventFilters: { Field1: "Y" } }, { waitInterval: 100 });
                    const docs = new Array();
                    let waitCalls = 0;
                    return new Promise((resolve, reject) => {
                        projection
                            .on("data", (doc) => {
                            docs.push(doc);
                            if (doc._id === 4) {
                                projection.close();
                            }
                        })
                            .on("wait", (data) => {
                            waitCalls++;
                            chai_1.assert.equal(data.filters.fromBucketRevision, 4); // check that the next stream will start from 4
                            insertSampleBucket([SAMPLE_EVENT4]);
                        })
                            .on("error", (err) => {
                            projection.close();
                            reject(err);
                        })
                            .on("close", () => {
                            resolve();
                        })
                            .on("end", () => {
                            reject(new Error("end should never be called"));
                        });
                    })
                        .then(() => {
                        chai_1.assert.equal(waitCalls, 1);
                        chai_1.assert.equal(docs.length, 1);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT4);
                    });
                });
                it("should be possible to create a projection and close it multiple times", function () {
                    const projection = bucket.projectionStream({}, { waitInterval: 100 });
                    const projectionChecks = new Promise((resolve, reject) => {
                        projection
                            .on("error", (err) => {
                            projection.close();
                            reject(err);
                        })
                            .on("close", () => {
                            resolve();
                        })
                            .on("end", () => {
                            reject(new Error("end should never be called"));
                        });
                    });
                    return projection.close()
                        .then(() => projection.close())
                        .then(() => projection.close())
                        .then(() => projectionChecks);
                });
                it("should be possible to read commits as array", function () {
                    return bucket.getCommitsArray()
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 3);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT1);
                        chai_1.assert.deepEqual(docs[1], SAMPLE_EVENT2);
                        chai_1.assert.deepEqual(docs[2], SAMPLE_EVENT3);
                    });
                });
                it("should be possible to get last commit", function () {
                    return bucket.lastCommit()
                        .then((doc) => {
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
                    return bucket.getCommitsArray({
                        eventFilters: { "Field1": "X" }
                    })
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 1);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT3);
                    });
                });
                it("should be possible to read commits filtering by bucket revision", function () {
                    return bucket.getCommitsArray({ fromBucketRevision: 2, toBucketRevision: 2 })
                        .then((docs) => {
                        chai_1.assert.equal(docs.length, 1);
                        chai_1.assert.deepEqual(docs[0], SAMPLE_EVENT2);
                    });
                });
                it("should be possible to read commits filtering by stream id", function () {
                    return bucket.getCommitsArray({ streamId: "30000003-3003-3003-3003-300000000003" })
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
                        const doc = yield bucket.getCommitById(SAMPLE_EVENT1._id);
                        // Clone events
                        const newEvents = [
                            ...SAMPLE_EVENT1.Events,
                            ...SAMPLE_EVENT2.Events,
                        ];
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
            Field1: "A"
        }
    ]
};
const SAMPLE_EVENT2 = {
    _id: 2,
    StreamId: "20000002-2002-2002-2002-200000000002",
    StreamRevisionStart: 1,
    StreamRevisionEnd: 3,
    Dispatched: true,
    Events: [
        {
            "_t": "MyEventA",
            "Field1": "A"
        },
        {
            "_t": "MyEventB",
            "Field1": "B"
        }
    ]
};
const SAMPLE_EVENT3 = {
    _id: 3,
    StreamId: "30000003-3003-3003-3003-300000000003",
    StreamRevisionStart: 0,
    StreamRevisionEnd: 1,
    Dispatched: true,
    Events: [
        {
            "_t": "MyEventX",
            "Field1": "X"
        }
    ]
};
const SAMPLE_EVENT4 = {
    _id: 4,
    StreamId: "30000003-3003-3003-3003-300000000003",
    StreamRevisionStart: 1,
    StreamRevisionEnd: 2,
    Dispatched: true,
    Events: [
        {
            "_t": "MyEventX",
            "Field1": "Y"
        }
    ]
};
const SAMPLE_EVENT4_NOT_DISPATCHED = {
    _id: 4,
    StreamId: "30000003-3003-3003-3003-300000000003",
    StreamRevisionStart: 1,
    StreamRevisionEnd: 2,
    Dispatched: false,
    Events: [
        {
            "_t": "MyEventX",
            "Field1": "Y"
        }
    ]
};
//# sourceMappingURL=EventStore.test.js.map