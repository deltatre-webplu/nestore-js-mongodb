import {EventStore, Bucket, CommitData, MongoHelpers} from "../index";

// set SAMPLE_URL=mongodb://localhost:27017/forge-events
const sampleUrl = process.env.SAMPLE_URL;

let eventStore = new EventStore({url: sampleUrl});

const IS_TITLE_SET_REGEX = /^TitleSet\<Story\>$/;

function getCommitsToUpdate(bucket : Bucket) : Promise<Array<CommitData>> {
  return new Promise((resolve, reject) => {
    let commitsToUpdate = new Array<CommitData>();

    let stream = bucket.getCommitsStream();
    stream
    .on("data", (doc : CommitData) => {
      let titleSetEvents = doc.Events.filter((e) => IS_TITLE_SET_REGEX.test(e._t));
      if (titleSetEvents.length > 0)
          commitsToUpdate.push(doc);
    })
    .on("error", (err) => {
      reject(err);
    })
    .on("end", () => {
      resolve(commitsToUpdate);
    });
  });
}

async function update(bucket : Bucket, commits : Array<CommitData>) : Promise<any> {
  for (let commit of commits){
    let titleSetEvents = commit.Events.filter((e) => IS_TITLE_SET_REGEX.test(e._t));
    for (let e of titleSetEvents) {
      e.Title += "!";
    }

    await bucket.updateCommit(commit._id, commit.Events);
  }
}

async function doWork() {
	await eventStore.connect();
	try {
    let bucket = eventStore.bucket("wcm");

    let commits = await getCommitsToUpdate(bucket);

		await update(bucket, commits);
	}
	finally {
		await	eventStore.close();
	}
}

doWork();
