import { Long as MongoDbLong, Binary as MongoDbBinary } from "mongodb";
export declare function stringToBinaryUUID(value: any): MongoDbBinary;
export declare function binaryUUIDToString(value: any): string;
export declare function intToLong(value: any): MongoDbLong;
