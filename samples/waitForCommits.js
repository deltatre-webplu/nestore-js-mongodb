"use strict";

const EventStore = require("../index").EventStore;
const helpers = require("../index").MongoHelpers;

// set SAMPLE_URL=mongodb://localhost:27017/Forge
const sampleUrl = process.env.SAMPLE_URL;

let eventStore = new EventStore({url: sampleUrl});

eventStore.connect()
.then(() => {
	let bucket = eventStore.bucket("wcm");

	let stream = bucket.waitForCommitsStream();

	return new Promise((resolve, reject) => {
		stream
		.on("data", (doc) => {
			// if this is a publish event
			let publishEvent = doc.Events.find(e => /^(Entity)?Published\<.+\>/.test(e._t));
			if (publishEvent)
				console.log("Published", helpers.binaryUUIDToString(publishEvent.AggregateId));
		})
		.on("error", (err) => {
			stream.close();
			reject(err);
		})
		.on("wait", (data) => {
			console.log("wait...", data.fromBucketRevision);
		})
		.on("close", () => {
			console.log("Closed");
			resolve();
		})
		.on("end", () => {
			resolve();
		});
	});
})
.then(() => {
	eventStore.close();
})
.catch((err) => {
	eventStore.close();
	console.error(err);
});
