DABL-JS
=======

JavaScript ORM

## Usage
Include the DABL base and any adapters:

```html
<script src="js/dabl.min.js"></script>
<script src="js/dabl.adapter.rest.min.js"></script>
<script src="js/dabl.adapter.rest.angular.min.js"></script>
```

## Angular App Example

```javascript

angular.module('app', [])

// initialize dabl service with integrated $q, so that scopes are $apply'd correctly
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


## Model Instance Methods

* init(values) - Constructor with object hash of field values
* toString()
* copy() - Returns a new instance with the same values, minus the primary keys
* isModified() - Returns true if any field values have been modified
* isModified(field) - Returns true if the given field has been modified
* getModified() - Returns a hash of modified field names, keyed by the field names with the value true.
* resetModified() - Consider the current state to be unmodified
* revert() - Revert all field values to the last known saved state
* fromJSON(values) - Update this object with the values
* toJSON() - Returns a plain object with the object's values
* hasKeyValues() - Returns true if all primary key fields are not null
* getKeyValues() - Returns a hash of key field names and their values
* isNew() - Returns true if this object has not been saved
* setNew() - Consider this object new
* validate() - Returns true if all required fields have a truthy value
* getValidationErrors() - Returns an array of the validation errors from the last validation run
* save() - Save this object to the adapter's datasource.  Returns a promise.
* remove() - Delete this object from the adapter's datasource.  Returns a promise.
