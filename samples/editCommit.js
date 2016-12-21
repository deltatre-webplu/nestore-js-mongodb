"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const index_1 = require("../index");
const sampleUrl = process.env.SAMPLE_URL;
let eventStore = new index_1.EventStore({ url: sampleUrl });
const IS_TITLE_SET_REGEX = /^TitleSet\<Story\>$/;
function getCommitsToUpdate(bucket) {
    return new Promise((resolve, reject) => {
        let commitsToUpdate = new Array();
        let stream = bucket.getCommitsStream();
        stream
            .on("data", (doc) => {
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
function update(bucket, commits) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let commit of commits) {
            let titleSetEvents = commit.Events.filter((e) => IS_TITLE_SET_REGEX.test(e._t));
            for (let e of titleSetEvents) {
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
            let bucket = eventStore.bucket("wcm");
            let commits = yield getCommitsToUpdate(bucket);
            yield update(bucket, commits);
        }
        finally {
            yield eventStore.close();
        }
    });
}
doWork();
