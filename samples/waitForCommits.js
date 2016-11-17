"use strict";

const EventStore = require("../src/EventStore");
const ProgressLogger = require("./progress-logger").ProgressLogger;
// const Readable = require("stream").Readable;
//
// class PollingCommitStream extends Readable {
// 	constructor(opt) {
// 		super(opt);
// 		this.bucket = opt.bucket;
// 		this.startsFromRevision = opt.lastRevision || 1;
// 	}
//
// 	_read(){
// 		var stream=this.bucket.getCommitsStream({ fromBucketRevision: this.startsFromRevision});
// 		this.push(stream);
// 	}
// }


// set SAMPLE_URL=mongodb://localhost:27017/Forge
const sampleUrl = process.env.SAMPLE_URL;

// function waitNext(fromRevision){
//
// }

let progress = new ProgressLogger();
let eventStore = new EventStore({url: sampleUrl});

eventStore.connect()
.then(() => {
	let bucket = eventStore.bucket("wcm");

	let lastRevision = 0;

	let stream = bucket.getCommitsStream({ fromBucketRevision: lastRevision });
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
