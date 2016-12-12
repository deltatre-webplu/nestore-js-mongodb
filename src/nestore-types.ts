export interface CommitsFilters {
	dispatched? : number;
	eventFilters? : any;
	streamId? : string;
	fromBucketRevision? : number;
	toBucketRevision? : number;
}

export interface CommitsOptions {
	batchSize? : number;
}

export interface ProjectionStreamOptions extends CommitsOptions {
  waitInterval? : number;
}

export interface CommitInfo {
	_id : number; // BucketRevision
	StreamId : string;
	StreamRevisionStart : number;
	StreamRevisionEnd : number;
	Dispatched : boolean;
}

export interface CommitData extends CommitInfo {
	Events : Array<any>;
}
