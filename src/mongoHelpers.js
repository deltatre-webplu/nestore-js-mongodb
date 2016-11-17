"use strict";

const MongoDbLong = require("mongodb").Long;
const MongoDbBinary = require("mongodb").Binary;

// Based on:
// https://github.com/mongodb/mongo-csharp-driver/blob/master/uuidhelpers.js

function stringToBinaryUUID(value){
	var hex = value.replace(/[{}-]/g, ""); // remove extra characters
	var buffer = new Buffer(hex, "hex");
	return new MongoDbBinary(buffer, MongoDbBinary.SUBTYPE_UUID);
}

function binaryUUIDToString(value) {
	var hex = value.buffer.toString("hex");
	var uuid = hex.substr(0, 8) + "-" + hex.substr(8, 4) + "-" + hex.substr(12, 4) + "-" + hex.substr(16, 4) + "-" + hex.substr(20, 12);
	return uuid;
}

function intToLong(value){
	return MongoDbLong.fromInt(value);
}

exports.stringToBinaryUUID = stringToBinaryUUID;
exports.intToLong = intToLong;
exports.binaryUUIDToString = binaryUUIDToString;
