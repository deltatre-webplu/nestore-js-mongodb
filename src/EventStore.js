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
const mongodb_1 = require("mongodb");
const Bucket_1 = require("./Bucket");
class EventStore {
    constructor(options) {
        this.options = options;
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.db = yield mongodb_1.MongoClient.connect(this.options.url, this.options.connectOptions);
            return this;
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.db) {
                yield this.db.close();
                this.db = undefined;
            }
        });
    }
    bucket(bucketName) {
        if (!this.db)
            throw new Error("Event store not connected");
        return new Bucket_1.Bucket(this, bucketName);
    }
    mongoCollection(bucketName) {
        if (!this.db)
            throw new Error("Event store not connected");
        const collectionName = `${bucketName}.commits`;
        return this.db.collection(collectionName);
    }
}
exports.EventStore = EventStore;
