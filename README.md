RegExr
======

# About
This is the source for [RegExr.com](http://regexr.com/)
RegExr is a HTML/JS based tool for creating, testing, and learning about Regular Expressions.

# Build
## RegExr uses [Grunt](http://gruntjs.com/) to manage the build process.

## To use

Note that this requires a familiarity with using the command line.
The example commands shown are for use with the OSX Terminal.

### Install dependencies

Node (0.10.24 or greater is required):

	# check the version via the command line
	node -v

If your Node install is out of date, get the latest from [NodeJS.org](http://nodejs.org/)

After node is setup, install the other dependencies. You may want to familiarize yourself with the Node Packager Manager (NPM) before proceeding.

	# Install the grunt command line utility globally
	sudo npm install grunt-cli -g

	# Install all the dependencies from package.json
	npm install

### Setup
#### Compile sass
The only requirement for development is to compile the sass files. This can be achieved manually via ```grunt sass;```
or for development you can watch for changes use ```grunt watchSass;```
You can also use any third-party sass compiler. Examples are; Using a WebStorm watcher or CodeKits built compiler.

#### Other setup
There is no other setup required, grunt build mainly prepares the source for deployment.

### Building
To prepare the site for a deploy run:

	grunt build;

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
