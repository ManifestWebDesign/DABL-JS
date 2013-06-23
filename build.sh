#!/bin/sh

/bin/rm dabl.js 2>/dev/null
/bin/rm dabl.min.js 2>/dev/null

for i in src/*.js ; do
	echo >> dabl.min.js
	echo '/* '$(basename $i)' */' >> dabl.min.js
	java -jar lib/yuicompressor-2.4.6.jar --type js $i >>dabl.min.js
	echo >> dabl.min.js

	echo >> dabl.js
	echo '/* '$(basename $i)' */' >> dabl.js
	cat $i >> dabl.js
	echo >> dabl.js
done

for i in src/query/*.js ; do
	echo >> dabl.min.js
	echo '/* '$(basename $i)' */' >> dabl.min.js
	java -jar lib/yuicompressor-2.4.6.jar --type js $i >>dabl.min.js
	echo >> dabl.min.js

	echo >> dabl.js
	echo '/* '$(basename $i)' */' >> dabl.js
	cat $i >> dabl.js
	echo >> dabl.js
done

for i in src/adapter/*.js ; do
	echo >> dabl.min.js
	echo '/* '$(basename $i)' */' >> dabl.min.js
	java -jar lib/yuicompressor-2.4.6.jar --type js $i >>dabl.min.js
	echo >> dabl.min.js

	echo >> dabl.js
	echo '/* '$(basename $i)' */' >> dabl.js
	cat $i >> dabl.js
	echo >> dabl.js
done