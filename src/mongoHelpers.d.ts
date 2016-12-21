import { Long as MongoDbLong, Binary as MongoDbBinary } from "mongodb";
export declare const MongoHelpers: {
    stringToBinaryUUID: (value: string) => MongoDbBinary;
    binaryUUIDToString: (value: any) => string;
    intToLong: (value: number) => MongoDbLong;
};
