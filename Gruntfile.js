var path = require("path");
var uglify = require("uglify-js");

module.exports = function (grunt) {
	/*
	Load all the tasks we need
	*/

	/*
	*************************************
	**** About: grunt-yui-compressor ****
	*************************************
	Usually we use uglifyJS for code minification.
	However uglify breaks the Unicode characters Codemirror uses in its RegEx expressions,
	whereas yui does not.
	 */
	grunt.loadNpmTasks("grunt-yui-compressor");
	grunt.loadNpmTasks("grunt-contrib-watch");
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-contrib-sass");
	grunt.loadNpmTasks("grunt-contrib-connect");
	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-contrib-htmlmin");
	grunt.loadNpmTasks("grunt-contrib-copy");
	grunt.loadNpmTasks("grunt-contrib-concat");
	grunt.loadNpmTasks('grunt-browser-sync');

	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		deployFolder: "build/",

		// YUI-min
		min: {
			options: {
				report: false
			},
			build: {
				src: getScripts().yui,
				dest: "<%= deployFolder %>js/yui.min.js"
			}
		},

		uglify: {
			options: {
				compress: {
					global_defs: {
						DEBUG: false
					},
					dead_code: true
				}
			},
			build: {
				files: {
					"<%= deployFolder %>js/uglify.min.js":getScripts().uglify,
					"<%= deployFolder %>js/regExWorker.template.js":"js/regExWorker.template.js"
				}
			}
		},

		concat: {
			build: {
				src: ["<%= deployFolder %>js/yui.min.js",  "<%= deployFolder %>js/uglify.min.js"],
				dest:  "<%= deployFolder %>js/scripts.min.js",
			}
		},

		sass: {
			build:{
				options: {
					compass: true,
					style: "compact", // Can be nested, compact, compressed, expanded
					precision: 2,
				},
				files: {
					"css/regexr.css":"scss/regexr.scss"
				}
			}
		},

		browserSync: {
			bsFiles: {
				src: ["css/*.css", "js/**/.js", "index.html"]
			},
			options: {
				server: {
					baseDir: "./"
				},
				watchTask: true
			}
		},

		watch: {
			sass: {
				files: ['scss/**/*.scss'],
				tasks: ['sass'],
			},
		},

		cssmin: {
			options: {
				report: false
			},
			build: {
				src: "css/regexr.css",
				dest: "<%= deployFolder %>css/regexr.css"
			}
		},

		copy: {
			build: {
				files: [
					{
						expand: true,
						src:[
							"assets/**",
							"php/**",
							"*.ico",
							".htaccess",
							"manifest.json"
						],
						dest: "<%= deployFolder %>"
					}
				]
			}
		},

		connect: {
			build: {
				options: {
					hostname: "*",
					keepalive:true,
					useAvailablePort: true,
					open: true,
					base: './build/'
				}
			}
		},

		htmlmin: {
			options: {
				removeComments: true,
				collapseWhitespace: true
			},
			build: {
				files:[{src: "<%= deployFolder %>index.html.tmp", dest: "<%= deployFolder %>index.html"}],
			}
		},

		clean: {
			build: ["<%= deployFolder %>!(v1|.git|php|sitemap.txt|*.md)**"],
			postBuild: ["<%= deployFolder %>**/*.tmp", "<%= deployFolder %>js/yui.min.js", "<%= deployFolder %>js/uglify.min.js"]
		}
	});

	/**
	 * Runs the index.html file through grunts template system.
	 *
	 */
	grunt.registerTask("parse-index", function (type) {
		var templateFile = grunt.file.read("index.html");
		var indexJs = minifyJS(grunt.file.read("js/index.template.js"));

		var buildIndexTag = "\n"+indexJs+"";

		var output = grunt.template.process(templateFile, {data:{build:true, index:buildIndexTag, noCache:Date.now()}})

		//Write a temp html file, the htmlmin task will minify it to index.html
		grunt.file.write(grunt.config.get("deployFolder")+"index.html.tmp", output);
	});

	grunt.registerTask("default", [
		"sass",
		"browserSync",
		"watch",
	]);

	grunt.registerTask("build", [
		"clean:build",
		"sass",
		"cssmin",
		"min",
		"uglify",
		"concat",
		"parse-index",
		"htmlmin",
		"copy",
		"clean:postBuild",
		"connect:build"
	]);

	/**
	 * Loads our scripts.json file.
	 *
	 */
	function getScripts() {
		var scripts = grunt.file.readJSON("scripts.json");
		var missing = [];
		for (var n in scripts) {
			var arr = scripts[n];
			arr.forEach(function(item, index, array) {
				if (!grunt.file.exists(item)) {
					missing.push(n+": "+item);
				}
			});
		}

		if (missing.length) {
			// \x07 == beep sound in the terminal.
			grunt.log.warn("\x07Missing ", missing.length + " scripts.\n\t" + missing.join("\n\t"));
		}

		return scripts;
	}

	/**
	 * Utility function.
	 * Returns an minified version of a javascript string, file or files.
	 *
	 * @param script {String|Array} Either a Javascript string,
	 * or an array of paths to Javascript files.
	 *
	 * Returns a minified version of the script(s) passed in.
	 */
	function minifyJS(script) {
		var uglifyConfig = {};
		if (typeof script == "string") {
			uglifyConfig.fromString = true;
		}

		var result = uglify.minify(script, uglifyConfig);
		return result.code;
	}
};
