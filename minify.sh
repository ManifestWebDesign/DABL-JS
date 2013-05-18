#!/bin/sh
/bin/rm dabl.min.js 2>/dev/null
for i in src/*.js ; do
	echo >> dabl.min.js
	echo '/* '$(basename $i)' */' >> dabl.min.js
	java -jar yuicompressor-2.4.6.jar --type js $i >>dabl.min.js
	echo >> dabl.min.js
done
