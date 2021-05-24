"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
const Bucket_1 = require("./Bucket");
const autoIncrementStrategies_1 = require("./autoIncrementStrategies");
class EventStore {
    constructor(options) {
        this.client = new mongodb_1.MongoClient(options.url, Object.assign(Object.assign({}, options.connectOptions), { useUnifiedTopology: true }));
        this.autoIncrementStrategy = new autoIncrementStrategies_1.IncrementCountersStrategy(this);
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.client.isConnected()) {
                yield this.client.connect();
                if (!this.db) {
                    this.db = this.client.db();
                }
            }
            return this;
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.client.isConnected()) {
                yield this.client.close();
                this.db = undefined;
            }
        });
    }
    bucket(bucketName) {
        if (!this.client.isConnected() || !this.db) {
            throw new Error("Event store not connected");
        }
        return new Bucket_1.Bucket(this, bucketName);
    }
    mongoCollection(bucketName) {
        if (!this.client.isConnected() || !this.db) {
            throw new Error("Event store not connected");
        }
        const collectionName = `${bucketName}.commits`;
        return this.db.collection(collectionName);
    }
}
exports.EventStore = EventStore;
//# sourceMappingURL=EventStore.js.map