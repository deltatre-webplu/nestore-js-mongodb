"use strict";

const EventStore = require("../index").EventStore;
const ProgressLogger = require("progress-logger-js");

// set SAMPLE_URL=mongodb://localhost:27017/Forge
const sampleUrl = process.env.SAMPLE_URL;

let progress = new ProgressLogger();
let eventStore = new EventStore({url: sampleUrl});

eventStore.connect()
.then(() => {
	let bucket = eventStore.bucket("wcm");

	let lastRevision = 0;

	let filters = {
		fromBucketRevision: lastRevision,
		eventFilters : {
			EventDateTime : { $gt : new Date(2016, 9, 1) }
			//_t : /^(Entity)?Published\<.+\>/
		}
	};
	let stream = bucket.getCommitsStream(filters);
	return new Promise((resolve, reject) => {
		stream
		.on("data", (doc) => {
			progress.increment();
			lastRevision = doc._id;
		})
		.on("error", (err) => {
			stream.close();
			reject(err);
		})
		.on("end", () => {
			progress.end();
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
