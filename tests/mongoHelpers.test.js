"use strict";

const assert = require("chai").assert;
const helpers = require("../src/mongoHelpers.js");

describe("mongoHelpers", function() {

	it("uuid", function() {
		let uuid = helpers.stringToBinaryUUID("D915352B-B6F3-48C5-ACA7-C842FABA0486");

		let stringCsuuid = helpers.binaryUUIDToString(uuid);

		assert.equal(stringCsuuid.toUpperCase(), "D915352B-B6F3-48C5-ACA7-C842FABA0486");
	});
});
