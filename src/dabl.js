function sPad(value) {
	value = value + '';
	return value.length === 2 ? value : '0' + value;
}

function copy(obj) {
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
}

function equals(a, b, type) {
	if (type && type === Model.FIELD_TYPE_DATE) {
		a = formatDate(a);
		b = formatDate(b);
	} else if (type && type === Model.FIELD_TYPE_TIMESTAMP) {
		a = constructDate(a);
		b = constructDate(b);
	}

	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime();
	}

	if (typeof a === 'object') {
		return JSON.stringify(a) === JSON.stringify(b);
	}
	return a === b;
}

function formatDate(value) {
	if (!(value instanceof Date)) {
		value = constructDate(value);
	}
	if (!value) {
		return null;
	}
	return value.getUTCFullYear() + '-' + sPad(value.getUTCMonth() + 1) + '-' + sPad(value.getUTCDate());
}

function constructDate(value) {
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
}