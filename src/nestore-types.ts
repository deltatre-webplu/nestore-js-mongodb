import {Binary as MongoDbBinary} from "mongodb";

export interface CommitsFilters {
	dispatched?: number;
	eventFilters?: any;
	streamId?: string;
	fromBucketRevision?: number;
	toBucketRevision?: number;
}

export interface CommitsOptions {
	batchSize?: number;
}

export interface ProjectionStreamOptions extends CommitsOptions {
	waitInterval?: number;
}

export interface CommitInfo {
	_id: number; // BucketRevision
	StreamId: string;
	StreamRevisionStart: number;
	StreamRevisionEnd: number;
	Dispatched: boolean;
}

export interface CommitData extends CommitInfo {
	Events: any[];
}

export interface MongoDbCommit {
	_id: number; // BucketRevision
	StreamId: MongoDbBinary;
	StreamRevisionStart: number;
	StreamRevisionEnd: number;
	Dispatched: boolean;
	Events: any[];
}

export class WriteResult {
}

export class WriteOptions {
}

export class ConcurrencyError extends Error {
	constructor(message: string) {
		super(message);
	}
}

export class UndispatchedEventsFoundError extends Error {
	constructor(message: string) {
		super(message);
	}
}
