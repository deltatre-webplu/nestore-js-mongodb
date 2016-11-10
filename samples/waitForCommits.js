"use strict";

const EventStore = require("../src/EventStore");

// set SAMPLE_URL=mongodb://localhost:27017/Forge
const sampleUrl = process.env.SAMPLE_URL;

// function waitNext(fromRevision){
//
// }

let eventStore = new EventStore({url: sampleUrl});
eventStore.connect()
.then(() => {
	let bucket = eventStore.bucket("wcm");

	let i;
	let lastRevision = 0;

	let stream = bucket.getCommitsStream({ fromBucketRevision: lastRevision });
	return new Promise((resolve) => {
		stream
		.on("data", (doc) => {
			i++;
			console.log(i);
			lastRevision = doc._id;
		})
		.on("end", () => {
			resolve();
		});
	});
})
.then(() => {
	eventStore.close();
});
