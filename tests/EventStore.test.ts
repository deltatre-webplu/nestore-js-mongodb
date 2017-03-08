"use strict";

import {assert} from "chai";
import {EventStore, MongoHelpers, Bucket, CommitData,
	ConcurrencyError, UndispatchedEventsFoundError} from "../index";

const config = require("./config.json"); // tslint:disable-line

describe("EventStore", function() {
	this.slow(500);
	this.timeout(20000);

	before(function() {
	});

	after(function() {
	});

	describe("When connected", function(){
		let eventStore: EventStore;

		beforeEach(async function() {
			eventStore = new EventStore(config);
			await eventStore.connect();
		});

		afterEach(async function(){
			if (!eventStore || !eventStore.db) {
				return;
			}

			await eventStore.close();
		});

		it("should have a database instance", function() {
			assert.isNotNull(eventStore.db);
		});

		describe("Giving a bucket", function(){
			let bucket: Bucket;
			let SAMPLE_BUCKETNAME: string;

			function insertSampleBucket(docs: CommitData[]) {
				const col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);

				const mongoDbDocs = docs.map((d) => {
					const newDoc = Object.assign({}, d) as any;
					newDoc.StreamId = MongoHelpers.stringToBinaryUUID(newDoc.StreamId);
					return newDoc;
				});

				return col.insertMany(mongoDbDocs);
			}

			async function clearSampleBucket() {
				if (!eventStore || !eventStore.db || !SAMPLE_BUCKETNAME) {
					return;
				}
				const col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);
				try {
					await col.drop();
				} catch (err) {
					// ignore if not found...
				}

				const colCounters = eventStore.db.collection("counters");

				await colCounters.deleteOne({ _id: SAMPLE_BUCKETNAME });
			}

			beforeEach(async function() {
				SAMPLE_BUCKETNAME = makeId();
				bucket = eventStore.bucket(SAMPLE_BUCKETNAME);
			});

			afterEach(async function() {
				await clearSampleBucket();
			});

			it("should be possible to get a bucket instance", function() {
				assert.isNotNull(bucket);
				assert.equal(bucket.bucketName, SAMPLE_BUCKETNAME);
				assert.equal(bucket.eventStore, eventStore);
			});

			it("should be possible to ensure indexes", async function() {
				const col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);

				await bucket.ensureIndexes();

				const indexes = await col.indexes();

				assert.equal(indexes[0].name, "_id_");
				assert.equal(indexes[1].name, "Dispatched");
				assert.equal(indexes[2].name, "StreamId");
				assert.equal(indexes[3].name, "StreamRevision");
			});

			describe("Auto Increment strategy using counters", function() {

				it("can increment counters", async function() {
					let revision = await eventStore.autoIncrementStrategy.increment(SAMPLE_BUCKETNAME);
					assert.equal(revision, 1);
					revision = await eventStore.autoIncrementStrategy.increment(SAMPLE_BUCKETNAME);
					assert.equal(revision, 2);
					revision = await eventStore.autoIncrementStrategy.increment(SAMPLE_BUCKETNAME);
					assert.equal(revision, 3);
				});

				it("can increment counters starting from last commit", async function() {
					const lastCommit: CommitData = {
						_id: 263,
						Dispatched: true,
						Events: ["e1"],
						StreamId: bucket.randomStreamId(),
						StreamRevisionStart: 1,
						StreamRevisionEnd: 2
					};
					let revision = await eventStore.autoIncrementStrategy.increment(SAMPLE_BUCKETNAME, lastCommit);
					assert.equal(revision, 264);
					revision = await eventStore.autoIncrementStrategy.increment(SAMPLE_BUCKETNAME);
					assert.equal(revision, 265);
					revision = await eventStore.autoIncrementStrategy.increment(SAMPLE_BUCKETNAME);
					assert.equal(revision, 266);
				});
			});

			describe("Write commits", function(){

				it("cannot write a commit with an invalid stream id", async function() {
					const invalidStreamIds = [undefined, null, ""];

					for (const streamId of invalidStreamIds) {
						try {
							await bucket.write(streamId as any, 0, [""], { dispatched: true });
						} catch (err) {
							// error expected
							assert.equal(err.message, "Invalid stream id");
							continue;
						}

						throw new Error(`Expected to fail with stream id '${streamId}'`);
					}

				});

				it("cannot write a commit with an invalid stream revision", async function() {
					const streamRevision = -1;

					try {
						await bucket.write(bucket.randomStreamId(), streamRevision, [""], { dispatched: true });
					} catch (err) {
						// error expected
						assert.equal(err.message, "Invalid stream revision");
						return;
					}

					throw new Error(`Expected to fail with stream revision '${streamRevision}'`);
				});

				it("cannot write a commit with an invalid events", async function() {
					const streamRevision = 0;

					try {
						await bucket.write(bucket.randomStreamId(), streamRevision, [], { dispatched: true });
					} catch (err) {
						// error expected
						assert.equal(err.message, "Invalid stream events");
						return;
					}

					throw new Error(`Expected to fail with empty stream events`);
				});

				describe("Write commits with existing data", function() {
					beforeEach(async function() {
						await insertSampleBucket([SAMPLE_EVENT2, SAMPLE_EVENT3, SAMPLE_EVENT1]);
					});

					it("cannot write a commit with an old stream revision", async function() {
						const streamRevision = 0;

						try {

							await bucket.write(SAMPLE_EVENT1.StreamId, streamRevision, [""], { dispatched: true });
						} catch (err) {
							// error expected
							assert.isTrue(err instanceof ConcurrencyError);
							return;
						}

						throw new Error(`Expected to fail with a concurrency error`);
					});

					it("cannot write a commit with a stream revision already used", async function() {
						const streamRevision = 2;

						try {
							await bucket.write(SAMPLE_EVENT1.StreamId, streamRevision, [""], { dispatched: true });
						} catch (err) {
							// error expected
							assert.isTrue(err instanceof ConcurrencyError);
							return;
						}

						throw new Error(`Expected to fail`);
					});

					it("cannot write a commit with a stream revision not sequential", async function() {
						const streamRevision = 4;

						try {
							await bucket.write(SAMPLE_EVENT1.StreamId, streamRevision, [""], { dispatched: true });
						} catch (err) {
							// error expected
							assert.equal(err.message, "Invalid stream revision, expected '3'");
							return;
						}

						throw new Error(`Expected to fail`);
					});

					it("cannot write a commit if there are undispatched events", async function() {

						await insertSampleBucket([SAMPLE_EVENT4_NOT_DISPATCHED]);

						const streamRevision = 2;

						try {
							await bucket.write(SAMPLE_EVENT4_NOT_DISPATCHED.StreamId, streamRevision, [""], { dispatched: true });
						} catch (err) {
							// error expected
							assert.isTrue(err instanceof UndispatchedEventsFoundError, err.message);
							return;
						}

						throw new Error(`Expected to fail`);
					});

				});

				it("write an event", async function() {
					const streamId = bucket.randomStreamId();
					await bucket.write(streamId, 0, ["e1"], { dispatched: true });

					const commits = await bucket.getCommitsArray({ streamId });

					assert.equal(commits.length, 1);
					assert.equal(commits[0]._id, 1);
					assert.equal(commits[0].Dispatched, true);
					assert.equal(commits[0].Events[0], "e1");
					assert.equal(commits[0].StreamId, streamId);
					assert.equal(commits[0].StreamRevisionStart, 0);
					assert.equal(commits[0].StreamRevisionEnd, 1);
				});

				it("write multiple events", async function() {
					const streamId = bucket.randomStreamId();
					await bucket.write(streamId, 0, ["e1", "e2"], { dispatched: true });

					const commits = await bucket.getCommitsArray({ streamId });

					assert.equal(commits.length, 1);
					assert.equal(commits[0]._id, 1);
					assert.equal(commits[0].Dispatched, true);
					assert.equal(commits[0].Events[0], "e1");
					assert.equal(commits[0].Events[1], "e2");
					assert.equal(commits[0].StreamId, streamId);
					assert.equal(commits[0].StreamRevisionStart, 0);
					assert.equal(commits[0].StreamRevisionEnd, 2);
				});

				it("write multiple commits", async function() {
					const streamId = bucket.randomStreamId();

					await bucket.write(streamId, 0, ["e1", "e2"], { dispatched: true });
					await bucket.write(streamId, 2, ["e3", "e4"], { dispatched: true });

					const commits = await bucket.getCommitsArray({ streamId });

					assert.equal(commits.length, 2);
					assert.equal(commits[0]._id, 1);
					assert.equal(commits[0].Dispatched, true);
					assert.equal(commits[0].Events[0], "e1");
					assert.equal(commits[0].Events[1], "e2");
					assert.equal(commits[0].StreamId, streamId);
					assert.equal(commits[0].StreamRevisionStart, 0);
					assert.equal(commits[0].StreamRevisionEnd, 2);

					assert.equal(commits[1]._id, 2);
					assert.equal(commits[1].Dispatched, true);
					assert.equal(commits[1].Events[0], "e3");
					assert.equal(commits[1].Events[1], "e4");
					assert.equal(commits[1].StreamId, streamId);
					assert.equal(commits[1].StreamRevisionStart, 2);
					assert.equal(commits[1].StreamRevisionEnd, 4);
				});

			});

			describe("Read commits", function(){

				beforeEach(async function() {
					await insertSampleBucket([SAMPLE_EVENT2, SAMPLE_EVENT3, SAMPLE_EVENT1]);
				});

				it("should be possible to read commits as stream", function() {
					const stream = bucket.getCommitsStream({});
					const docs = new Array<CommitData>();
					return new Promise((resolve) => {
						stream
						.on("data", (doc: CommitData) => {
							docs.push(doc);
						})
						.on("end", () => {
							resolve();
						});
					})
					.then(() => {
						assert.equal(docs.length, 3);
						assert.deepEqual(docs[0], SAMPLE_EVENT1);
						assert.deepEqual(docs[1], SAMPLE_EVENT2);
						assert.deepEqual(docs[2], SAMPLE_EVENT3);
					});

				});

				it("should be possible to create a projection stream", function() {
					const projection = bucket.projectionStream();
					const docs = new Array<CommitData>();

					return new Promise((resolve, reject) => {
						projection
						.on("data", (doc: CommitData) => {
							docs.push(doc);
							if (doc._id === 3) { // when last event is read close the projection
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
						assert.equal(docs.length, 3);
						assert.deepEqual(docs[0], SAMPLE_EVENT1);
						assert.deepEqual(docs[1], SAMPLE_EVENT2);
						assert.deepEqual(docs[2], SAMPLE_EVENT3);
					});

				});

				it("should be possible to create a projection stream and wait for new events", function() {
					const projection = bucket.projectionStream({}, {waitInterval : 100});
					const docs = new Array<CommitData>();
					let waitCalls = 0;

					return new Promise((resolve, reject) => {
						projection
						.on("data", (doc: CommitData) => {
							docs.push(doc);
							if (doc._id === 4) { // when last event is read close the projection
								projection.close();
							}
						})
						.on("wait", (data) => { // when first stream is completed add a new commit
							waitCalls++;
							assert.equal(data.filters.fromBucketRevision, 4);
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
						assert.equal(waitCalls, 1);
						assert.equal(docs.length, 4);
						assert.deepEqual(docs[0], SAMPLE_EVENT1);
						assert.deepEqual(docs[1], SAMPLE_EVENT2);
						assert.deepEqual(docs[2], SAMPLE_EVENT3);
						assert.deepEqual(docs[3], SAMPLE_EVENT4);
					});
				});

				it("create a projection stream and when wait for new events start from the last one", function() {
					const projection = bucket.projectionStream({ eventFilters: { Field1: "Y" } }, {waitInterval : 100});
					const docs = new Array<CommitData>();
					let waitCalls = 0;

					return new Promise((resolve, reject) => {
						projection
						.on("data", (doc: CommitData) => {
							docs.push(doc);
							if (doc._id === 4) { // when last event is read close the projection
								projection.close();
							}
						})
						.on("wait", (data) => { // when first stream is completed add a new commit
							waitCalls++;
							assert.equal(data.filters.fromBucketRevision, 4); // check that the next stream will start from 4
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
						assert.equal(waitCalls, 1);
						assert.equal(docs.length, 1);
						assert.deepEqual(docs[0], SAMPLE_EVENT4);
					});
				});

				it("should be possible to create a projection and close it multiple times", function() {
					const projection = bucket.projectionStream({}, {waitInterval : 100});

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

				it("should be possible to read commits as array", function() {
					return bucket.getCommitsArray()
					.then((docs) => {
						assert.equal(docs.length, 3);
						assert.deepEqual(docs[0], SAMPLE_EVENT1);
						assert.deepEqual(docs[1], SAMPLE_EVENT2);
						assert.deepEqual(docs[2], SAMPLE_EVENT3);
					});
				});

				it("should be possible to get last commit", function() {
					return bucket.lastCommit()
					.then((doc) => {
						assert.deepEqual(doc, SAMPLE_EVENT3);
					});
				});

				it("should be possible to read commits and undispatched are not returned", function() {
					return insertSampleBucket([SAMPLE_EVENT4_NOT_DISPATCHED])
					.then(() => bucket.getCommitsArray())
					.then((docs) => {
						assert.equal(docs.length, 3);
						assert.deepEqual(docs[0], SAMPLE_EVENT1);
						assert.deepEqual(docs[1], SAMPLE_EVENT2);
						assert.deepEqual(docs[2], SAMPLE_EVENT3);
					});
				});

				it("should be possible to read commits with also undispatched", function() {
					return insertSampleBucket([SAMPLE_EVENT4_NOT_DISPATCHED])
					.then(() => bucket.getCommitsArray({dispatched : -1}))
					.then((docs) => {
						assert.equal(docs.length, 4);
						assert.deepEqual(docs[0], SAMPLE_EVENT1);
						assert.deepEqual(docs[1], SAMPLE_EVENT2);
						assert.deepEqual(docs[2], SAMPLE_EVENT3);
						assert.deepEqual(docs[3], SAMPLE_EVENT4_NOT_DISPATCHED);
					});
				});

				it("should be possible to read commits only undispatched", function() {
					return insertSampleBucket([SAMPLE_EVENT4_NOT_DISPATCHED])
					.then(() => bucket.getCommitsArray({dispatched : 0}))
					.then((docs) => {
						assert.equal(docs.length, 1);
						assert.deepEqual(docs[0], SAMPLE_EVENT4_NOT_DISPATCHED);
					});
				});

				it("should be possible to read commits filtering by event properties", function() {
					return bucket.getCommitsArray({
						eventFilters: { "Field1" : "X"}
					})
					.then((docs) => {
						assert.equal(docs.length, 1);
						assert.deepEqual(docs[0], SAMPLE_EVENT3);
					});
				});

				it("should be possible to read commits filtering by bucket revision", function() {
					return bucket.getCommitsArray({fromBucketRevision: 2, toBucketRevision: 2})
					.then((docs) => {
						assert.equal(docs.length, 1);
						assert.deepEqual(docs[0], SAMPLE_EVENT2);
					});
				});

				it("should be possible to read commits filtering by stream id", function() {
					return bucket.getCommitsArray({streamId: "30000003-3003-3003-3003-300000000003" })
					.then((docs) => {
						assert.equal(docs.length, 1);
						assert.deepEqual(docs[0], SAMPLE_EVENT3);
					});
				});

				it("should be possible to get a commit by id", async function() {
					const doc = await bucket.getCommitById(SAMPLE_EVENT1._id);

					if (!doc) {
						throw new Error("Commit not found");
					}

					assert.equal(typeof doc._id, "number");
					assert.equal(typeof doc.StreamId, "string");
					assert.isTrue(doc.Events instanceof Array);

					assert.deepEqual(doc, SAMPLE_EVENT1);
				});

				it("should not be possible to update commit events with a different events number", async function() {
					const doc = await bucket.getCommitById(SAMPLE_EVENT1._id);

					// Clone events
					const newEvents = [
						...SAMPLE_EVENT1.Events,
						...SAMPLE_EVENT2.Events,
					];

					try {
						await bucket.updateCommit(SAMPLE_EVENT1._id, newEvents);

						assert.fail("Should throw an error");
					} catch (err) {
						assert.equal("Events count must be the same", err.message);
					}
				});

				it("should be possible to update commit events", async function() {
					let doc = await bucket.getCommitById(SAMPLE_EVENT1._id);
					assert.deepEqual(doc, SAMPLE_EVENT1);

					// Clone events
					const newEvents = Array.from(SAMPLE_EVENT1.Events);
					newEvents[0] = Object.assign({}, newEvents[0]);
					newEvents[0].Field1 = "A modified";

					// Update events
					await bucket.updateCommit(SAMPLE_EVENT1._id, newEvents);

					doc = await bucket.getCommitById(SAMPLE_EVENT1._id);
					if (!doc) {
						throw new Error("Commit not found");
					}

					assert.notDeepEqual(doc, SAMPLE_EVENT1);
					assert.equal(doc.Events[0].Field1, "A modified");
					// if I restore the old value then all other properties should be the same
					doc.Events[0].Field1 = SAMPLE_EVENT1.Events[0].Field1;
					assert.deepEqual(doc, SAMPLE_EVENT1);
				});
			});

			describe("Read and write commits", function() {
				it("Real world usage", async function() {
					const streamId = bucket.randomStreamId();

					const projection = bucket.projectionStream({streamId}, {waitInterval : 50});

					let totals = 0;
					const donePromise = new Promise((resolve, reject) => {
						projection
						.on("data", (doc: CommitData) => {
							totals += doc.Events[0].value;

							if (doc._id === 10) { // when last event is read close the projection
								projection.close();
							}
						})
						.on("error", (err) => {
							projection.close();
							reject(err);
						})
						.on("close", () => {
							resolve(totals);
						});
					});

					for (let i = 0; i < 10; i++) {
						await bucket.write(streamId, i, [{value: i}], { dispatched: true });
					}

					assert.equal(await donePromise, 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9);
				});
			});

		});
	});
});

function makeId()	{
	let text = "";
	const possible = "abcdefghijklmnopqrstuvwxyz";

	for (let i = 0; i < 5; i++ ) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}

	return text;
}

const SAMPLE_EVENT1: CommitData = {
	_id : 1,
	StreamId : "20000002-2002-2002-2002-200000000002",
	StreamRevisionStart : 0,
	StreamRevisionEnd : 1,
	Dispatched : true,
	Events : [
		{
			_t : "MyEventA",
			Field1 : "A"
		}
	]
};
const SAMPLE_EVENT2: CommitData = {
	_id : 2,
	StreamId : "20000002-2002-2002-2002-200000000002",
	StreamRevisionStart : 1,
	StreamRevisionEnd : 3,
	Dispatched : true,
	Events : [
		{
			"_t" : "MyEventA",
			"Field1" : "A"
		},
		{
			"_t" : "MyEventB",
			"Field1" : "B"
		}
	]
};
const SAMPLE_EVENT3: CommitData = {
	_id : 3,
	StreamId : "30000003-3003-3003-3003-300000000003",
	StreamRevisionStart : 0,
	StreamRevisionEnd : 1,
	Dispatched : true,
	Events : [
		{
			"_t" : "MyEventX",
			"Field1" : "X"
		}
	]
};
const SAMPLE_EVENT4: CommitData = {
	_id : 4,
	StreamId : "30000003-3003-3003-3003-300000000003",
	StreamRevisionStart : 1,
	StreamRevisionEnd : 2,
	Dispatched : true,
	Events : [
		{
			"_t" : "MyEventX",
			"Field1" : "Y"
		}
	]
};
const SAMPLE_EVENT4_NOT_DISPATCHED: CommitData = {
	_id : 4,
	StreamId : "30000003-3003-3003-3003-300000000003",
	StreamRevisionStart : 1,
	StreamRevisionEnd : 2,
	Dispatched : false,
	Events : [
		{
			"_t" : "MyEventX",
			"Field1" : "Y"
		}
	]
};
