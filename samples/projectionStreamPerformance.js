"use strict";

const EventStore = require("../index").EventStore;
const ProgressLogger = require("progress-logger-js").ProgressLogger;

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

	let progress = new ProgressLogger();
	let projection = bucket.projectionStream();

	projection
	.on("data", () => {
		progress.increment();
	})
	.on("wait", () => {
		projection.close();
	})
	.on("close", () => {
		progress.end();
		console.log("Enter to exit");
	});

	return waitForEnter();
})
.then(() => {
	eventStore.close();
})
.catch((err) => {
	eventStore.close();
	console.error(err);
});
