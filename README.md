# nestore-js-mongodb

[![npm version](https://badge.fury.io/js/nestore-js-mongodb.svg)](https://badge.fury.io/js/nestore-js-mongodb)

Event store for Node.js and with MongoDb as storage. An event store is where events are stored when using the Event Sourcing pattern.

This project was born as a porting in Node.js of [NEstore](https://github.com/deltatre-webplu/NEStore), an event store for .NET Framework.

Written and compatible with Typescript.

## Installation

    npm install nestore-js-mongodb

## Usage

Connecting and disconnecting:

    const eventStore = new EventStore({url: "mongodb://localhost"});
    await eventStore.connect();
    const bucket = eventStore.bucket("wcm");
    // TODO call function on bucket to read and write on the event store, see below
    await	eventStore.close();

Connect to the store only at the start of your application and disconnect at the end.

### How to read and write events

    import * as nestore from "../index";

    const eventStore = new nestore.EventStore({url: "mongodb://localhost:27017/myDb"});

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

See `./samples` for more usage examples.

### bucket.write

Write new events

    bucket.write(
      streamId: string,
      expectedStreamRevision: number,
      events: any[],
      options: WriteOptions = { dispatched: false }): Promise<WriteResult>

### bucket.getCommitById

Get a commit by id.

    bucket.getCommitById(id: number): Promise<CommitData | undefined>

### bucket.getCommitsStream

    bucket.getCommitsStream(filters?: CommitsFilters, options?: CommitsOptions): ReadableStream

### bucket.getCommitsArray

    bucket.getCommitsArray(filters?: CommitsFilters, options?: CommitsOptions): Promise<CommitData[]>

### bucket.lastCommit

    bucket.lastCommit(filters?: CommitsFilters, options?: CommitsOptions): Promise<CommitData | undefined>

### bucket.updateCommit

    bucket.updateCommit(id: number, events: any[]): Promise<CommitData | undefined>

### bucket.streamRevision

    bucket.streamRevision(streamId: string): Promise<number>
