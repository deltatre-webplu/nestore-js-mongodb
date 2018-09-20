import { CommitData } from "./nestore-types";
import { EventStore } from "./EventStore";
export interface AutoIncrementStrategy {
    increment(bucketName: string, lastCommit?: CommitData): Promise<number>;
}
export declare class IncrementCountersStrategy implements AutoIncrementStrategy {
    private eventStore;
    private collection;
    constructor(eventStore: EventStore);
    increment(bucketName: string, lastCommit?: CommitData): Promise<number>;
    private createCounterAsync;
}
