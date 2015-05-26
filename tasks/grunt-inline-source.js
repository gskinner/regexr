/*
 * Visit http://createjs.com/ for documentation, updates and examples.
 *
 * Copyright (c) 2015 gskinner.com, inc.
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
module.exports = function (grunt) {

	var inline = require('inline-source');
	var minify = require('html-minifier').minify;
	var path = require('path');

	grunt.registerMultiTask('inline', function () {
		var done = this.async();

		this.files.forEach(function (file) {
			file.src.filter(function (src) {
				inline(path.join(file.cwd, src), {
					rootpath: file.cwd,
				}, function (err, html) {
					if (err) {
						grunt.fail.fatal(err);
					} else {
						var result = minify(html, {
							removeAttributeQuotes: true,
							collapseWhitespace: true,
							removeComments: true,
							minifyJS: true,
							minifyCSS: true
						});

						grunt.file.write(path.join(file.cwd, file.dest), result);
					}

					done();
				});
			});
		});
	});
}
