#!/bin/sh
/bin/rm dabl.min.js 2>/dev/null
for i in "src/*.js" ; do java -jar yuicompressor-2.4.6.jar --type js $i ; done >dabl.min.js
