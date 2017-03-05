import { Binary as MongoDbBinary } from "mongodb";
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
    _id: number;
    StreamId: string;
    StreamRevisionStart: number;
    StreamRevisionEnd: number;
    Dispatched: boolean;
}
export interface CommitData extends CommitInfo {
    Events: any[];
}
export interface MongoDbCommit {
    _id: number;
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
export declare class ConcurrencyError extends Error {
    constructor(message: string);
}
export declare class UndispatchedEventsFoundError extends Error {
    constructor(message: string);
}
