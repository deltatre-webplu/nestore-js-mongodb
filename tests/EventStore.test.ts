"use strict";

import {assert} from "chai";
import {EventStore, MongoHelpers, Bucket, CommitData} from "../index";

const config = require("./config.json"); // tslint:disable-line

describe("EventStore", function() {
	this.slow(500);
	this.timeout(20000);

	let SAMPLE_BUCKETNAME: string;

	before(function() {
		SAMPLE_BUCKETNAME = makeId();
	});

	after(function() {
	});

	describe("When connected", function(){
		let eventStore: EventStore;

		function insertSampleBucket(docs: CommitData[]) {
			const col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);

			const mongoDbDocs = docs.map((d) => {
				const newDoc = Object.assign({}, d) as any;
				newDoc.StreamId = MongoHelpers.stringToBinaryUUID(newDoc.StreamId);
				return newDoc;
			});

			return col.insertMany(mongoDbDocs);
		}

		function clearSampleBucket() {
			const col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);
			return col.drop();
		}

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

			beforeEach(async function() {
				bucket = eventStore.bucket(SAMPLE_BUCKETNAME);
			});

			afterEach(async function() {
			});

			it("should be possible to get a bucket instance", function() {
				assert.isNotNull(bucket);
				assert.equal(bucket.bucketName, SAMPLE_BUCKETNAME);
				assert.equal(bucket.eventStore, eventStore);
			});

			describe("Write commits", function(){

			});

			describe("Read commits", function(){

				beforeEach(async function() {
					await insertSampleBucket([SAMPLE_EVENT2, SAMPLE_EVENT3, SAMPLE_EVENT1]);
				});

				afterEach(async function() {
					await clearSampleBucket();
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
