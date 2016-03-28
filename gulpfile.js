var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var watch = require('gulp-watch');
var connect = require('gulp-connect');
var open = require('gulp-open');
var minifyCss = require('gulp-minify-css');
var rimraf = require('gulp-rimraf');
var inline = require('gulp-inline-source');
var template = require('gulp-template');
var minifyHTML = require('gulp-minify-html');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var watchify = require('watchify');
var browserSync = require('browser-sync');
var runSequence = require('run-sequence');
var swPrecache = require('sw-precache');
var rev = require('gulp-rev');
var revReplace = require('gulp-rev-replace');
var path = require('path');
var pkg = require('./package.json');

var staticAssets = [
	"index.html",
	"./assets/**",
	"./php/!(cache)**",
	"*.ico",
	".htaccess"
];

function compileJs(watch) {
	var bundler = watchify(browserify('./js/RegExr.js', {debug: true}));

	function rebundle() {
		bundler.bundle()
			.on('error', function (err) {
				console.error(err);
				this.emit('end');
			})
			.pipe(source('scripts.min.js'))
			.pipe(buffer())
			.pipe(sourcemaps.init({loadMaps: true}))
			.pipe(sourcemaps.write('./'))
			.pipe(gulp.dest('./build/js'));
	}


	if (watch) {
		bundler.on('update', function () {
			rebundle();
		});
	}

	rebundle();
}

gulp.task('sass', function () {
	return gulp.src('./scss/regexr.scss')
		.pipe(sass({includePaths: ["scss/third-party/compass-mixins"]}).on('error', sass.logError))
		.pipe(gulp.dest('./build/css'));
});

gulp.task('browser-sync', function () {
	return browserSync(
		{
			open: "local",
			server: {
				baseDir: "./build/"
			},
			files: "./build/**"
		});
});

gulp.task('watch-js-templates', function () {
	var assets = "js/*.template.js";
	return gulp.watch(assets, ['copy-js-templates']);
});

gulp.task('copy-js-templates', function (cb) {
	var assets = "js/*.template.js";
	gulp.src(assets, {base: './js'})
		.pipe(gulp.dest('build/js/'))
		.on("finish", function () {
			cb();
		});
});

gulp.task('watch-assets', function () {
	return gulp.watch(staticAssets, ['copy-assets'])
});

gulp.task('watch-sass', function () {
	gulp.watch("./scss/**/*.scss", ['sass']);
});

gulp.task('copy-assets', function () {
	return gulp.src(staticAssets, {base: './', dot: true})
		.pipe(gulp.dest('build/'));
});

gulp.task('minify-js', function () {
	return gulp.src(['build/js/scripts.min.js', 'build/js/regExWorker.template.js'])
		.pipe(uglify({
			compress: {
				global_defs: {
					DEBUG: false
				},
				dead_code: true
			},
			ASCIIOnly: true
		}))
		.pipe(gulp.dest('build/js'));
});

gulp.task('build-js', function () {
	return compileJs();
});

gulp.task('watch-js', function () {
	return compileJs(true);
});

gulp.task('server', function () {
	connect.server({
		root: 'build'
	});
});

gulp.task('minify-css', function () {
	return gulp.src('build/css/regexr.css')
		.pipe(minifyCss())
		.pipe(gulp.dest('build/css'));
});

gulp.task('open-build', function () {
	gulp.src(__filename)
		.pipe(open({uri: 'http://localhost:8080'}));
});

gulp.task('clean-pre-build', function () {
	return gulp.src(['./build/!(v1|.git|sitemap.txt|*.md)'], {read: false})
		.pipe(rimraf());
});

gulp.task('clean-post-build', function () {
	return gulp.src([
			'./build/js/index.template.js',
			'./build/js/scripts.min.js.map',
			'./build/js/checkSupport.template.js',
			'./build/js/analytics.template.js',
			'./build/assets/spinner*.gif',

			'./build/js/scripts.min.js',
			'./build/js/regExWorker.template.js',
			'./build/css/regexr.css',
			'./build/rev-manifest.json'
		], {read: false})
		.pipe(rimraf());
});

gulp.task('inline', function () {
	return gulp.src('build/index.html')
		.pipe(inline({
				base: 'build/', js: uglify, css: minifyCss
			}
		))
		.pipe(gulp.dest('build/'));
});

gulp.task('parse-index', function () {
	return gulp.src('build/index.html')
		.pipe(minifyHTML())
		.pipe(gulp.dest('build/'));
});

gulp.task('copy-sw-scripts', function () {
	return gulp
		.src([
			'node_modules/sw-toolbox/sw-toolbox.js',
			'js/sw/runtime-caching.js'
		])
		.pipe(gulp.dest('build/js/sw'));
});

gulp.task('generate-service-worker', ['copy-sw-scripts'], function (callback) {
	var rootDir = 'build';
	var filePath = path.join(rootDir, 'service-worker.js');

	return swPrecache.write(filePath, {
		// Used to avoid cache conflicts when serving on localhost.
		cacheId: pkg.name || 'RegExr',
		// sw-toolbox.js needs to be listed first. It sets up methods used in runtime-caching.js.
		importScripts: [
			'js/sw/sw-toolbox.js',
			'js/sw/runtime-caching.js'
		],
		staticFileGlobs: [
			// Add/remove glob patterns to match your directory setup.
			rootDir + '/assets/**/*',
			rootDir + '/css/**/*.css',
			rootDir + '/js/**/*.js',
			rootDir + '/*.{html,json}'
		],
		// Translates a static file path to the relative URL that it's served from.
		// This is '/' rather than path.sep because the paths returned from
		// glob always use '/'.
		stripPrefix: rootDir + '/'
	});
});

gulp.task('revision', function () {
	var rootDir = 'build';

	return gulp.src([
			rootDir + '/js/scripts.min.js',
			rootDir + '/js/regExWorker.template.js',
			rootDir + '/css/regexr.css'
		], {base: 'build'})
		.pipe(rev())
		.pipe(gulp.dest('build'))
		.pipe(rev.manifest())
		.pipe(gulp.dest('build'));
});

gulp.task('revision-replace', ['revision'], function () {
	var manifest = gulp.src('build/rev-manifest.json');

	return gulp.src([
			'build/index.html',
			'build/js/scripts-*.min.js'
		], {base: 'build'})
		.pipe(revReplace({
			manifest: manifest
		}))
		.pipe(gulp.dest('build'));
});

gulp.task('build', function (done) {
	runSequence(
		'clean-pre-build',
		['build-js', 'copy-assets', 'sass'],
		'copy-js-templates',
		['minify-js', 'minify-css'],
		['parse-index'],
		'inline',
		'revision-replace',
		'clean-post-build',
		'generate-service-worker',
		'server', 'open-build',
		done
	);
});

gulp.task('default', function (done) {
	runSequence(
		['sass', 'watch-js', 'watch-sass', 'copy-js-templates'],
		'copy-assets',
		'generate-service-worker',
		['watch-assets', 'watch-js-templates', 'browser-sync'],
		done
	);
});
