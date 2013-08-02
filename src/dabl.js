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

function equals(a, b) {
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
	return value.getUTCFullYear() + '-' + sPad(value.getUTCMonth() + 1) + '-' + sPad(value.getUTCDate());
}

function constructDate(string) {
	if (string instanceof Date) {
		return string;
	}
	var date;
	if (typeof moment !== 'undefined') {
		date = moment(string).toDate();
	} else {
		date = new Date(Date.parse(string));
	}
	return date;
}