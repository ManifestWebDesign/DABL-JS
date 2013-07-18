describe('RESTAdapter', function() {
	var a = new RESTAdapter('spec/rest-data/'),
	foo,
	Foo = Model.extend('foo', {
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
			var Bar = Model.extend('bar', {
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
			var errorArgs = null;
			foo.id = 2;
			foo.save().then(function() {
				console.log('Unexpected success', arguments);
			}, function(){
				errorArgs = arguments;
			});
			expect(errorArgs[0]).toBe('This is an error!');

			errorArgs = null;
			foo.id = 3;
			foo.save().then(null, function(){
				errorArgs = arguments;
			});
			expect(errorArgs[0]).toBe("An error.\nAnother error.");

			errorArgs = null;
			Foo.find(2).then(null, function(){
				errorArgs = arguments;
			});
			expect(errorArgs[0]).toBe('This is an error!');

			errorArgs = null;
			Foo.find(3).then(null, function(){
				errorArgs = arguments;
			});
			expect(errorArgs[0]).toBe("An error.\nAnother error.");

			errorArgs = null;
			Foo.findAll(2).then(null, function(){
				errorArgs = arguments;
			});
			expect(errorArgs[0] + '').toBe('This is an error!');

			errorArgs = null;
			foo.id = 2;
			foo.remove().then(null, function(){
				errorArgs = arguments;
			});
			expect(errorArgs[0] + '').toBe('This is an error!');
		});
	});
});