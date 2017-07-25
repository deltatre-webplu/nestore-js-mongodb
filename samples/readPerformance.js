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
const progress_logger_js_1 = require("progress-logger-js");
// set SAMPLE_URL=mongodb://localhost:27017/Forge
const sampleUrl = process.env.SAMPLE_URL;
if (!sampleUrl) {
    throw new Error("Invalid SAMPLE_URL");
}
const progress = new progress_logger_js_1.ProgressLogger();
const eventStore = new index_1.EventStore({ url: sampleUrl });
function readAll() {
    const bucket = eventStore.bucket("wcm");
    let lastRevision = 0;
    const filters = {
        fromBucketRevision: lastRevision,
        eventFilters: {}
    };
    const stream = bucket.getCommitsStream(filters);
    return new Promise((resolve, reject) => {
        stream
            .on("data", (doc) => {
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
function doWork() {
    return __awaiter(this, void 0, void 0, function* () {
        yield eventStore.connect();
        try {
            yield readAll();
        }
        finally {
            yield eventStore.close();
        }
    });
}
doWork();
//# sourceMappingURL=readPerformance.js.map