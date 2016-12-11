import { ProjectionStream } from "./ProjectionStream";
export interface ICommitsFilters {
    dispatched?: number;
    eventFilters?: any;
    streamId?: string;
    fromBucketRevision?: number;
    toBucketRevision?: number;
}
export declare class Bucket {
    constructor(eventStore: any, bucketName: any);
    getCommitsStream(filters: any, options: any): any;
    getCommitsArray(filters: any, options: any): any;
    projectionStream(filters: any, options: any): ProjectionStream;
    lastCommit(filters: any, options: any): any;
    _getCommitsCursor(filters: ICommitsFilters, options: any, sort: any): any;
}
