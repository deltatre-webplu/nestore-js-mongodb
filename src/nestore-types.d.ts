import { Binary as MongoDbBinary } from "mongodb";
export interface CommitsFilters {
    dispatched?: number;
    eventFilters?: any;
    streamId?: MongoDbBinary;
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
    Events: Array<any>;
}
