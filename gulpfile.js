var autoprefixer = require('gulp-autoprefixer');
var browserSync = require("browser-sync").create();
var babel = require("rollup-plugin-babel");
var buffer = require("vinyl-buffer");
var concat = require("gulp-concat");
var gulp = require("gulp");
var inject = require("gulp-inject");
var rollup = require("rollup-stream");
var sass = require('gulp-sass');
var source = require("vinyl-source-stream");
var sourcemaps = require("gulp-sourcemaps");
var svgmin = require("gulp-svgmin");
var svgstore = require("gulp-svgstore");
var uglifyJS = require("gulp-uglify");
var uglifyCSS = require("gulp-uglifycss");
var crypto = require('crypto');
var fs = require('fs');
var del = require('del');
var runSequence = require('run-sequence');
var htmlmin = require('gulp-htmlmin');

var buildVersion = null;

gulp.task("default", ["browser-sync", "build-default", "watch"]);
gulp.task("build-default", ["build-js", "build-sass"], browserSync.reload);

gulp.task("build", function(cb) {
	runSequence(["build-js-prod", "build-sass"], function() {
		browserSync.reload();
		cb();
	});
});

gulp.task("deploy", function(cb) {
	buildVersion = getBuildVersion();
	runSequence("build", "clean-build", "copy-build", "inject-file-versions", "inject-build-version", "minify-html", cb);
});

gulp.task("browser-sync", function() {
	browserSync.init({ server: { baseDir: "./" }, options: { ignored: "./dev/**/*"} });
});

gulp.task("watch", function() {
	gulp.watch("dev/src/**/*.js", ["build-js-watch"]);
	gulp.watch("index.html", browserSync.reload);
	gulp.watch("dev/sass/**/*.scss", ["build-sass"]);
	gulp.watch("dev/icons/*.svg", ["icons"]);
	gulp.watch("dev/inject/*", ["inject-watch"]);
});

gulp.task("build-js-watch", ["build-js"], browserSync.reload);
gulp.task("inject-watch", ["inject"], browserSync.reload);

gulp.task("build-js", function() {
	return 	rollup({
			entry: "dev/src/app.js",
			sourceMap: true,
			moduleContext: {"dev/lib/codemirror.js":"window"},
			plugins: [babel({
				presets: [["es2015",{"modules": false}]],
				plugins: ["external-helpers"],
				include: "./dev/src/**",
				babelrc: false
			})],
			moduleName: 'regexr',
			format: "iife"
		}).on("error", swallowError)
		.pipe(source("regexr.js","./src"))
		.pipe(buffer())
		.pipe(sourcemaps.init({loadMaps:true}))
		//.pipe(uglifyJS())
		.pipe(sourcemaps.write("../deploy"))
		.pipe(gulp.dest("./deploy"));
});

gulp.task("build-js-prod", function() {
	return 	rollup({
			entry: "dev/src/app.js",
			moduleContext: {"dev/lib/codemirror.js":"window"},
			plugins: [babel({
				presets: [["es2015",{"modules": false}]],
				plugins: ["external-helpers"],
				include: "./dev/src/**",
				babelrc: false
			})],
			moduleName: 'regexr',
			format: "iife"
		}).on("error", swallowError)
		.pipe(source("regexr.js","./src"))
		.pipe(buffer())
		.pipe(uglifyJS().on('error', function(e){
            console.log(e);
         }))
		.pipe(gulp.dest("./deploy"));
});

gulp.task("build-sass", function () {
	return gulp.src(["dev/lib/**.css", "dev/lib/**.scss", "dev/sass/regexr.scss"])
		.pipe(sass().on('error', swallowError))
		.pipe(concat('regexr.css'))
		.pipe(autoprefixer({remove:false}))
		.pipe(uglifyCSS())
		.pipe(gulp.dest('deploy'))
		.pipe(browserSync.stream());
});

gulp.task("icons", function() {
	return gulp.src("dev/icons/*.svg")
		// strip fill attributes and style tags to facilitate CSS styling:
		.pipe(svgmin({plugins:[{removeAttrs:{attrs:"fill"}}, {removeStyleElement:true}]}))
		.pipe(svgstore({inlineSvg:true}))
		.pipe(gulp.dest("dev/inject"));
});

gulp.task("inject", function() {
	return gulp.src("index.html")
		.pipe(inject(gulp.src("dev/inject/*"), {
			transform: function(path, file) {
				var tag = /\.css$/ig.test(path) ? "style" : "";
				return (tag ? "<"+tag+">" : "") + file.contents.toString() + (tag ? "</"+tag+">" : "");
			}
		}))
		.pipe(gulp.dest("."));
});

gulp.task("inject-file-versions", function(cb) {
	var indexFile = fs.readFileSync("build/index.html", "utf-8");
	const files = [
		{name: 'build/deploy/regexr.js', tag: 'JS_VERSION'},
		{name: 'build/deploy/regexr.css', tag: 'CSS_VERSION'}
	].forEach(function(file, idx, array) {
		var version = createFileHash(file.name);
		indexFile = indexFile.replace("["+file.tag+"]", version);
	});
	fs.writeFile("build/index.html", indexFile, cb);
});

gulp.task("inject-build-version", function(cb) {
	var js = fs.readFileSync("build/deploy/regexr.js", "utf-8");
	js = js.replace("[build-version]", buildVersion);
	js = js.replace("[build-date]", getDateString());
	fs.writeFile("build/deploy/regexr.js", js, cb);
});


gulp.task("minify-html", function() {
	return gulp.src("build/index.html")
		.pipe(htmlmin({collapseWhitespace: true, conservativeCollapse: true, removeComments: true}))
		.pipe(gulp.dest("build/"));
});

gulp.task("clean-build", function(cb) {
	return del([
		"build/**",
		"!build",
		"!build/sitemap.txt",
		"!build/{.git*,.git/**}",
		"!build/v1/**"
	], null, cb);
});

gulp.task("copy-build", function() {
	return gulp.src([
		'deploy/**', 'assets/**', 'index.*', 'server/**',
		'!deploy/*.map',
		'!server/**/composer.*',
		'!server/**/*.sql',
		'!server/**/*.md',
		'!server/gulpfile.js',
		'!server/Config*.php',
		'!server/**/*package*.json',
		'!server/{.git*,.git/**}',
		'!server/node_modules/',
		'!server/node_modules/**',
	], {base: './'})
	.pipe(gulp.dest("./build/"));
});

function createFileHash(filename) {
	const hash = crypto.createHash('sha256');

	const fileContents = fs.readFileSync(filename, 'utf-8');
	hash.update(fileContents);
	return hash.digest('hex').slice(0, 9);
}

function swallowError(err) {
	console.warn(err.toString());
	this.emit("end");
}

function getBuildVersion() {
	let i = process.argv.indexOf("--v")
	let v = i === -1 ? null : process.argv[i+1];
	if (!v || !/^\d+\.\d+\.\d+/.test(v)) {
		throw("You must specify a version number with `--v x.x.x`.")
	}
	return v;
}

function getDateString() {
	var now = new Date();
	var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	return months[now.getMonth()]+" "+now.getDate()+", "+now.getFullYear();
}