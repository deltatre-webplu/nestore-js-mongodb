import { MongoClientOptions, Db as MongoDatabase, Collection as MongoCollection } from "mongodb";
import { Bucket } from "./Bucket";
export interface EventStoreOptions {
    url: string;
    connectOptions?: MongoClientOptions;
}
export declare class EventStore {
    private options;
    db: MongoDatabase | undefined;
    constructor(options: EventStoreOptions);
    connect(): Promise<EventStore>;
    close(): Promise<void>;
    bucket(bucketName: string): Bucket;
    mongoCollection(bucketName: string): MongoCollection;
}
