const EventStore = require("./src/EventStore.js");
const Projection = require("./src/Projection.js");
const MongoHelpers = require("./src/mongoHelpers.js");

module.exports = {
	EventStore : EventStore,
	Projection : Projection,
	MongoHelpers : MongoHelpers
};
