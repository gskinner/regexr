var path = require("path");
var uglify = require("uglify-js");

module.exports = function (grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		deployFolder: "build/",

		uglify: {
			options: {
				compress: {
					global_defs: {
						DEBUG: false
					},
					dead_code: true
				},
				// Required so uglify doesn't break our Unicode characters.
				ASCIIOnly: true
			},
			build: {
				files: {
					"<%= deployFolder %>js/scripts.min.js": 'js/scripts.min.js',
					'<%= deployFolder %>js/regExWorker.template.js': 'js/regExWorker.template.js'
				}
			}
		},

		sass: {
			build: {
				options: {
					compass: true,
					style: "compressed", // Can be nested, compact, compressed, expanded
					precision: 2,
				},
				files: {
					"css/regexr.css": "scss/regexr.scss"
				}
			}
		},

		browserify: {
			build: {
				files: {
					'js/scripts.min.js': ['js/RegExr.js'],
				}
			},
			run: {
				files: {
					'js/scripts.min.js': ['js/RegExr.js'],
				},
				options: {
					watch: true,
					keepAlive: false
				}
			},
		},

		inline: {
			build: {
				files: [
					{
						cwd: './',
						src: 'index.html',
						dest: 'build/index.html',
					}
				]
			}
		},

		browserSync: {
			bsFiles: {
				src: ["css/*.css", "js/scripts.min.js", "js/*.template.js", "index.html"]
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

		copy: {
			build: {
				files: [
					{
						expand: true,
						src: [
							"assets/**",
							"css/regexr.css",
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
					keepalive: true,
					useAvailablePort: true,
					open: true,
					base: './build/'
				}
			}
		},

		clean: {
			build: ["<%= deployFolder %>!(v1|.git|php|sitemap.txt|*.md)**"]
		}
	});

	/*
	 Load all the tasks we need
	 */
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-contrib-watch");
	grunt.loadNpmTasks("grunt-contrib-sass");
	grunt.loadNpmTasks("grunt-contrib-connect");
	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-contrib-copy");
	grunt.loadNpmTasks('grunt-browser-sync');
	grunt.loadNpmTasks('grunt-browserify');
	grunt.loadTasks('tasks/');

	/**
	 * Runs the index.html file through grunts template system.
	 *
	 */
	grunt.registerTask("parse-index", function (type) {
		var templateFile = grunt.file.read("build/index.html");
		var output = grunt.template.process(templateFile, {
			data: {
				noCache: Date.now()
			}
		})

		grunt.file.write(grunt.config.get("deployFolder") + "index.html", output);
	});

	grunt.registerTask("default", [
		"sass",
		"browserify",
		"browserSync",
		"watch"
	]);

	grunt.registerTask("build", [
		"clean:build",
		"sass",
		"browserify",
		"uglify",
		"inline",
		"parse-index",
		"copy",
		"connect:build"
	]);
};
