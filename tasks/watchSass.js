module.exports = function (grunt) {
	"use strict";

	var path = require("path");
	var fs = require("fs");
	var spawn = require('child_process').spawn;

	grunt.registerMultiTask("watchSass", "Use sass -watch to compile files.", function (type) {
		var done = this.async();
		var options = this.options();
		var passedArgs;
		var bundleExec;

		passedArgs = [];
		Object.keys(options).forEach(function(key) {
			var value = options[key];
			if (value !== false) {
				passedArgs.push('--'+key);
				if (value !== true) {
					passedArgs.push(value);
				}
			}
		});

		bundleExec = options.bundleExec;

		// Build watch list
		var isScss = null;
		var watchedFiles = [];
		for (var i = 0; i < this.files.length; i++) {
			var file = this.files[i];
			var src = file.src[0];

			if (typeof src !== 'string') {
				src = file.orig.src[0];
			}

			if (!grunt.file.exists(src)) {
				grunt.log.warn('Source file "' + src + '" not found.');
				continue;
			}
			watchedFiles.push(fs.realpathSync(src) + ':' + fs.realpathSync(file.dest));

			if (isScss === null) {
				if (path.extname(src) == '.css' || path.extname(src) == '.scss') {
					isScss = true;
				}
			}

			// Make sure grunt creates the destination folders.
			if (!grunt.file.exists(file.dest)) {
				grunt.file.write(file.dest, '');
			}
		}

		// Build our command.
		var args = [].concat(passedArgs);

		if (process.platform === 'win32') {
			args.unshift('sass.bat');
		} else {
			args.unshift('sass');
		}

		if (bundleExec) {
			args.unshift('bundle', 'exec');
		}

		// If we're compiling scss or css files.
		if (isScss) {
			args.push('--scss');
		}

		args.push('--watch');
		args = args.concat(watchedFiles);

		var sass = spawn(args.shift(), args);

		sass.stderr.pipe(process.stderr);
		sass.stdout.pipe(process.stdout);

		// Kill the process on exit, or it will run forever.
		process.on('exit', function() {
			sass.kill();
		});
	});
}
