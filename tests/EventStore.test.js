"use strict";

const assert = require("chai").assert;
const EventStore = require("../src/EventStore");
const config = require("./config.json");
const helpers = require("../src/mongoHelpers.js");

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
	const SAMPLE_COMMITS_COLLECTION = `${SAMPLE_BUCKETNAME}.commits`;

	var SAMPLE_EVENT1 = {
		"_id" : 1,
		"StreamId" : helpers.toUuid("20000002-2002-2002-2002-200000000002"),
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
		"StreamId" : helpers.toUuid("20000002-2002-2002-2002-200000000002"),
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
		"StreamId" : helpers.toUuid("30000003-3003-3003-3003-300000000003"),
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

	before(function() {
	});

	after(function() {
	});

	describe("When connected", function(){
		let eventStore;

		function insertSampleBucket(db){
			let col = db.collection(SAMPLE_COMMITS_COLLECTION);
			return col.insertMany([SAMPLE_EVENT2, SAMPLE_EVENT3, SAMPLE_EVENT1]);
		}

		function clearSampleBucket(db){
			let col = db.collection(SAMPLE_COMMITS_COLLECTION);
			return col.drop();
		}

		beforeEach(function() {
			eventStore = new EventStore(config);
			return eventStore.connect()
			.then(() => insertSampleBucket(eventStore._db));
		});

		afterEach(function(){
			if (!eventStore) return;

			clearSampleBucket(eventStore._db)
			.then(() => {
				eventStore.close();
			});
		});

		it("should have a database instance", function() {
			assert.isNotNull(eventStore._db);
		});

		it("should be possible to get a bucket instance", function() {
			let bucket = eventStore.bucket(SAMPLE_BUCKETNAME);

			assert.isNotNull(bucket);
			assert.equal(bucket._bucketName, SAMPLE_BUCKETNAME);
			assert.equal(bucket._eventStore, eventStore);
		});

		it("should be possible to read commits", function() {
			let bucket = eventStore.bucket(SAMPLE_BUCKETNAME);

			let stream = bucket.getCommits({});
			let docs = [];
			return new Promise((resolve) => {
				stream.on("data", (doc) => {
					docs.push(doc);
				});
				stream.on("end", () => {
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

	});
});
