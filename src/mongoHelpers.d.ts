import { Long as MongoDbLong, Binary as MongoDbBinary } from "mongodb";
import { CommitData, MongoDbCommit } from "./nestore-types";
export declare const MongoHelpers: {
    stringToBinaryUUID: (value: string) => MongoDbBinary;
    binaryUUIDToString: (value: MongoDbBinary) => string;
    binaryCSUUIDToString: (value: MongoDbBinary) => string;
    intToLong: (value: number) => MongoDbLong;
    mongoDocToCommitData: {
        (doc: undefined): undefined;
        (doc: MongoDbCommit): CommitData;
    };
    commitDataToMongoDoc: (commit?: CommitData | undefined) => MongoDbCommit | undefined;
    isDuplicateError: (err: any) => boolean;
};
