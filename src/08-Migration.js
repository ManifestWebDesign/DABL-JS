Migration = {};

Migration.schema = Model.create({
	table: 'schema_definitions',
	primaryKeys : ['id'],
	columns: {
		id: 'INTEGER',
		table_name: 'TEXT',
		column_names: 'TEXT',
		column_types: 'TEXT'
	}
});

// Primary method for initializing Migration via manual or automigration
Migration.migrate = function(options) {
	if (!options) {
		options = {};
	}

	var tableName, migrations = {}, startVersion, targetVersion, i;

	// Drop tables
	if(options.refresh) {
		for (tableName in Model.models){
			Adapter.execute('DROP TABLE IF EXISTS ' + tableName);
//				Migration.each(model.options.hasAndBelongsToMany, function(assocTable) {
//					var mappingTable = [model.table, assocTable].sort().toString().replace(',', '_');
//					var sql = 'DROP TABLE IF EXISTS ' + mappingTable;
//					Adapter.execute(sql);
//				});
		}
		Migration.setupSchema(true);
	} else {
		Migration.setupSchema();
	}

	if(Migration.migrations)
		migrations = Migration.migrations;

	// test for apparently-valid obj literal based on migration 1 being present
	if(migrations[1] && migrations[1].constructor === Object) {
		startVersion = Migration.currentSchemaVersion();
		targetVersion = Infinity;

		// did user specify a migration number?
		if(options.number !== null && typeof options.number != 'undefined')
			targetVersion = options.number;
		else if(typeof options === 'number')
			targetVersion = options;

		// actually handle a migrations object
		i = startVersion;

		do {
			// schema is already up to date
			if(i === targetVersion) {
				// up to date
				return;
			}
			// migrate up
			else if(i < targetVersion) {
				i += 1;
				if(migrations[i] !== null && typeof migrations[i] != 'undefined')
					migrations[i].up();
				else
					break;
			}
			// migrate down
			else {
				migrations[i].down();
				i -= 1;
			}
			Migration.updateSchemaVersion(i);
		} while(migrations[i]);
	} else {
		// developer can choose to use automigrations while in dev mode
//		Migration.models.each(function(model) {
//			var sql = 'CREATE TABLE IF NOT EXISTS ' + model.table + '(id INTEGER PRIMARY KEY AUTOINCREMENT';
//			for (var colName in model.options.columns) {
//				var colType = model.options.columns[colName];
//				if(colName !== 'id')
//					sql += (', ' + colName + ' ' + colType.toUpperCase());
//			}
//			sql += ')';
//			Adapter.execute(sql);

//			Migration.each(model.options.hasAndBelongsToMany, function(assocTable, association) {
//				var mappingTable = [model.table, assocTable].sort().toString().replace(',', '_');
//				var localKey = model.options.foreignKey;
//				var foreignKey = Migration.models.get(assocTable).options.foreignKey;
//				var keys = [localKey, foreignKey].sort();
//				var sql = 'CREATE TABLE IF NOT EXISTS ' + mappingTable + '(' + keys[0] + ' INTEGER, ' + keys[1] + ' INTEGER)';
//				Adapter.execute(sql);
//			});
//
//			model.options.columns.id = 'INTEGER';
//		});
	}

	// handle fixture data, if passed in fixtures erase all old data
//	if(options && options.refresh && Migration.fixtures)
//		Migration.loadFixtures();
};

//Migration.loadFixtures = function() {
//	var fixtures = Migration.fixtures;
//	Migration.each(fixtures.tables, function(tableData, tableName) {
//		Migration.each(tableData, function(record) {
//			Migration.models.get(tableName).create(record);
//		});
//	});
//
//	if(!fixtures.mappingTables)
//		return;
//
//	Migration.each(fixtures.mappingTables, function(tableData, tableName) {
//		Migration.each(tableData, function(colData) {
//			var dataHash = new Migration.Hash(colData);
//			var sql = 'INSERT INTO ' + tableName + ' (' + dataHash.getKeys().toString() + ') VALUES(' + dataHash.getValues().toString() + ')';
//			Adapter.execute(sql);
//		});
//	});
//};

// used elsewhere

Migration.setupSchema = function(force) {
	var sql;
	Migration.createTable('schema_migrations', {
		version: 'TEXT'
	});
	if(Adapter.count('SELECT * FROM schema_migrations') === 0) {
		sql = 'INSERT INTO schema_migrations (version) VALUES(0)';
		Adapter.execute(sql);
	}
	if(force && Adapter.count('SELECT * FROM schema_migrations') === 1) {
		sql = 'UPDATE schema_migrations set version = 0';
		Adapter.execute(sql);
	}
	Migration.createTable('schema_definitions', {
		id: 'INTEGER',
		table_name: 'TEXT',
		column_names: 'TEXT',
		column_types: 'TEXT'
	});
};

Migration.writeSchema = function(tableName, cols) {
	if(tableName === 'schema_definitions' || tableName === 'schema_migrations')
		return;
	var keys = [],
		values = [],
		cName,
		names,
		types,
		table;
	for (cName in cols) {
		keys.push(cName);
		values.push(cols[cName]);
	}
	names = keys.join();
	types = keys.join();
	table = Migration.schema.findBy('table_name', tableName);
	if(table) {
		table.column_names = names;
		table.column_types = types;
		table.save();
	} else {
		table = new Migration.schema;
		table.fromArray({
			table_name: tableName,
			column_names: names,
			column_types: types
		});
		table.save();
	}
};

Migration.readSchema = function(tableName) {
	if(tableName === 'schema_definitions' || tableName === 'schema_migrations')
		return null;
	var table = Migration.schema.findBy('table_name', tableName),
		column_names = table.column_names.split(','),
		column_types = table.column_types.split(','),
		cols = {},
		i,
		len = column_names.length,
		col;
	for (i = 0; i < len; ++i){
		col = column_names[i];
		cols[col] = column_types[i];
	}
	return cols;
};

Migration.currentSchemaVersion = function() {
	var sql = 'SELECT version FROM schema_migrations LIMIT 1';

	return parseInt(Adapter.execute(sql)[0].version, 10);
};

Migration.updateSchemaVersion = function(number) {
	var sql = 'UPDATE schema_migrations SET version = ' + number;
	Adapter.execute(sql);
};

Migration.modifyColumn = function(tableName, columnName, options) {
//
	if (!options) {
		throw new Error('MIGRATION_EXCEPTION: Not a valid column modification');
	}

	var oldCols = Migration.readSchema(tableName),
		newCols = {},
		colName,
		colType;

	for (colName in oldCols) {
		colType = oldCols[colName];
		switch(options['modification']) {
			case 'remove':
				if(colName !== columnName)
					newCols[colName] = colType;
				break;

			case 'rename':
				if(colName !== columnName) {
					newCols[colName] = colType;
				}
				else {
					newCols[options.newName] = colType;
				}
				break;

			case 'change':
				if(colName !== columnName) {
					newCols[colName] = colType;
				}
				else {
					newCols[colName] = options.newType;
				}
				break;

			default:
				throw('MIGRATION_EXCEPTION: Not a valid column modification');
		}
	}

	Adapter.transaction(function() {
		var records = Adapter.execute('SELECT * FROM ' + tableName);
		if (records.length != 0) {
			throw new Error('Modify column not quite ready yet...');
		}

		Migration.dropTable(tableName);
		Migration.createTable(tableName, newCols);

		for (var i = 0, len = records.length; i < len; ++i) {
			 var record = records[i];
			 switch(options.modification) {
				 case 'remove':
					 delete record[columnName];
					 Model.insert(tableName, record, Adapter.getConnection());
					 break;
				 case 'rename':
					 record[options.newName] = record[columnName];
					 delete record[columnName];
					 Model.insert(tableName, record, Adapter.getConnection());
					 break;
				 case 'change':
					 Model.insert(tableName, record, Adapter.getConnection());
					 break;
				 default:
					 throw('MIGRATION_EXCEPTION: Not a valid column modification');
			 }
		}
	});
};


// used in actual migrations

Migration.createTable = function(name, columns) {
	if(!name || !columns) {
		return;
	}
	var sql = 'CREATE TABLE IF NOT EXISTS ' + name + "\n",
		colName,
		colType,
		i = 0;

	sql += '(';
	for (colName in columns) {
		colType = columns[colName];
		if (0 !== i) {
			sql += ",\n";
		}
		sql += (colName + ' ' + colType);
		if (colName === 'id') {
			sql += ' PRIMARY KEY AUTOINCREMENT';
		}
		++i;
	}
	sql += ')';
	Adapter.execute(sql);

	Migration.writeSchema(name, columns);
};

Migration.dropTable = function(name) {
	var sql = 'DROP TABLE IF EXISTS ' + name,
		schemaTable;
	Adapter.execute(sql);
	schemaTable = Migration.schema.findBy('table_name', name);
	schemaTable.destroy();
};

Migration.renameTable = function(oldName, newName) {
	var sql = 'ALTER TABLE ' + oldName + ' RENAME TO ' + newName,
		schemaTable;
	Adapter.execute(sql);
	schemaTable = Migration.schema.findBy('table_name', oldName);
	schemaTable.table_name = newName;
	schemaTable.save();
};

Migration.addColumn = function(tableName, columnName, dataType) {
	var sql = 'ALTER TABLE ' + tableName + ' ADD COLUMN ' + columnName + ' ' + dataType,
		cols;
	Adapter.execute(sql);
	cols = Migration.readSchema(tableName);
	cols[columnName] = dataType;
	Migration.writeSchema(tableName, cols);
};

Migration.removeColumn = function(tableName, columnName) {
	Migration.modifyColumn(tableName, columnName, {
		modification: 'remove'
	});
};

Migration.renameColumn = function(tableName, columnName, newColumnName) {
	var options = {
		modification: 'rename',
		newName: newColumnName
	};
	Migration.modifyColumn(tableName, columnName, options);
};

Migration.changeColumn = function(tableName, columnName, type) {
	var options = {
		modification: 'change',
		newType: type
	};
	Migration.modifyColumn(tableName, columnName, options);
};

Migration.addIndex = function(tableName, columnName, unique) {
	var sql = 'CREATE' + (unique ? ' UNIQUE ' : ' ') + 'INDEX IF NOT EXISTS ' + tableName + '_' + columnName + '_index ON ' + tableName + ' (' + columnName + ')';
	Adapter.execute(sql);
};

Migration.removeIndex = function(tableName, columnName) {
	var sql = 'DROP INDEX IF EXISTS ' + tableName + '_' + columnName + '_index';
	Adapter.execute(sql);
};