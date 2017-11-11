"use strict";

const assert = require("chai").assert;
const helpers = require("../index").MongoHelpers;

describe("mongoHelpers", function() {

	it("uuid", function() {
		let uuid = helpers.stringToBinaryUUID("D915352B-B6F3-48C5-ACA7-C842FABA0486");

		let stringCsuuid = helpers.binaryUUIDToString(uuid);

		assert.equal(stringCsuuid.toUpperCase(), "D915352B-B6F3-48C5-ACA7-C842FABA0486");
	});

	it("csuuid", function() {
		// note: here I should use stringToBinaryCSUUID to correctly test CSUUID functions...
		let uuid = helpers.stringToBinaryUUID("D915352B-B6F3-48C5-ACA7-C842FABA0486");

		let stringCsuuid = helpers.binaryCSUUIDToString(uuid);

		assert.equal(stringCsuuid.toUpperCase(), "2B3515D9-F3B6-C548-ACA7-C842FABA0486");
	});

	// For compatiblity with older nestore versions.... <= 1.4
	it("calling conversion on already converted value as no effect", function() {
		let uuid = helpers.stringToBinaryUUID("D915352B-B6F3-48C5-ACA7-C842FABA0486");
		let uuid2 = helpers.stringToBinaryUUID(uuid);

		let stringCsuuid = helpers.binaryUUIDToString(uuid2);

		let stringCsuuid2 = helpers.binaryUUIDToString(stringCsuuid);
		assert.equal(stringCsuuid2, stringCsuuid);

		assert.equal(stringCsuuid2.toUpperCase(), "D915352B-B6F3-48C5-ACA7-C842FABA0486");
	});
});
