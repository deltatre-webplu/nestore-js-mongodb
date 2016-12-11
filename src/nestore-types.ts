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
