"use strict";

const EventStore = require("../index").EventStore;
const helpers = require("../index").MongoHelpers;

// set SAMPLE_URL=mongodb://localhost:27017/Forge
const sampleUrl = process.env.SAMPLE_URL;

function waitForEnter(){
	const readline = require("readline");

	const rl = readline.createInterface({
		input: process.stdin
	});

	return new Promise((resolve) => {
		rl.on("line", () => {
			rl.close();
			resolve();
		});
	});
}

let eventStore = new EventStore({url: sampleUrl});

eventStore.connect()
.then(() => {
	let bucket = eventStore.bucket("wcm");

	let filters = {
		eventFilters : {
			"_t" : /^(Entity)?Published\<.+\>$/,
			"EventDateTime" : { $gt: new Date(2015, 10, 18)}
		}
	};
	let options = {
		waitInterval : 1000
	};
	let projection = bucket.projectionStream(filters, options);

	projection
	.on("data", (doc) => {
		// if this is a publish event
		let publishEvent = doc.Events.find(e => /^(Entity)?Published\<.+\>$/.test(e._t));
		if (publishEvent)
			console.log("Published", helpers.binaryUUIDToString(publishEvent.AggregateId));
	})
	.on("wait", (data) => {
		console.log("Wait...(press enter to exit) ", data.filters.fromBucketRevision);
	})
	.on("close", () => {
		console.log("Closed");
	});

	return waitForEnter()
	.then(() => projection.close());
})
.then(() => {
	eventStore.close();
})
.catch((err) => {
	eventStore.close();
	console.error(err);
});
