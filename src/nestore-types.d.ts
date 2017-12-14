import { Binary as MongoDbBinary, ReadPreference as MongoDbReadPreference } from "mongodb";
export interface CommitsFilters {
    dispatched?: number;
    eventFilters?: any;
    streamId?: string;
    fromBucketRevision?: number;
    toBucketRevision?: number;
    fromStreamRevision?: number;
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
export declare type SortDirection = 1 | -1;
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
    errorType: string;
    currentStreamRevision?: number;
    constructor(message: string);
}
export declare class UndispatchedEventsFoundError extends Error {
    errorType: string;
    constructor(message: string);
}
