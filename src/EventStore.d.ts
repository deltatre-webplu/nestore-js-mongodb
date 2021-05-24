import { MongoClientOptions, Db, Collection } from "mongodb";
import { Bucket } from "./Bucket";
import { AutoIncrementStrategy } from "./autoIncrementStrategies";
export interface EventStoreOptions {
    url: string;
    connectOptions?: MongoClientOptions;
}
export declare class EventStore {
    private client;
    db: Db | undefined;
    autoIncrementStrategy: AutoIncrementStrategy;
    constructor(options: EventStoreOptions);
    connect(): Promise<EventStore>;
    close(): Promise<void>;
    bucket(bucketName: string): Bucket;
    mongoCollection(bucketName: string): Collection;
}
