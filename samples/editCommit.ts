import {EventStore, Bucket, CommitData, MongoHelpers} from "../index";

// set SAMPLE_URL=mongodb://localhost:27017/forge-events
const sampleUrl = process.env.SAMPLE_URL;

const eventStore = new EventStore({url: sampleUrl});

const IS_TITLE_SET_REGEX = /^TitleSet\<Story\>$/;

function getCommitsToUpdate(bucket: Bucket): Promise<CommitData[]> {
	return new Promise((resolve, reject) => {
		const commitsToUpdate = new Array<CommitData>();

		const stream = bucket.getCommitsStream();
		stream
		.on("data", (doc: CommitData) => {
			const titleSetEvents = doc.Events.filter((e) => IS_TITLE_SET_REGEX.test(e._t));
			if (titleSetEvents.length > 0) {
				commitsToUpdate.push(doc);
			}
		})
		.on("error", (err) => {
			reject(err);
		})
		.on("end", () => {
			resolve(commitsToUpdate);
		});
	});
}

async function update(bucket: Bucket, commits: CommitData[]): Promise<any> {
	for (const commit of commits){
		const titleSetEvents = commit.Events.filter((e) => IS_TITLE_SET_REGEX.test(e._t));
		for (const e of titleSetEvents) {
			e.Title += "!";
		}

		await bucket.updateCommit(commit._id, commit.Events);
	}
}

async function doWork() {
	await eventStore.connect();
	try {
		const bucket = eventStore.bucket("wcm");

		const commits = await getCommitsToUpdate(bucket);

		await update(bucket, commits);
	}	finally {
		await	eventStore.close();
	}
}

doWork();
