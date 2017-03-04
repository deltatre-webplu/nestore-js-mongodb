"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class WriteResult {
}
exports.WriteResult = WriteResult;
class WriteOptions {
}
exports.WriteOptions = WriteOptions;
class ConcurrencyError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.ConcurrencyError = ConcurrencyError;
class UndispatchedEventsFoundError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.UndispatchedEventsFoundError = UndispatchedEventsFoundError;
//# sourceMappingURL=nestore-types.js.map