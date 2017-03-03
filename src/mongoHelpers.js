"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
// Based on:
// https://github.com/mongodb/mongo-csharp-driver/blob/master/uuidhelpers.js
function stringToBinaryUUID(value) {
    var hex = value.replace(/[{}-]/g, ""); // remove extra characters
    var buffer = new Buffer(hex, "hex");
    return new mongodb_1.Binary(buffer, mongodb_1.Binary.SUBTYPE_UUID);
}
function binaryUUIDToString(value) {
    var hex = value.buffer.toString("hex");
    var uuid = hex.substr(0, 8) + "-" + hex.substr(8, 4) + "-" + hex.substr(12, 4) + "-" + hex.substr(16, 4) + "-" + hex.substr(20, 12);
    return uuid;
}
function intToLong(value) {
    return mongodb_1.Long.fromInt(value);
}
exports.MongoHelpers = {
    stringToBinaryUUID,
    binaryUUIDToString,
    intToLong
};
