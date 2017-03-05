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
const mongoHelpers_1 = require("./mongoHelpers");
class IncrementCountersStrategy {
    constructor(eventStore) {
        this.eventStore = eventStore;
    }
    increment(bucketName, lastCommit) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.collection) {
                if (!this.eventStore.db) {
                    throw new Error("Event store not connected");
                }
                this.collection = this.eventStore.db.collection("counters");
            }
            const result = yield this.collection
                .findOneAndUpdate({ _id: bucketName }, { $inc: { BucketRevision: 1 } }, {
                returnOriginal: false,
                upsert: false
            });
            // If found
            if (result.value) {
                return result.value.BucketRevision;
            }
            // If not found create a new record
            const lastRevision = lastCommit ? lastCommit._id : 0;
            yield this.createCounterAsync({ _id: bucketName, BucketRevision: lastRevision });
            // try to increment again
            return yield this.increment(bucketName, lastCommit);
        });
    }
    createCounterAsync(counter) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.collection.insertOne(counter);
            }
            catch (err) {
                if (!mongoHelpers_1.MongoHelpers.isDuplicateError(err)) {
                    throw err;
                }
            }
        });
    }
}
exports.IncrementCountersStrategy = IncrementCountersStrategy;
//# sourceMappingURL=autoIncrementStrategies.js.map