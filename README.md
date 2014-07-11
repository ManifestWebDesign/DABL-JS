DABL-JS
=======

DABL JS is a JavaScript ORM inspired by the likes of:
* JayData (http://jaydata.org/)
* Breeze (http://breezejs.com/)
* Persistence.js (https://github.com/coresmart/persistencejs)
* Angular Resource (https://docs.angularjs.org/api/ngResource/service/$resource)

The primary goals of DABL JS are:
* To create a generic interface/ORM for JavaScript models
* Keep a smaller codebase than JayData and Breeze
* Run on older browsers, such as IE 8, unlike Persistence.js and others
* Avoid getter and setter methods for records, for compatibility with frameworks like Angular JS
* Provide the same routing templates, but features that Angular Resource does not, such as:
	* Model subclassing
	* Promises
	* "Strong" Field data types
	* Foreign keys
	* Adapters for CRUD that aren't necessarily HTTP REST, such as SQLite databases
* Work as a standalone ORM or integrate with frameworks Angular JS, tying into the Angular scope lifecycle

## Installation
```
bower install dabl
```

or

```
git clone git@github.com:ManifestWebDesign/DABL-JS.git
```

## Usage
Include the DABL base and any adapters required for your project:

```html
<script src="js/dabl.min.js"></script>
<script src="js/dabl.adapter.rest.min.js"></script> <!-- AngularRESTAdapter -->
<script src="js/dabl.adapter.rest.angular.min.js"></script> <!-- AngularRESTAdapter extends RESTAdapter -->
```


## Defining a Model
```javascript
var MyClass = dabl.Model.extend('MyClass', {
	adapter: adapter,
	url: 'my-class-records/:id.json',
	fields: {
		id: { type: 'int', key: true, computed: true }, // primary key
		moneys: Number, // number
		otherModel: OtherModel, // instance of another model class
		listOfModels: { type: Array, elementType: OtherModel }, // if you use instance.listOfModels.push({ }), the object will be cast to an instance of OtherModel
		listOfDates: { type: Array, elementType: Date },
		list: Array, // generic array with no type specified
		hash: Object, // Object in memory and an Object when saved
		jsonString: JSON, // Object in memory, but a JSON string when saved
		created: Date // Date in memory, ISO string like 2014-07-11T06:23:28.894Z when saved
	},
	prototype: {
		init: function(){}, // optional override of constructor.  Call this._super() to call parent constructor,
		customMethod: function(){} // any other methods you want...
	}
});
```


## Model Instance Methods

* `init(values)` - Constructor with object hash of field values
* `toString()`
* `copy()` - Returns a new instance with the same values, minus the primary keys
* `isModified()` - Returns true if any field values have been modified
* `isModified(field)` - Returns true if the given field has been modified
* `getModified()` - Returns a hash of modified field names, keyed by the field names with the value true.
* `resetModified()` - Consider the current state to be unmodified
* `revert()` - Revert all field values to the last known saved state
* `fromJSON(values)` - Update this object with the values
* `toJSON()` - Returns a plain object with the object's values
* `hasKeyValues()` - Returns true if all primary key fields are not null
* `getKeyValues()` - Returns a hash of key field names and their values
* `isNew()` - Returns true if this object has not been saved
* `setNew()` - Consider this object new
* `validate()` - Returns true if all required fields have a truthy value
* `getValidationErrors()` - Returns an array of the validation errors from the last validation run
* `save()` - Save this object to the adapter's datasource.  Returns a promise.
* `remove()` - Delete this object from the adapter's datasource.  Returns a promise.


## Model Class Methods

* `isFieldType(type)` - Returns true if `type` is a valid field type.
* `isTemporalType(type)` - Returns true if `type` is a time based type: Date or 'TIME'
* `isTextType(type)` - Returns true if `type` is a text based type: String or 'TEXT'
* `isNumericType(type)` - Returns true if `type` is a numeric type: Number or 'int'
* `isIntegerType(type)` - Returns true if `type` is an integer type: 'int'
* `isObjectType(type)` - Returns true if `type` is an object of some sort: JSON, Array, Object or a function (assumed to be a constructor)
* `coerceValue(value, field)` - Attempts to "cast" or convert the given `value` to the field type specified in `field`.
* `coerceValues(values)` - Takes an object of `values`, keyed by field name, and attemps to coerce the values to the field types.
* `convertArray(values, elementType)` - Takes an array of `values` and attemps to convert them to the given `elementType`.
* `getAdapter()` - Returns the adapter that is used for actions like find, remove, save, etc.
* `setAdapter(adapter)` - Sets the adapter that is used for actions like find, remove, save, etc.
* `inflate(object)` - Converts a normal `object` into an instance of this class and returns that new isntance.
* `inflateArray(array)` - Inflates the values of `array` in place, unless `array` is not an instanceof Array.  If it is not, then a new Array will be created and populated with the values of `array`.
* `getTableName()` - Get the "table" name of this class' dataset.
* `getFields()` - Returns a hash of this class' field definitions, keyed by field name.
* `getField(fieldName)` - Returns the field definition for the given `fieldName`.
* `getFieldType(fieldName)` - Returns the type part of the field definition for the given `fieldName`.
* `hasField(fieldName)` - Returns true if a field definition exists for the given `fieldName`.
* `getKeys()` - Returns an Array of field names that are primary keys.
* `addField(fieldName, field)` - Adds a `field` definition for the given `fieldName`.  `field` may be just a type like `Date` or an object like `{ type: 'int', key: true, computed: true, required: true }`.
* `extend(table, options)` - Creates a subclass of this.  `table` is the table/dataset name.  `options` is a model definition (see the defining a model section above).
* `toString()` - Retuns the table/dataset name.
* `countAll([query arguments])` - Returns a count of the objects that match the given query.  This call is passed through to the adapter.
* `findAll([query arguments])` - Returns an Array of objects that match the given query.  This call is passed through to the adapter.
* `removeAll([query arguments])` - Removes the objects that match the given query.  This call is passed through to the adapter.
* `find([query arguments])` - Returns a single object that matches the given query.  This call is passed through to the adapter.
* `findBy(fieldName, value)` - Alias of find, indended to be a key value lookup.


## Angular App Example

```javascript

angular.module('app', [])

// initialize dabl service with integrated $q, so that scopes are $apply'd correctly
// in the future, this will be done internally and should not be necessary
.service('dabl', ['$q', function($q) {
	// allows dabl promises to use Angular $q
	dabl.Deferred = function() {
		var def = $q.defer(),
			promise = def.promise;

		def.promise = function() {
			return promise;
		};
		return def;
	};

	return dabl;
}])

// setup 'db' service with models
.service('db', ['dabl', '$http', function(dabl, $http) {
	var adapter = new dabl.AngularRESTAdapter('rest/', $http),
		Model = dabl.Model,
		db = {};

  // base model is the parent class for models with id, created, and updated fields
	var BaseModel = Model.extend('base_model', {
		adapter: adapter,
		fields: {
			id: { type: 'int', key: true, computed: true },
			created: Date,
			updated: Date
		}
	});

	db.Author = BaseModel.extend('author', {
		url: 'authors/:id.json',
		fields: {
			// id, created, updated
			name: String
		},
		prototype: {
			toString: function() {
				return this.name;
			}
		}
	});

	db.Post = BaseModel.extend('post', {
		url: 'posts/:id.json',
		fields: {
			// id, created, updated
			content: String,
			author: db.Author
		}
	});

  // circular foreign keys require a separate addField call
	db.Author.addField('posts', { type: Array, elementType: db.Post });

	return db;
}])

.controller('MainCtrl', ['$scope', 'db', function($scope, db) {

	$scope.data = [];

	var search = {
		limit: 10000,
		order_by: 'id'
	};

	var doSearch = function() {
		db.Author.findAll(search).then(function(r){
			$scope.authors = r;
		});
	};
	doSearch();
	
	$scope.deleteAuthor = function (author) {
	  if (author.isModified() && !confirm("This is author has been modified.  Are you sure?")) {
	    return;
	  }
	  author.remove().then(function(){
	    // success
	  }, function(){
	    // error
	  });
	};
	
	$scope.getAuthorById = function (id) {
	  return db.Author.find(id).then(function(){
	    // success
	  }, function(){
	    // error
	  });
	};

}]);

```
