"use strict";

class ProgressLogger{
	constructor(options){
		options = options || {};

		this._label = options.label || "Processing";
		this._count = options.count;
		this._logger = options.logger || console.log;

		this._value = 0;
		this._logInterval = options.logInterval || 5000; // milliseconds
		this._lastWrite = Date.now();
		this._startTime = Date.now();

		this._logger(`${this._label} started at ${new Date()}`);
	}

	increment(incValue){
		incValue = incValue || 1;

		this._value += incValue;
		let current = Date.now();
		let elapsed = current - this._lastWrite;

		let percentage = this._count
			? this._value	* 100 / this._count
			: null;

		if (elapsed > this._logInterval || percentage == 100){
			this._lastWrite = current;

			if (this._count){
				this._logger(`${this._label} ... ${percentage.toFixed(2)}% (${this._value} of ${this._count})`);
			}
			else {
				this._logger(`${this._label} ... ${this._value}`);
			}
		}
	}

	end(){
		let elapsed = (Date.now() - this._startTime) / 1000;
		this._logger(`${this._label} completed (${this._value}) in ${elapsed.toFixed(1)} seconds`);
	}

	value(){
		return this._value;
	}
}

module.exports = {
	ProgressLogger : ProgressLogger
};
