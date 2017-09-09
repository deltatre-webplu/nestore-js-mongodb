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
const nestore = require("../index");
// set env variable SAMPLE_URL=mongodb://localhost:27017/Forge
const sampleUrl = process.env.SAMPLE_URL;
if (!sampleUrl) {
    throw new Error("Invalid SAMPLE_URL");
}
const eventStore = new nestore.EventStore({ url: sampleUrl });
function writeAndRead() {
    return __awaiter(this, void 0, void 0, function* () {
        const bucket = eventStore.bucket("sample1");
        const streamId = bucket.randomStreamId(); // shortcut to uuid.v4()
        const options = { dispatched: true };
        yield bucket.write(streamId, 0, [{ name: "A" }], options);
        yield bucket.write(streamId, 1, [{ name: "B" }], options);
        const commits = yield bucket.getCommitsArray({ streamId });
        // tslint:disable-next-line:no-console
        console.log(commits[0].Events[0].name); // print A
        // tslint:disable-next-line:no-console
        console.log(commits[1].Events[0].name); // print B
    });
}
function doWork() {
    return __awaiter(this, void 0, void 0, function* () {
        yield eventStore.connect();
        try {
            yield writeAndRead();
        }
        finally {
            yield eventStore.close();
        }
    });
}
doWork();
//# sourceMappingURL=readWrite.js.map