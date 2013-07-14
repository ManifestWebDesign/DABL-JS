(function(){
	/**
	 * Simple JavaScript Inheritance
	 * Initially by John Resig http://ejohn.org/
	 * MIT Licensed.
	 */

	var initializing = false, fnTest = /xyz/.test(function(){
		xyz;
	}) ? /\b_super\b/ : /.*/;

	function extend(newProps, target, src) {
		var name;

		// Copy the properties over onto the new prototype
		for (name in newProps) {
			// Check if we're overwriting an existing function
			target[name] = typeof newProps[name] === 'function' &&
			typeof src[name] === 'function' && fnTest.test(newProps[name]) ?
			(function(name, fn){
				return function() {
					var tmp = this._super,
						ret;

					// Add a new ._super() method that is the same method
					// but on the super-class
					this._super = src[name];

					// The method only need to be bound temporarily, so we
					// remove it when we're done executing
					ret = fn.apply(this, arguments);
					this._super = tmp;

					return ret;
				};
			})(name, newProps[name]) : newProps[name];
		}
	}

	// The base Class implementation (does nothing)
	var Class = function(){};

	function doesDefinePropertyWork(object) {
		try {
			Object.defineProperty(object, "sentinel", {
				value: 'foo'
			});
			return "sentinel" in object;
		} catch (exception) {
			return false;
		}
	}

	Class.canDefineProperties = doesDefinePropertyWork({});

	// Create a new Class that inherits from this class
	Class.extend = function(instanceProps, classProps) {
		if (typeof instanceProps === 'undefined') {
			instanceProps = {};
		}
		if (typeof classProps === 'undefined') {
			classProps = {};
		}

		var prototype,
			name;

		// Instantiate a base class (but only create the instance,
		// don't run the init constructor)
		initializing = true;
		prototype = new this();
		initializing = false;

		// The dummy class constructor
		function Class() {
			// All construction is actually done in the init method
			if (!initializing && this.init) {
				this.init.apply(this, arguments);
			}
		}

		for (name in this) {
			if (!(name in classProps) && this.hasOwnProperty(name)) {
				Class[name] = this[name];
			}
		}

		extend(instanceProps, prototype, this.prototype);
		extend(classProps, Class, this);

		// Populate our constructed prototype object
		Class.prototype = prototype;

		// Enforce the constructor to be what we expect
		Class.prototype.constructor = Class;

		return Class;
	};

	/**
	 * Normalizes the return value of async and non-async functions to always use the
	 * Deferred/Promise API
	 * @param {function} func A method that can return a Promise or a normal return value
	 * @param {function} success Success callback
	 * @param {function} failure callback
	 */
	Class.callAsync = Class.prototype.callAsync = function callAsync(func, success, failure) {
		var deferred = Deferred(),
			promise = deferred.promise();

		try {
			var result = func.call(this);
			if (result && typeof result.then === 'function') {
				promise = result;
			} else {
				deferred.resolve(result);
			}
		} catch (e) {
			deferred.reject({
				errors: [e]
			});
		}

		if (typeof success === 'function' || typeof failure === 'function') {
			promise.then(success, failure);
		}

		return promise;
	};

	this.Class = Class;
})();