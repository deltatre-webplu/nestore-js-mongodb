"use strict";

const MongoDbLong = require("mongodb").Long;
const MongoDbBinary = require("mongodb").Binary;


function toUuid(value){
	var hex = value.replace(/[{}-]/g, ""); // remove extra characters
	var buffer = new Buffer(hex, "hex");
	return new MongoDbBinary(buffer, MongoDbBinary.SUBTYPE_UUID);
}

function toLong(value){
	return MongoDbLong.fromInt(value);
}

exports.toUuid = toUuid;
exports.toLong = toLong;
