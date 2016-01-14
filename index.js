'use strict';
var fs = require('fs');
var isXz = require('is-xz');
var lzmaNative = require('lzma-native');
var objectAssign = require('object-assign');
var stripDirs = require('strip-dirs');
var tarStream = require('tar-stream');
var through = require('through2');
var Vinyl = require('vinyl');

module.exports = function (opts) {
	opts = opts || {};
	opts.strip = +opts.strip || 0;

	return through.obj(function (file, enc, cb) {
		var extract = tarStream.extract();
		var xz = lzmaNative.createDecompressor();
		var self = this;

		if (file.isNull()) {
			cb(null, file);
			return;
		}

		if (file.isStream()) {
			cb(new Error('Streaming is not supported'));
			return;
		}

		if (!file.extract || !isXz(file.contents)) {
			cb(null, file);
			return;
		}

		extract.on('entry', function (header, stream, done) {
			var chunk = [];
			var len = 0;

			stream.on('data', function (data) {
				chunk.push(data);
				len += data.length;
			});

			stream.on('end', function () {
				if (header.type !== 'directory') {
					self.push(new Vinyl({
						contents: Buffer.concat(chunk, len),
						path: stripDirs(header.name, opts.strip),
						stat: objectAssign(new fs.Stats(), header)
					}));
				}

				done();
			});
		});

		extract.on('error', cb);
		extract.on('finish', cb);
		xz.on('error', cb);
		xz.end(file.contents);
		xz.pipe(extract);
	});
};
