import {EventStore} from "../index";
import {ProgressLogger} from "progress-logger-js";

// set SAMPLE_URL=mongodb://localhost:27017/Forge
const sampleUrl = process.env.SAMPLE_URL;

let progress = new ProgressLogger();
let eventStore = new EventStore({url: sampleUrl});

function readAll(){
	let bucket = eventStore.bucket("wcm");

	let lastRevision = 0;

	let filters = {
		fromBucketRevision: lastRevision,
		eventFilters : {
			//EventDateTime : { $gt : new Date(2015, 9, 1) }
			//_t : /^(Entity)?Published\<.+\>$/
		}
	};
	let stream = bucket.getCommitsStream(filters);
	return new Promise((resolve, reject) => {
		stream
		.on("data", (doc : any) => {
			progress.increment();
			lastRevision = doc._id;
		})
		.on("error", (err) => {
			reject(err);
		})
		.on("end", () => {
			progress.end();
			resolve();
		});
	});
}

async function doWork() {
	await eventStore.connect();
	try {
		await readAll();
	}
	finally {
		await	eventStore.close();
	}
}

doWork();
