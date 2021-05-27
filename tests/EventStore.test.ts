"use strict";

import { assert } from "chai";
import {
  EventStore,
  MongoHelpers,
  Bucket,
  CommitData,
  ConcurrencyError,
  UndispatchedEventsFoundError,
} from "../src/index";
import { ReadPreference } from "mongodb";

const config = require("./config.json"); // tslint:disable-line

describe("EventStore", function () {
  this.slow(500);
  this.timeout(20000);

  before(function () {});

  after(function () {});

  describe("When connected", function () {
    let eventStore: EventStore;

    beforeEach(async function () {
      eventStore = new EventStore(config);
      await eventStore.connect();
    });

    afterEach(async function () {
      if (!eventStore || !eventStore.db) {
        return;
      }

      await eventStore.close();
    });

    it("should have a database instance", function () {
      assert.isNotNull(eventStore.db);
    });

    describe("Giving a bucket", function () {
      let bucket: Bucket;
      let SAMPLE_BUCKETNAME: string;

      function insertSampleBucket(docs: CommitData[]) {
        const col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);

        const mongoDbDocs = docs.map((d) => {
          const newDoc = { ...d } as any;
          newDoc.StreamId = MongoHelpers.stringToBinaryUUID(newDoc.StreamId);
          return newDoc;
        });

        return col.insertMany(mongoDbDocs);
      }

      async function clearSampleBucket() {
        if (!eventStore || !eventStore.db || !SAMPLE_BUCKETNAME) {
          return;
        }
        const col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);
        try {
          await col.drop();
        } catch (err) {
          // ignore if not found...
        }

        const colCounters = eventStore.db.collection("counters");

        await colCounters.deleteOne({ _id: SAMPLE_BUCKETNAME });
      }

      beforeEach(async function () {
        SAMPLE_BUCKETNAME = makeId();
        bucket = eventStore.bucket(SAMPLE_BUCKETNAME);
      });

      afterEach(async function () {
        await clearSampleBucket();
      });

      it("should be possible to get a bucket instance", function () {
        assert.isNotNull(bucket);
        assert.equal(bucket.bucketName, SAMPLE_BUCKETNAME);
        assert.equal(bucket.eventStore, eventStore);
      });

      it("should be possible to ensure indexes", async function () {
        const col = eventStore.mongoCollection(SAMPLE_BUCKETNAME);

        await bucket.ensureIndexes();

        const indexes = await col.indexes();

        assert.equal(indexes[0].name, "_id_");
        assert.equal(indexes[1].name, "Dispatched");
        assert.equal(indexes[2].name, "StreamId");
        assert.equal(indexes[3].name, "StreamRevision");
      });

      describe("Auto Increment strategy using counters", function () {
        it("can increment counters", async function () {
          let revision = await eventStore.autoIncrementStrategy.increment(
            SAMPLE_BUCKETNAME
          );
          assert.equal(revision, 1);
          revision = await eventStore.autoIncrementStrategy.increment(
            SAMPLE_BUCKETNAME
          );
          assert.equal(revision, 2);
          revision = await eventStore.autoIncrementStrategy.increment(
            SAMPLE_BUCKETNAME
          );
          assert.equal(revision, 3);
        });

        it("can increment counters starting from last commit", async function () {
          const lastCommit: CommitData = {
            _id: 263,
            Dispatched: true,
            Events: ["e1"],
            StreamId: bucket.randomStreamId(),
            StreamRevisionStart: 1,
            StreamRevisionEnd: 2,
          };
          let revision = await eventStore.autoIncrementStrategy.increment(
            SAMPLE_BUCKETNAME,
            lastCommit
          );
          assert.equal(revision, 264);
          revision = await eventStore.autoIncrementStrategy.increment(
            SAMPLE_BUCKETNAME
          );
          assert.equal(revision, 265);
          revision = await eventStore.autoIncrementStrategy.increment(
            SAMPLE_BUCKETNAME
          );
          assert.equal(revision, 266);
        });
      });

      describe("Write commits", function () {
        it("cannot write a commit with an invalid stream id", async function () {
          const invalidStreamIds = [undefined, null, ""];

          for (const streamId of invalidStreamIds) {
            try {
              await bucket.write(streamId as any, 0, [""], {
                dispatched: true,
              });
            } catch (err) {
              // error expected
              assert.equal(err.message, "Invalid stream id");
              continue;
            }

            throw new Error(`Expected to fail with stream id '${streamId}'`);
          }
        });

        it("cannot write a commit with an invalid stream revision", async function () {
          const streamRevision = -1;

          try {
            await bucket.write(bucket.randomStreamId(), streamRevision, [""], {
              dispatched: true,
            });
          } catch (err) {
            // error expected
            assert.equal(err.message, "Invalid stream revision");
            return;
          }

          throw new Error(
            `Expected to fail with stream revision '${streamRevision}'`
          );
        });

        it("cannot write a commit with an invalid events", async function () {
          const streamRevision = 0;

          try {
            await bucket.write(bucket.randomStreamId(), streamRevision, [], {
              dispatched: true,
            });
          } catch (err) {
            // error expected
            assert.equal(err.message, "Invalid stream events");
            return;
          }

          throw new Error(`Expected to fail with empty stream events`);
        });

        describe("Write commits with existing data", function () {
          beforeEach(async function () {
            await insertSampleBucket([
              SAMPLE_EVENT2,
              SAMPLE_EVENT3,
              SAMPLE_EVENT1,
            ]);
          });

          it("cannot write a commit with an old stream revision", async function () {
            const streamRevision = 0;

            try {
              await bucket.write(SAMPLE_EVENT1.StreamId, streamRevision, [""], {
                dispatched: true,
              });
            } catch (err) {
              // error expected
              assert.isTrue(err instanceof ConcurrencyError);
              assert.equal(err.errorType, "ConcurrencyError");
              assert.equal(err.currentStreamRevision, 3);
              return;
            }

            throw new Error(`Expected to fail with a concurrency error`);
          });

          it("cannot write a commit with a stream revision already used", async function () {
            const streamRevision = 2;

            try {
              await bucket.write(SAMPLE_EVENT1.StreamId, streamRevision, [""], {
                dispatched: true,
              });
            } catch (err) {
              // error expected
              assert.isTrue(err instanceof ConcurrencyError);
              assert.equal(err.errorType, "ConcurrencyError");
              assert.equal(err.currentStreamRevision, 3);
              return;
            }

            throw new Error(`Expected to fail`);
          });

          it("cannot write a commit with a stream revision not sequential", async function () {
            const streamRevision = 4;

            try {
              await bucket.write(SAMPLE_EVENT1.StreamId, streamRevision, [""], {
                dispatched: true,
              });
            } catch (err) {
              // error expected
              assert.equal(
                err.message,
                "Invalid stream revision, expected '3'"
              );
              return;
            }

            throw new Error(`Expected to fail`);
          });

          it("cannot write a commit if there are undispatched events", async function () {
            await insertSampleBucket([SAMPLE_EVENT4_NOT_DISPATCHED]);

            const streamRevision = 2;

            try {
              await bucket.write(
                SAMPLE_EVENT4_NOT_DISPATCHED.StreamId,
                streamRevision,
                [""],
                { dispatched: true }
              );
            } catch (err) {
              // error expected
              assert.isTrue(
                err instanceof UndispatchedEventsFoundError,
                err.message
              );
              return;
            }

            throw new Error(`Expected to fail`);
          });
        });

        it("write an event", async function () {
          const streamId = bucket.randomStreamId();
          await bucket.write(streamId, 0, ["e1"], { dispatched: true });

          const commits = await bucket.getCommitsArray({ streamId });

          assert.equal(commits.length, 1);
          assert.equal(commits[0]._id, 1);
          assert.equal(commits[0].Dispatched, true);
          assert.equal(commits[0].Events[0], "e1");
          assert.equal(commits[0].StreamId, streamId);
          assert.equal(commits[0].StreamRevisionStart, 0);
          assert.equal(commits[0].StreamRevisionEnd, 1);
        });

        it("write multiple events", async function () {
          const streamId = bucket.randomStreamId();
          await bucket.write(streamId, 0, ["e1", "e2"], { dispatched: true });

          const commits = await bucket.getCommitsArray({ streamId });

          assert.equal(commits.length, 1);
          assert.equal(commits[0]._id, 1);
          assert.equal(commits[0].Dispatched, true);
          assert.equal(commits[0].Events[0], "e1");
          assert.equal(commits[0].Events[1], "e2");
          assert.equal(commits[0].StreamId, streamId);
          assert.equal(commits[0].StreamRevisionStart, 0);
          assert.equal(commits[0].StreamRevisionEnd, 2);
        });

        it("write multiple commits", async function () {
          const streamId = bucket.randomStreamId();

          await bucket.write(streamId, 0, ["e1", "e2"], { dispatched: true });
          await bucket.write(streamId, 2, ["e3", "e4"], { dispatched: true });

          const commits = await bucket.getCommitsArray({ streamId });

          assert.equal(commits.length, 2);
          assert.equal(commits[0]._id, 1);
          assert.equal(commits[0].Dispatched, true);
          assert.equal(commits[0].Events[0], "e1");
          assert.equal(commits[0].Events[1], "e2");
          assert.equal(commits[0].StreamId, streamId);
          assert.equal(commits[0].StreamRevisionStart, 0);
          assert.equal(commits[0].StreamRevisionEnd, 2);

          assert.equal(commits[1]._id, 2);
          assert.equal(commits[1].Dispatched, true);
          assert.equal(commits[1].Events[0], "e3");
          assert.equal(commits[1].Events[1], "e4");
          assert.equal(commits[1].StreamId, streamId);
          assert.equal(commits[1].StreamRevisionStart, 2);
          assert.equal(commits[1].StreamRevisionEnd, 4);
        });
      });

      describe("Read commits", function () {
        beforeEach(async function () {
          await insertSampleBucket([
            SAMPLE_EVENT2,
            SAMPLE_EVENT3,
            SAMPLE_EVENT1,
          ]);
        });

        it("should be possible to read commits as array (default ascending)", function () {
          return bucket.getCommitsArray().then((docs: CommitData[]) => {
            assert.equal(docs.length, 3);
            assert.deepEqual(docs[0], SAMPLE_EVENT1);
            assert.deepEqual(docs[1], SAMPLE_EVENT2);
            assert.deepEqual(docs[2], SAMPLE_EVENT3);
          });
        });

        it("should be possible to read commits as array ascending", function () {
          return bucket
            .getCommitsArray(undefined, { sortDirection: 1 })
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 3);
              assert.deepEqual(docs[0], SAMPLE_EVENT1);
              assert.deepEqual(docs[1], SAMPLE_EVENT2);
              assert.deepEqual(docs[2], SAMPLE_EVENT3);
            });
        });

        it("should be possible to read commits as array descending", function () {
          return bucket
            .getCommitsArray(undefined, { sortDirection: -1 })
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 3);
              assert.deepEqual(docs[0], SAMPLE_EVENT3);
              assert.deepEqual(docs[1], SAMPLE_EVENT2);
              assert.deepEqual(docs[2], SAMPLE_EVENT1);
            });
        });

        it("should be possible to read commits using read preference", function () {
          return bucket
            .getCommitsArray(undefined, {
              readPreference: ReadPreference.SECONDARY_PREFERRED,
            })
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 3);
              assert.deepEqual(docs[0], SAMPLE_EVENT1);
              assert.deepEqual(docs[1], SAMPLE_EVENT2);
              assert.deepEqual(docs[2], SAMPLE_EVENT3);
            });
        });

        it("should be possible to get last commit", function () {
          return bucket.lastCommit().then((doc: CommitData | undefined) => {
            assert.deepEqual(doc, SAMPLE_EVENT3);
          });
        });

        it("should be possible to read commits and undispatched are not returned", function () {
          return insertSampleBucket([SAMPLE_EVENT4_NOT_DISPATCHED])
            .then(() => bucket.getCommitsArray())
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 3);
              assert.deepEqual(docs[0], SAMPLE_EVENT1);
              assert.deepEqual(docs[1], SAMPLE_EVENT2);
              assert.deepEqual(docs[2], SAMPLE_EVENT3);
            });
        });

        it("should be possible to read commits with also undispatched", function () {
          return insertSampleBucket([SAMPLE_EVENT4_NOT_DISPATCHED])
            .then(() => bucket.getCommitsArray({ dispatched: -1 }))
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 4);
              assert.deepEqual(docs[0], SAMPLE_EVENT1);
              assert.deepEqual(docs[1], SAMPLE_EVENT2);
              assert.deepEqual(docs[2], SAMPLE_EVENT3);
              assert.deepEqual(docs[3], SAMPLE_EVENT4_NOT_DISPATCHED);
            });
        });

        it("should be possible to read commits only undispatched", function () {
          return insertSampleBucket([SAMPLE_EVENT4_NOT_DISPATCHED])
            .then(() => bucket.getCommitsArray({ dispatched: 0 }))
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 1);
              assert.deepEqual(docs[0], SAMPLE_EVENT4_NOT_DISPATCHED);
            });
        });

        it("should be possible to read commits filtering by event properties", function () {
          return bucket
            .getCommitsArray({
              eventFilters: { Field1: "X" },
            })
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 1);
              assert.deepEqual(docs[0], SAMPLE_EVENT3);
            });
        });

        it("should be possible to read commits filtering by bucket revision", function () {
          return bucket
            .getCommitsArray({ fromBucketRevision: 2, toBucketRevision: 2 })
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 1);
              assert.deepEqual(docs[0], SAMPLE_EVENT2);
            });
        });

        it("should be possible to read 2 commits filtering by bucket revision ascending", function () {
          return bucket
            .getCommitsArray(
              { fromBucketRevision: 2, toBucketRevision: 3 },
              { sortDirection: 1 }
            )
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 2);
              assert.deepEqual(docs[0], SAMPLE_EVENT2);
              assert.deepEqual(docs[1], SAMPLE_EVENT3);
            });
        });

        it("should be possible to read 2 commits filtering by bucket revision descending", function () {
          return bucket
            .getCommitsArray(
              { fromBucketRevision: 3, toBucketRevision: 2 },
              { sortDirection: -1 }
            )
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 2);
              assert.deepEqual(docs[0], SAMPLE_EVENT3);
              assert.deepEqual(docs[1], SAMPLE_EVENT2);
            });
        });

        it("should be possible to read 1 commits using limit ascending", function () {
          return bucket
            .getCommitsArray({}, { sortDirection: 1, limit: 1 })
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 1);
              assert.deepEqual(docs[0], SAMPLE_EVENT1);
            });
        });

        it("should be possible to read 1 commits using limit descending", function () {
          return bucket
            .getCommitsArray({}, { sortDirection: -1, limit: 1 })
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 1);
              assert.deepEqual(docs[0], SAMPLE_EVENT3);
            });
        });

        it("should be possible to read commits filtering by stream id", function () {
          return bucket
            .getCommitsArray({
              streamId: "30000003-3003-3003-3003-300000000003",
            })
            .then((docs: CommitData[]) => {
              assert.equal(docs.length, 1);
              assert.deepEqual(docs[0], SAMPLE_EVENT3);
            });
        });

        it("should be possible to get a commit by id", async function () {
          const doc = await bucket.getCommitById(SAMPLE_EVENT1._id);

          if (!doc) {
            throw new Error("Commit not found");
          }

          assert.equal(typeof doc._id, "number");
          assert.equal(typeof doc.StreamId, "string");
          assert.isTrue(doc.Events instanceof Array);

          assert.deepEqual(doc, SAMPLE_EVENT1);
        });

        it("should not be possible to update commit events with a different events number", async function () {
          // Clone events
          const newEvents = [...SAMPLE_EVENT1.Events, ...SAMPLE_EVENT2.Events];

          try {
            await bucket.updateCommit(SAMPLE_EVENT1._id, newEvents);

            assert.fail("Should throw an error");
          } catch (err) {
            assert.equal("Events count must be the same", err.message);
          }
        });

        it("should be possible to update commit events", async function () {
          let doc = await bucket.getCommitById(SAMPLE_EVENT1._id);
          assert.deepEqual(doc, SAMPLE_EVENT1);

          // Clone events
          const newEvents = Array.from(SAMPLE_EVENT1.Events);
          newEvents[0] = { ...newEvents[0] };
          newEvents[0].Field1 = "A modified";

          // Update events
          await bucket.updateCommit(SAMPLE_EVENT1._id, newEvents);

          doc = await bucket.getCommitById(SAMPLE_EVENT1._id);
          if (!doc) {
            throw new Error("Commit not found");
          }

          assert.notDeepEqual(doc, SAMPLE_EVENT1);
          assert.equal(doc.Events[0].Field1, "A modified");
          // if I restore the old value then all other properties should be the same
          doc.Events[0].Field1 = SAMPLE_EVENT1.Events[0].Field1;
          assert.deepEqual(doc, SAMPLE_EVENT1);
        });

        describe("Read commits filtering by stream id", function () {
          beforeEach(async function () {
            await insertSampleBucket([
              STREAM_SAMPLE_EVENT_5,
              STREAM_SAMPLE_EVENT_6,
              STREAM_SAMPLE_EVENT_7,
            ]);
          });

          it("should be possible to read 2 commits filtering by bucket revision ascending", function () {
            return bucket
              .getCommitsArray(
                { fromBucketRevision: 6, streamId: STEAM_SAMPLE_ID },
                { limit: 2, sortDirection: 1 }
              )
              .then((docs) => {
                assert.equal(docs.length, 2);
                assert.deepEqual(docs[0], STREAM_SAMPLE_EVENT_6);
                assert.deepEqual(docs[1], STREAM_SAMPLE_EVENT_7);
              });
          });

          it("should be possible to read 2 commits filtering by bucket revision descending", function () {
            return bucket
              .getCommitsArray(
                { fromBucketRevision: 6, streamId: STEAM_SAMPLE_ID },
                { limit: 2, sortDirection: -1 }
              )
              .then((docs) => {
                assert.equal(docs.length, 2);
                assert.deepEqual(docs[0], STREAM_SAMPLE_EVENT_6);
                assert.deepEqual(docs[1], STREAM_SAMPLE_EVENT_5);
              });
          });
        });
      });
    });
  });
});

function makeId() {
  let text = "";
  const possible = "abcdefghijklmnopqrstuvwxyz";

  for (let i = 0; i < 5; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

const SAMPLE_EVENT1: CommitData = {
  _id: 1,
  StreamId: "20000002-2002-2002-2002-200000000002",
  StreamRevisionStart: 0,
  StreamRevisionEnd: 1,
  Dispatched: true,
  Events: [
    {
      _t: "MyEventA",
      Field1: "A",
    },
  ],
};
const SAMPLE_EVENT2: CommitData = {
  _id: 2,
  StreamId: "20000002-2002-2002-2002-200000000002",
  StreamRevisionStart: 1,
  StreamRevisionEnd: 3,
  Dispatched: true,
  Events: [
    {
      _t: "MyEventA",
      Field1: "A",
    },
    {
      _t: "MyEventB",
      Field1: "B",
    },
  ],
};
const SAMPLE_EVENT3: CommitData = {
  _id: 3,
  StreamId: "30000003-3003-3003-3003-300000000003",
  StreamRevisionStart: 0,
  StreamRevisionEnd: 1,
  Dispatched: true,
  Events: [
    {
      _t: "MyEventX",
      Field1: "X",
    },
  ],
};
const SAMPLE_EVENT4_NOT_DISPATCHED: CommitData = {
  _id: 4,
  StreamId: "30000003-3003-3003-3003-300000000003",
  StreamRevisionStart: 1,
  StreamRevisionEnd: 2,
  Dispatched: false,
  Events: [
    {
      _t: "MyEventX",
      Field1: "Y",
    },
  ],
};

const STEAM_SAMPLE_ID = "50000005-5005-5005-5005-500000000005";
const STREAM_SAMPLE_EVENT_5: CommitData = {
  _id: 5,
  StreamId: STEAM_SAMPLE_ID,
  StreamRevisionStart: 0,
  StreamRevisionEnd: 1,
  Dispatched: true,
  Events: [
    {
      _t: "MyEventA",
      Field1: "A",
    },
  ],
};
const STREAM_SAMPLE_EVENT_6: CommitData = {
  _id: 6,
  StreamId: STEAM_SAMPLE_ID,
  StreamRevisionStart: 1,
  StreamRevisionEnd: 2,
  Dispatched: true,
  Events: [
    {
      _t: "MyEventA",
      Field1: "A",
    },
  ],
};
const STREAM_SAMPLE_EVENT_7: CommitData = {
  _id: 7,
  StreamId: STEAM_SAMPLE_ID,
  StreamRevisionStart: 2,
  StreamRevisionEnd: 3,
  Dispatched: true,
  Events: [
    {
      _t: "MyEventX",
      Field1: "X",
    },
  ],
};
