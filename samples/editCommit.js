"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
// set SAMPLE_URL=mongodb://localhost:27017/forge-events
const sampleUrl = process.env.SAMPLE_URL;
if (!sampleUrl) {
    throw new Error("Invalid SAMPLE_URL");
}
const eventStore = new index_1.EventStore({ url: sampleUrl });
const IS_TITLE_SET_REGEX = /^TitleSet\<Story\>$/;
function getCommitsToUpdate(bucket) {
    return new Promise((resolve, reject) => {
        const commitsToUpdate = new Array();
        const stream = bucket.getCommitsStream();
        stream
            .on("data", (doc) => {
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
function update(bucket, commits) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const commit of commits) {
            const titleSetEvents = commit.Events.filter((e) => IS_TITLE_SET_REGEX.test(e._t));
            for (const e of titleSetEvents) {
                e.Title += "!";
            }
            yield bucket.updateCommit(commit._id, commit.Events);
        }
    });
}
function doWork() {
    return __awaiter(this, void 0, void 0, function* () {
        yield eventStore.connect();
        try {
            const bucket = eventStore.bucket("wcm");
            const commits = yield getCommitsToUpdate(bucket);
            yield update(bucket, commits);
        }
        finally {
            yield eventStore.close();
        }
    });
}
doWork();
//# sourceMappingURL=editCommit.js.map