/// <reference types="node" />
import { ProjectionStream } from "./ProjectionStream";
import { EventStore } from "./EventStore";
import { Readable as ReadableStream } from "stream";
import { Cursor as MongoCursor } from "mongodb";
import { WriteResult, WriteOptions, CommitsFilters, CommitsOptions, CommitData, ProjectionStreamOptions, MongoDbCommit, SortableCommitsOptions } from "./nestore-types";
export declare class Bucket {
    readonly eventStore: EventStore;
    readonly bucketName: string;
    private collection;
    private indexesEnsured;
    constructor(eventStore: EventStore, bucketName: string);
    randomStreamId(): string;
    ensureIndexes(): Promise<void>;
    write(streamId: string, expectedStreamRevision: number, events: any[], options?: WriteOptions): Promise<WriteResult>;
    getCommitById(id: number): Promise<CommitData | undefined>;
    getCommitsStream(filters?: CommitsFilters, options?: SortableCommitsOptions): ReadableStream;
    getCommitsArray(filters?: CommitsFilters, options?: SortableCommitsOptions): Promise<CommitData[]>;
    projectionStream(filters?: CommitsFilters, options?: ProjectionStreamOptions): ProjectionStream;
    lastCommit(filters?: CommitsFilters, options?: CommitsOptions): Promise<CommitData | undefined>;
    updateCommit(id: number, events: any[]): Promise<CommitData | undefined>;
    streamRevision(streamId: string): Promise<number>;
    _getCommitsCursor(filters?: CommitsFilters, options?: SortableCommitsOptions): MongoCursor<MongoDbCommit>;
    private createCommit;
}
