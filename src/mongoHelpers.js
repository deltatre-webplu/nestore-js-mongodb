"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
// Based on:
// https://github.com/mongodb/mongo-csharp-driver/blob/master/uuidhelpers.js
function stringToBinaryUUID(value) {
    // for compatiblity reason check if value is already converted...
    if (typeof value !== "string") {
        return value;
    }
    const hex = value.replace(/[{}-]/g, ""); // remove extra characters
    const buffer = new Buffer(hex, "hex");
    return new mongodb_1.Binary(buffer, mongodb_1.Binary.SUBTYPE_UUID);
}
function binaryUUIDToString(value) {
    // for compatiblity reason check if value is already converted...
    if (typeof value === "string") {
        return value;
    }
    const valueWithBuffer = value;
    const hex = valueWithBuffer.buffer.toString("hex");
    const uuid = hex.substr(0, 8)
        + "-" + hex.substr(8, 4)
        + "-" + hex.substr(12, 4)
        + "-" + hex.substr(16, 4)
        + "-" + hex.substr(20, 12);
    return uuid;
}
function intToLong(value) {
    return mongodb_1.Long.fromInt(value);
}
function mongoDocToCommitData(doc) {
    if (!doc) {
        return undefined;
    }
    return {
        _id: doc._id,
        StreamId: exports.MongoHelpers.binaryUUIDToString(doc.StreamId),
        Dispatched: doc.Dispatched,
        Events: doc.Events,
        StreamRevisionEnd: doc.StreamRevisionEnd,
        StreamRevisionStart: doc.StreamRevisionStart
    };
}
function commitDataToMongoDoc(commit) {
    if (!commit) {
        return undefined;
    }
    return {
        _id: commit._id,
        StreamId: exports.MongoHelpers.stringToBinaryUUID(commit.StreamId),
        Dispatched: commit.Dispatched,
        Events: commit.Events,
        StreamRevisionEnd: commit.StreamRevisionEnd,
        StreamRevisionStart: commit.StreamRevisionStart
    };
}
exports.MongoHelpers = {
    stringToBinaryUUID,
    binaryUUIDToString,
    intToLong,
    mongoDocToCommitData,
    commitDataToMongoDoc
};
//# sourceMappingURL=mongoHelpers.js.map