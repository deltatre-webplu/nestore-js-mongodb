import {Binary as MongoDbBinary, ReadPreference as MongoDbReadPreference} from "mongodb";

export interface CommitsFilters {
	dispatched?: number;
	eventFilters?: any;
	streamId?: string;
	fromBucketRevision?: number;
	toBucketRevision?: number;
}

export interface CommitsOptions {
	batchSize?: number;
	readPreference?: MongoDbReadPreference | string;
}

export interface ProjectionStreamOptions extends CommitsOptions {
	waitInterval?: number;
}

export interface SortableCommitsOptions extends CommitsOptions {
	sortDirection?: SortDirection;
	limit?: number;
}

export type SortDirection = 1 | -1;

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

export interface WriteResult {
	commit: CommitData;
}

export interface WriteOptions {
	dispatched?: boolean;
}

export class ConcurrencyError extends Error {
	errorType = "ConcurrencyError";
	currentStreamRevision?: number;
	constructor(message: string) {
		super(message);
	}
}

export class UndispatchedEventsFoundError extends Error {
	errorType = "UndispatchedEventsFoundError";
	constructor(message: string) {
		super(message);
	}
}
