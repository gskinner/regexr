RegExr
======

# About
This is the source for [RegExr.com](http://regexr.com/)
RegExr is a HTML/JS based tool for creating, testing, and learning about Regular Expressions.

# Build
## RegExr uses [Gulp](http://gulpjs.com/) to manage the build process.

## To use

Note that this requires a familiarity with using the command line.
The example commands shown are for use with the OSX Terminal.

### Install dependencies

Node (v4.2.2 or greater is required):

	# check the version via the command line
	node -v

If your Node install is out of date, get the latest from [NodeJS.org](http://nodejs.org/)

After node is setup, install the other dependencies. You may want to familiarize yourself with the Node Packager Manager (NPM) before proceeding.

	# Install the gulp command line utility globally
	sudo npm install gulp -g

	# Install all the dependencies from package.json
	npm install

### Development
Run ```gulp;``` to start a local develpoment server. gulp will also watch for changes in the local sass, javascript and static files.

### Building
To prepare the site for a deploy run:

	gulp build;

This command will:

* Copy all required assets to the build/ folder.
* Combine and minify the *.js files
* Compile and minify the sass
* Inject js/index.template.js into the index.html file
* Minify the index.html file


# Code Style
If you would like to contribute back to RegExr.com please send us pull requests.
Please make sure they are well formatted and follow the style specified out in the existing files.
Mainly just keep your white space as tabs, and all line breaks as \n.
