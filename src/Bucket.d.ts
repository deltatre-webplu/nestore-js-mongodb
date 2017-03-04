import { ProjectionStream } from "./ProjectionStream";
import { EventStore } from "./EventStore";
import { Readable as ReadableStream } from "stream";
import { Cursor as MongoCursor } from "mongodb";
import { CommitsFilters, CommitsOptions, CommitData, ProjectionStreamOptions, MongoDbCommit } from "./nestore-types";
export declare class Bucket {
    readonly eventStore: EventStore;
    readonly bucketName: string;
    private collection;
    constructor(eventStore: EventStore, bucketName: string);
    getCommitById(id: number): Promise<CommitData | undefined>;
    getCommitsStream(filters?: CommitsFilters, options?: CommitsOptions): ReadableStream;
    getCommitsArray(filters?: CommitsFilters, options?: CommitsOptions): Promise<CommitData[]>;
    projectionStream(filters?: CommitsFilters, options?: ProjectionStreamOptions): ProjectionStream;
    lastCommit(filters?: CommitsFilters, options?: CommitsOptions): Promise<CommitData | undefined>;
    updateCommit(id: number, events: any[]): Promise<CommitData | undefined>;
    _getCommitsCursor(filters?: CommitsFilters, options?: CommitsOptions, sort?: any): MongoCursor<MongoDbCommit>;
}
