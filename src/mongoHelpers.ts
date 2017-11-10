import {Long as MongoDbLong, Binary as MongoDbBinary} from "mongodb";
import {CommitData, MongoDbCommit} from "./nestore-types";

// Based on:
// https://github.com/mongodb/mongo-csharp-driver/blob/master/uuidhelpers.js

function stringToBinaryUUID(value: string): MongoDbBinary {
	// for compatiblity reason check if value is already converted...
	if (typeof value !== "string") {
		return value;
	}

	const hex = value.replace(/[{}-]/g, ""); // remove extra characters
	const buffer = new Buffer(hex, "hex");
	return new MongoDbBinary(buffer, MongoDbBinary.SUBTYPE_UUID);
}

function binaryUUIDToString(value: MongoDbBinary): string {
	// for compatiblity reason check if value is already converted...
	if (typeof value === "string") {
		return value;
	}

	const valueWithBuffer = value as any;

	const hex = valueWithBuffer.buffer.toString("hex");
	const uuid = hex.substr(0, 8)
	+ "-" + hex.substr(8, 4)
	+ "-" + hex.substr(12, 4)
	+ "-" + hex.substr(16, 4)
	+ "-" + hex.substr(20, 12);

	return uuid;
}

function binaryCSUUIDToString(value: MongoDbBinary) {
	// for compatiblity reason check if value is already converted...
	if (typeof value === "string") {
		return value;
	}

	const buffer = (value as any).buffer as Buffer;

	const hex = buffer.toString("hex");
	const a = hex.substr(6, 2) + hex.substr(4, 2) + hex.substr(2, 2) + hex.substr(0, 2);
	const b = hex.substr(10, 2) + hex.substr(8, 2);
	const c = hex.substr(14, 2) + hex.substr(12, 2);
	const d = hex.substr(16, 16);
	const hex2 = a + b + c + d;

	return hex2.substr(0, 8)
		+ "-" + hex2.substr(8, 4)
		+ "-" + hex2.substr(12, 4)
		+ "-" + hex2.substr(16, 4)
		+ "-" + hex2.substr(20, 12);
}

function intToLong(value: number) {
	return MongoDbLong.fromInt(value);
}

function mongoDocToCommitData(doc: undefined): undefined;
function mongoDocToCommitData(doc: MongoDbCommit): CommitData;
function mongoDocToCommitData(doc?: MongoDbCommit): CommitData | undefined {
	if (!doc) {
		return undefined;
	}

	return {
		_id: doc._id,
		StreamId : MongoHelpers.binaryUUIDToString(doc.StreamId),
		Dispatched : doc.Dispatched,
		Events: doc.Events,
		StreamRevisionEnd: doc.StreamRevisionEnd,
		StreamRevisionStart: doc.StreamRevisionStart
	};
}

function commitDataToMongoDoc(commit?: CommitData): MongoDbCommit | undefined {
	if (!commit) {
		return undefined;
	}

	return {
		_id: commit._id,
		StreamId : MongoHelpers.stringToBinaryUUID(commit.StreamId),
		Dispatched : commit.Dispatched,
		Events: commit.Events,
		StreamRevisionEnd: commit.StreamRevisionEnd,
		StreamRevisionStart: commit.StreamRevisionStart
	};
}

function isDuplicateError(err: any) {
	return err.code === 11000;
}

export const MongoHelpers = {
	stringToBinaryUUID,
	binaryUUIDToString,
	intToLong,
	mongoDocToCommitData,
	commitDataToMongoDoc,
	isDuplicateError
};
