describe('RESTAdapter', function() {
	var a = new dabl.RESTAdapter('spec/rest-data/'),
	foo,
	Foo = dabl.Model.extend('foo', {
		adapter: a,
		url: 'foo/:id.json',
		fields: {
			id: { type: 'int', key: true, computed: true },
			name: { type: String, value: 'default name for entity', required: true },
			list: Array,
			created: Date,
			updated: Date
		},
		prototype: {
//			save: function() {
//				return this._super.apply(this, arguments).then(function(){
//					console.log('save succeeded');
//				}, function(){
//					console.log('save failed', arguments);
//				});
//			}
		}
	});

	beforeEach(function() {
		foo = new Foo;
		$(document).unbind('ajaxStart');
		jQuery.ajaxSetup({
			async: false
		});
	});

	describe('init', function(){
		it ('should require the model to have a url template', function(){
			var Bar = dabl.Model.extend('bar', {
				adapter: a,
				fields: {}
			}),
			bar = new Bar,
			saveFailed = false;
			bar.save().then(null, function(){
				saveFailed = true;
			});
			expect(saveFailed).toBe(true);
		});
	});

	describe('save', function(){
		it ('should trigger an ajax call for any new object', function(){
			var ajaxEvent = false;
			$(document).ajaxStart(function(){
				ajaxEvent = true;
			});
			foo.id = 1;
			foo.save();
			expect(ajaxEvent).toBe(true);
		});

		it ('should always fail with the same fail handler arguments', function(){
			var errorArgs = null,
				errorHandler = function(){
				errorArgs = arguments;
			};
			foo.id = 2;
			foo.save().then(function() {
				console.log('Unexpected success', arguments);
			}, function(){
				console.log(arguments[0].stack);
				errorArgs = arguments;
			});
			expect(errorArgs[0]).toBe('This is an error!');

			errorArgs = null;
			foo.id = 3;
			foo.save().then(null, errorHandler);
			expect(errorArgs[0]).toBe("An error.\nAnother error.");

			errorArgs = null;
			Foo.find(2).then(null, errorHandler);
			expect(errorArgs[0]).toBe('This is an error!');

			errorArgs = null;
			Foo.find(3).then(null, errorHandler);
			expect(errorArgs[0]).toBe("An error.\nAnother error.");

			errorArgs = null;
			Foo.findAll(2).then(null, errorHandler);
			expect(errorArgs[0] + '').toBe('This is an error!');

			errorArgs = null;
			foo.id = 2;
			foo.remove().then(null, errorHandler);
			expect(errorArgs[0] + '').toBe('This is an error!');
		});
	});

	describe('find', function(){
		it ('should fire promise successHandler if response is an object with the primary key', function(){
			var successFired;
			var successCallback = function(){
				successFired = true;
			};

			// object with primary key set
			successFired = false;
			Foo.find(1).then(successCallback);
			expect(successFired).toBe(true);
		});
	});

	describe('find', function(){
		it ('should fire promise errorHandler if response is not an object with the primary key', function(){
			var errorFired;
			var errorCallback = function(){
				errorFired = true;
			};

			// object with error key set
			errorFired = false;
			Foo.find(2).then(null, errorCallback);
			expect(errorFired).toBe(true);

			// object with errors key set
			errorFired = false;
			Foo.find(3).then(null, errorCallback);
			expect(errorFired).toBe(true);

			// empty response
			errorFired = false;
			Foo.find(4).then(null, errorCallback);
			expect(errorFired).toBe(true);

			// response with NULL
			errorFired = false;
			Foo.find(5).then(null, errorCallback);
			expect(errorFired).toBe(true);
		});
	});

	ddescribe('routing', function(){
		it ('should create correct url routes', function(){
			var r = new Route('/dashboards/:id.json');
			expect(r.urlGet()).toEqual('/dashboards.json');
			expect(r.urlGet({id: 5})).toEqual('/dashboards/5.json');
			r = new Route('/:id.json/dashboards');
			expect(r.urlGet({id: 5})).toEqual('/5.json/dashboards');
			expect(r.urlGet()).toEqual('/.json/dashboards');
		});
	});
});