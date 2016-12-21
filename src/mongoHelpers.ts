import {Long as MongoDbLong, Binary as MongoDbBinary} from "mongodb";

// Based on:
// https://github.com/mongodb/mongo-csharp-driver/blob/master/uuidhelpers.js

function stringToBinaryUUID(value : string){
	var hex = value.replace(/[{}-]/g, ""); // remove extra characters
	var buffer = new Buffer(hex, "hex");
	return new MongoDbBinary(buffer, MongoDbBinary.SUBTYPE_UUID);
}

function binaryUUIDToString(value : any) { // TODO here the type should be MongoDbBinary ... but it doesn't have buffer property...
	var hex = value.buffer.toString("hex");
	var uuid = hex.substr(0, 8) + "-" + hex.substr(8, 4) + "-" + hex.substr(12, 4) + "-" + hex.substr(16, 4) + "-" + hex.substr(20, 12);
	return uuid;
}

function intToLong(value : number){
	return MongoDbLong.fromInt(value);
}

export const MongoHelpers = {
	stringToBinaryUUID,
	binaryUUIDToString,
	intToLong
};
