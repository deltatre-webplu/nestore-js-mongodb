import * as nestore from "../index";

// set env variable SAMPLE_URL=mongodb://localhost:27017/Forge
const sampleUrl = process.env.SAMPLE_URL;
if (!sampleUrl) {
	throw new Error("Invalid SAMPLE_URL");
}

const eventStore = new nestore.EventStore({url: sampleUrl});

async function writeAndRead() {
	const bucket = eventStore.bucket("sample1");

  const streamId = bucket.randomStreamId(); // shortcut to uuid.v4()
  const options: nestore.WriteOptions = { dispatched: true };

  await bucket.write(streamId, 0, [{name: "A"}], options);
  await bucket.write(streamId, 1, [{name: "B"}], options);

  const commits = await bucket.getCommitsArray({ streamId });

  console.log(commits[0].Events[0].name); // print A
  console.log(commits[1].Events[0].name); // print B
}

async function doWork() {
	await eventStore.connect();
	try {
		await writeAndRead();
	}	finally {
		await	eventStore.close();
	}
}

doWork();
