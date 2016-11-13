"use strict";

class ProgressLogger{
	constructor(options){
		options = options || {};

		this._label = options.label || "Processing";
		this._count = options.count;
		this._logger = options.logger || console.log;

		this._value = 0;
		this._logInterval = options.logInterval || 5000; // milliseconds
		this._startTime = Date.now();
		this._lastWrite = this._startTime;
		this._lastValue = 0;

		let nowAsString = (new Date()).toISOString();
		this._logger(`${this._label} started at ${nowAsString}`);
	}

	increment(incValue){
		incValue = incValue || 1;

		this._value += incValue;
		let current = Date.now();
		let elapsed = current - this._lastWrite;
		elapsed = elapsed || 1;

		if (elapsed >= this._logInterval || this._value == this._count){

			let percentage = this._count
				? this._value	* 100 / this._count
				: null;
			let rateAtSeconds = (this._value - this._lastValue) / (elapsed / 1000);

			if (this._count){
				this._logger(`${this._label} ... ${percentage.toFixed(2)}% (${this._value} of ${this._count}, ${rateAtSeconds.toFixed(1)}/sec)`);
			}
			else {
				this._logger(`${this._label} ... ${this._value} (${rateAtSeconds.toFixed(1)}/sec)`);
			}

			this._lastWrite = current;
			this._lastValue = this._value;
		}
	}

	end(){
		let elapsedSecs = (Date.now() - this._startTime) / 1000;
		elapsedSecs = elapsedSecs || 1;

		let rateAtSeconds = this._value / elapsedSecs;

		this._logger(`${this._label} completed (${this._value}) in ${elapsedSecs.toFixed(1)} seconds (${rateAtSeconds.toFixed(1)}/sec)`);
	}

	value(){
		return this._value;
	}
}

module.exports = {
	ProgressLogger : ProgressLogger
};
