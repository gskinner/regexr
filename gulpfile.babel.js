// imports
const gulp = require("gulp");
const inject = require("gulp-inject");
const rename = require("gulp-rename");
const template = require("gulp-template");
const sass = require("gulp-sass");
const cleanCSS = require("gulp-clean-css");
const htmlmin = require("gulp-htmlmin");
const svgstore = require("gulp-svgstore");
const svgmin = require("gulp-svgmin");
const autoprefixer = require("gulp-autoprefixer");
const rollup = require("rollup");
const babel = require("rollup-plugin-babel");
const uglify = require("rollup-plugin-uglify").uglify;
const replace = require("rollup-plugin-replace");
const browser = require("browser-sync").create();
const del = require("del");
const crypto = require("crypto");
const fs = require("fs");

// constants
const isProduction = () => process.env.NODE_ENV === "production";
const pkg = require("./package.json");
const babelPlugin = babel({
	presets: [["@babel/env", {modules: false}]],
	babelrc: false
});
const replacePlugin = replace({
	delimiters: ["<%= ", " %>"],
	"build-version": pkg.version,
	"build-date": getDateString()
});
const uglifyPlugin = uglify();
let bundleCache;

// tasks
gulp.task("serve", () => {
	browser.init({
		server: {baseDir: "./"},
		options: {ignored: "./dev/**/*"}
	});
});

gulp.task("watch", () => {
	gulp.watch("./dev/src/**/*.js", gulp.series("js", browser.reload));
	gulp.watch("./index.html", gulp.series(browser.reload));
	gulp.watch("./dev/sass/**/*.scss", gulp.series("sass"));
	gulp.watch("./dev/icons/*.svg", gulp.series("icons"));
	gulp.watch("./dev/inject/*", gulp.series("inject", browser.reload));
});

gulp.task("js", () => {
	const plugins = [babelPlugin, replacePlugin];
	if (isProduction()) { plugins.push(uglifyPlugin); }
	return rollup.rollup({
		input: "./dev/src/app.js",
		cache: bundleCache,
		moduleContext: {
			"./dev/lib/codemirror.js": "window",
			"./dev/lib/clipboard.js": "window",
			"./dev/lib/native.js": "window",
		},
		plugins,
	}).then(bundle => {
		bundleCache = bundle.cache;
		return bundle.write({
			format: "iife",
			file: "./deploy/regexr.js",
			name: "regexr",
			sourcemap: !isProduction()
		})
	});
});

gulp.task("sass", () => {
	return gulp.src(["dev/lib/**.css", "dev/lib/**.scss", "dev/sass/regexr.scss"])
		.pipe(sass().on("error", sass.logError))
		.pipe(autoprefixer({remove:false}))
		.pipe(cleanCSS())
		.pipe(rename("regexr.css"))
		.pipe(gulp.dest("deploy"))
		.pipe(browser.stream());
});

gulp.task("html", done => {
	if (!isProduction()) { return done(); }
	return gulp.src("build/index.html")
		.pipe(template({
			"js-version": createFileHash("build/deploy/regexr.js"),
			"css-version": createFileHash("build/deploy/regexr.css")
		}))
		.pipe(htmlmin({
			collapseWhitespace: true,
			conservativeCollapse: true,
			removeComments: true
		}))
		.pipe(gulp.dest("build"));
});

gulp.task("icons", () => {
	return gulp.src("dev/icons/*.svg")
		// strip fill attributes and style tags to facilitate CSS styling:
		.pipe(svgmin({
			plugins: [
				{removeAttrs: {attrs: "fill"}},
				{removeStyleElement: true}
			]}
		))
		.pipe(svgstore({inlineSvg: true}))
		.pipe(gulp.dest("dev/inject"));
});

gulp.task("inject", () => {
	return gulp.src("index.html")
		.pipe(inject(gulp.src("dev/inject/*"), {
			transform: (path, file) => {
				const tag = /\.css$/ig.test(path) ? "style" : "";
				return (tag ? `<${tag}>` : "") + file.contents.toString() + (tag ? `</${tag}>` : "");
			}
		}))
		.pipe(gulp.dest("."));
});

gulp.task("clean", () => {
	return del([
		"build/**",
		"!build",
		"!build/sitemap.txt",
		"!build/{.git*,.git/**}",
		"!build/v1/**"
	]);
});

gulp.task("copy", () => {
	return gulp.src([
		"deploy/**", "assets/**", "index.*", "server/**",
		"!deploy/*.map",
		"!server/**/composer.*",
		"!server/**/*.sql",
		"!server/**/*.md",
		"!server/gulpfile.js",
		"!server/Config*.php",
		"!server/**/*package*.json",
		"!server/{.git*,.git/**}",
		"!server/node_modules/",
		"!server/node_modules/**",
	], {base: "./"})
	.pipe(gulp.dest("./build/"));
});

gulp.task("build", gulp.parallel("js", "sass", "html"));

gulp.task("default",
	gulp.series("build",
		gulp.parallel("serve", "watch")
	)
);

gulp.task("deploy",
	gulp.series(
		cb => (process.env.NODE_ENV = "production") && cb(),
		"clean", "build", "copy"
	)
);

// helpers
function createFileHash(filename) {
	const hash = crypto.createHash("sha256");

	const fileContents = fs.readFileSync(filename, "utf-8");
	hash.update(fileContents);
	return hash.digest("hex").slice(0, 9);
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

// dark theme:
// TODO: this whole approach can be cleaned up, ideally when moving to gulp v4
var dark = "", root = "";
gulp.task("build-sass-dark0", function(cb) {
	root = fs.readFileSync("dev/sass/regexr.scss", "utf-8");
	fs.writeFile("dev/sass/regexr.scss", root.replace("@import 'colors';", "@import 'colors_dark';"), cb);
});
gulp.task("build-sass-dark1", function(cb) {
	dark = fs.readFileSync("deploy/regexr.css", "utf-8");
	fs.writeFile("dev/sass/regexr.scss", root, cb);
});
gulp.task("build-sass-dark2", function(cb) {
	var def = fs.readFileSync("deploy/regexr.css", "utf-8");
	var diff = (new CSSDiff()).diff(def, dark, false);
	fs.writeFile("assets/themes/dark.css", diff, cb);
	dark = root = ""; // clean up.
});

gulp.task("build-sass-dark", function(cb) {
	runSequence("build-sass-dark0", "build-sass", "build-sass-dark1", "build-sass", "build-sass-dark2", cb);
});


// CSSDiff:
class CSSDiff {
	constructor() {}

	diff(base, targ, pretty=false) {
		let diff = this.compare(this.parse(base), this.parse(targ));
		return this._writeDiff(diff, pretty);
	}

	parse(s, o={}) {
		this._parse(s, /([^\n\r\{\}]+?)\s*\{\s*/g, /\}/g, o);
		for (let n in o) {
			if (n === " keys") { continue; }
			o[n] = this.parseBlock(o[n]);
		}
		return o;
	}

	parseBlock(s, o={}) {
		return this._parse(s, /([^\s:]+)\s*:/g, /(?:;|$)/g, o);
	}

	compare(o0, o1, o={}) {
		let keys = o1[" keys"], l=keys.length, arr=[];
		for (let i=0; i<l; i++) {
			let n = keys[i];
			if (!o0[n]) { o[n] = o1[n]; arr.push(n); continue; }
			let diff = this._compareBlock(o0[n], o1[n]);
			if (diff) { o[n] = diff; arr.push(n); }
		}
		o[" keys"] = arr;
		return o;
	}

	_compareBlock(o0, o1) {
		let keys = o1[" keys"], l=keys.length, arr=[], o;
		for (let i=0; i<l; i++) {
			let n = keys[i];
			if (o0[n] === o1[n]) { continue; }
			if (!o) { o = {}; }
			o[n] = o1[n];
			arr.push(n);
		}
		if (o) { o[" keys"] = arr; }
		return o;
	}

	_parse(s, keyRE, closeRE, o) {
		let i, match, arr=[];
		while (match = keyRE.exec(s)) {
			let key = match[1];
			i = closeRE.lastIndex = keyRE.lastIndex;
			if (!(match = closeRE.exec(s))) { console.log("couldn't find close", key); break; }
			o[key] = s.substring(i, closeRE.lastIndex-match[0].length).trim();
			i = keyRE.lastIndex = closeRE.lastIndex;
			arr.push(key);
		}
		o[" keys"] = arr;
		return o;
	}

	_writeDiff(o, pretty=false) {
		let diff = "", ln="\n", s=" ";
		if (!pretty) { ln = s = ""; }
		let keys = o[" keys"], l=keys.length;
		for (let i=0; i<l; i++) {
			let n = keys[i];
			if (diff) { diff += ln + ln; }
			diff += n + s + "{" + ln;
			diff += this._writeBlock(o[n], pretty);
			diff += "}";
		}
		return diff;
	}

	_writeBlock(o, pretty=false) {
		let diff = "", ln="\n", t="\t", s=" ";
		if (!pretty) { ln = t = s = ""; }
		let keys = o[" keys"], l=keys.length;
		for (let i=0; i<l; i++) {
			let n = keys[i];
			diff += t + n + ":" + s + o[n] + ";" + ln;
		}
		return diff;
	}
}
