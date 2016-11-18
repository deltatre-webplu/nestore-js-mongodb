"use strict";

const EventStore = require("../index").EventStore;
const Projection = require("../index").Projection;
const helpers = require("../index").MongoHelpers;

// set SAMPLE_URL=mongodb://localhost:27017/Forge
let eventStore = new EventStore({url: process.env.SAMPLE_URL});

eventStore.connect()
.then(() => {
	let bucket = eventStore.bucket("wcm");

	let projection = new Projection(bucket);

	projection.on("commit", (commit) => {
		// if this is a publish event
		let publishEvent = commit.Events.find(e => /^(Entity)?Published\<.+\>/.test(e._t));
		if (publishEvent)
			console.log("Published", helpers.binaryUUIDToString(publishEvent.AggregateId));
	});

	setTimeout(() => projection.stop(), 20000);

	let filters = {
		eventFilters : {
			"EventDateTime" : { $gt: new Date(2016, 10, 18)}
		}
	};
	return projection.start(filters);
})
.then(() => {
	eventStore.close();
})
.catch((err) => {
	eventStore.close();
	console.error(err);
});
