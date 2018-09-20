/// <reference types="node" />
import { Readable as ReadableStream } from "stream";
import { Bucket } from "./Bucket";
import { CommitsFilters, ProjectionStreamOptions, CommitData } from "./nestore-types";
export declare class ProjectionStream extends ReadableStream {
    private bucket;
    private filters;
    private options;
    private closed;
    private source;
    private timeoutObj;
    constructor(bucket: Bucket, filters: CommitsFilters, options: ProjectionStreamOptions);
    close(): Promise<any>;
    isClosed(): boolean;
    resume(): this;
    on(event: "close" | "end" | "readable", listener: () => void): this;
    on(event: "data", listener: (chunk: Buffer | string) => void): this;
    on(event: "data", listener: (chunk: CommitData) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "wait", listener: (info: {
        filters: CommitsFilters;
    }) => void): this;
    pause(): this;
    _read(): void;
    private _startTimer;
    private _stopTimer;
    private _loadNextStream;
}
