"use strict";

const assert = require("chai").assert;
const EventStore = require("../index").EventStore;
const helpers = require("../index").MongoHelpers;
const config = require("./config.json");

describe("EventStore", function() {
	this.timeout(20000);

	function makeId()	{
		var text = "";
		var possible = "abcdefghijklmnopqrstuvwxyz";

		for( var i=0; i < 5; i++ )
			text += possible.charAt(Math.floor(Math.random() * possible.length));

		return text;
	}

	const SAMPLE_BUCKETNAME = makeId();

	var SAMPLE_EVENT1 = {
		"_id" : 1,
		"StreamId" : helpers.stringToBinaryUUID("20000002-2002-2002-2002-200000000002"),
		"StreamRevisionStart" : 0,
		"StreamRevisionEnd" : 1,
		"Dispatched" : true,
		"Events" : [
			{
				"_t" : "MyEventA",
				"Field1" : "A"
			}
		]
	};
	var SAMPLE_EVENT2 = {
		"_id" : 2,
		"StreamId" : helpers.stringToBinaryUUID("20000002-2002-2002-2002-200000000002"),
		"StreamRevisionStart" : 1,
		"StreamRevisionEnd" : 3,
		"Dispatched" : true,
		"Events" : [
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
	var SAMPLE_EVENT3 = {
		"_id" : 3,
		"StreamId" : helpers.stringToBinaryUUID("30000003-3003-3003-3003-300000000003"),
		"StreamRevisionStart" : 0,
		"StreamRevisionEnd" : 1,
		"Dispatched" : true,
		"Events" : [
			{
				"_t" : "MyEventX",
				"Field1" : "X"
			}
		]
	};
	var SAMPLE_EVENT4 = {
		"_id" : 4,
		"StreamId" : helpers.stringToBinaryUUID("30000003-3003-3003-3003-300000000003"),
		"StreamRevisionStart" : 1,
		"StreamRevisionEnd" : 2,
		"Dispatched" : true,
		"Events" : [
			{
				"_t" : "MyEventX",
				"Field1" : "Y"
			}
		]
	};
	var SAMPLE_EVENT4_NOT_DISPATCHED = {
		"_id" : 4,
		"StreamId" : helpers.stringToBinaryUUID("30000003-3003-3003-3003-300000000003"),
		"StreamRevisionStart" : 1,
		"StreamRevisionEnd" : 2,
		"Dispatched" : false,
		"Events" : [
			{
				"_t" : "MyEventX",
				"Field1" : "Y"
			}
		]
	};

	before(function() {
	});

	after(function() {
	});

	describe("When connected", function(){
		let eventStore;

		function insertSampleBucket(docs){
			let col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);
			return col.insertMany(docs);
		}

		function clearSampleBucket(){
			let col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);
			return col.drop();
		}

		beforeEach(function() {
			eventStore = new EventStore(config);
			return eventStore.connect()
			.then(() => insertSampleBucket([SAMPLE_EVENT2, SAMPLE_EVENT3, SAMPLE_EVENT1]));
		});

		afterEach(function(){
			if (!eventStore || !eventStore.db)
				return;

			return clearSampleBucket()
			.then(() => {
				eventStore.close();
			});
		});

		it("should have a database instance", function() {
			assert.isNotNull(eventStore.db);
		});

		describe("Giving a bucket", function(){
			let bucket;

			beforeEach(function() {
				bucket = eventStore.bucket(SAMPLE_BUCKETNAME);
			});

			it("should be possible to get a bucket instance", function() {
				assert.isNotNull(bucket);
				assert.equal(bucket.bucketName, SAMPLE_BUCKETNAME);
				assert.equal(bucket.eventStore, eventStore);
			});

			it("should be possible to read commits as stream", function() {
				let stream = bucket.getCommitsStream({});
				let docs = [];
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
					assert.equal(docs.length, 3);
					assert.deepEqual(docs[0], SAMPLE_EVENT1);
					assert.deepEqual(docs[1], SAMPLE_EVENT2);
					assert.deepEqual(docs[2], SAMPLE_EVENT3);
				});

			});

			it("should be possible to create a projection stream", function() {
				let projection = bucket.projectionStream();
				let docs = [];

				return new Promise((resolve, reject) => {
					projection
					.on("data", (doc) => {
						docs.push(doc);
						if (doc._id == 3){ // when last event is read close the projection
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
				let projection = bucket.projectionStream({}, {waitInterval : 100});
				let docs = [];
				let waitCalls = 0;

				return new Promise((resolve, reject) => {
					projection
					.on("data", (doc) => {
						docs.push(doc);
						if (doc._id == 4){ // when last event is read close the projection
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

			it("should be possible to create a projection stream and when wait for new events start from the last one", function() {
				let projection = bucket.projectionStream({ eventFilters: { Field1: "Y" } }, {waitInterval : 100});
				let docs = [];
				let waitCalls = 0;

				return new Promise((resolve, reject) => {
					projection
					.on("data", (doc) => {
						docs.push(doc);
						if (doc._id == 4){ // when last event is read close the projection
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
				let projection = bucket.projectionStream({}, {waitInterval : 100});

				var projectionChecks = new Promise((resolve, reject) => {
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
				return bucket.getCommitsArray({streamId: helpers.stringToBinaryUUID("30000003-3003-3003-3003-300000000003") })
				.then((docs) => {
					assert.equal(docs.length, 1);
					assert.deepEqual(docs[0], SAMPLE_EVENT3);
				});
			});
		});
	});
});
