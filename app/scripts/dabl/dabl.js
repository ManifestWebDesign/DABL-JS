dabl = typeof dabl === "undefined" ? {} : dabl;

dabl.sPad = function(value) {
	value = value + '';
	return value.length === 2 ? value : '0' + value;
};

dabl.copy = function(obj) {
	if (obj === null) {
		return null;
	}

	if (obj instanceof Model) {
		return obj.constructor(obj);
	}

	if (obj instanceof Array) {
		return obj.slice(0);
	}

	if (obj instanceof Date) {
		return new Date(obj.getTime());
	}

	switch (typeof obj) {
		case 'string':
		case 'boolean':
		case 'number':
		case 'undefined':
		case 'function':
			return obj;
	}

	var target = {};
	for (var i in obj) {
		if (obj.hasOwnProperty(i)) {
			target[i] = obj[i];
		}
	}
	return target;
};

dabl.equals = function(a, b, type) {
	if (type && type === Model.FIELD_TYPE_DATE) {
		a = dabl.formatDate(a);
		b = dabl.formatDate(b);
	} else if (type && type === Model.FIELD_TYPE_TIMESTAMP) {
		a = dabl.constructDate(a);
		b = dabl.constructDate(b);
	}

	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime();
	}

	if (type && type === JSON) {
		if (typeof a !== 'string') {
			a = JSON.stringify(a);
		}
		if (typeof b !== 'string') {
			b = JSON.stringify(b);
		}
	} else if (typeof a === 'object') {
		return JSON.stringify(a) === JSON.stringify(b);
	}
	return a === b;
};

dabl.formatDate = function(value) {
	if (!(value instanceof Date)) {
		value = dabl.constructDate(value);
	}
	if (!value) {
		return null;
	}
	return value.getUTCFullYear() + '-' + dabl.sPad(value.getUTCMonth() + 1) + '-' + dabl.sPad(value.getUTCDate());
};

dabl.constructDate = function(value) {
	if (value === false || value === '' || typeof value === 'undefined') {
		return null;
	}

	if (value instanceof Date) {
		return value;
	}

	var date = new Date(value);
	if (isNaN(date.getTime())) {
		throw new Error(value + ' is not a valid date');
	}
	return date;
};
