/*
RegExr: Learn, Build, & Test RegEx
Copyright (C) 2017  gskinner.com, inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

let home = {};
export default home;

home.id = "home";
home.label = "Menu";
home.desc = "[from HTML]";
home.kids = [


	{
	label: "Pattern Settings",
	id: "share",
	el: "#share_main",
	list: false,
	kids: [
		{
		label: "Save to my Favorites",
		id: "share_favorites",
		el:"#share_favorites"
		},
		{
		label: "Share with the Community",
		id: "share_community",
		el:"#share_community"
		}
	]
	},

	{
	label: "My Patterns",
	id:"favorites",
	desc: "The list above will display any patterns that you create or favorite."+
		"<p>To edit a pattern you created, click its URL or double-click it in the list to load it, then open Save / Share to edit and save.</p>",
	search: true,
	kids: []
	},

	{
	label: "Cheatsheet",
	id:"cheatsheet",
	el: "#cheatsheet"
	},

	{ // injected from Reference
	id:"reference"
	},

	{
	label: "Community Patterns",
	id: "community",
	desc: "Welcome to Community Patterns, a searchable database of patterns submitted by users like you."+
		"<p>After selecting a pattern, click its URL or double-click it in the list to load the full pattern. Or use the right arrow icon to load just the expression or text.</p>"+
		"<p>Help make the Community better by rating patterns, and submitting your own via <b>Search & Share</b> in the menu.</p>",
	search: true,
	kids: []
	},

	{
	label: "Help",
	id: "help",
	desc: "Help for the RegExr application. See the <b>RegEx Reference</b> for help with Regular Expressions.",
	kids: [

		{
		label:"About",
		desc:"RegExr v<%= build_version %> (<%= build_date %>)."+
			"<p>Created by <a href='http://twitter.com/gskinner/' target='_blank'>Grant Skinner</a> and the <a href='http://gskinner.com/' target='_blank'>gskinner</a> team, using the <a href='http://createjs.com/' target='_blank'>CreateJS</a> & <a href='http://codemirror.net/' target='_blank'>CodeMirror</a> libraries.</p>"+
			"<p>You can provide feedback or log bugs on <a href='http://github.com/gskinner/regexr/' target='_blank'>GitHub</a>.</p>"
		},
		{
		label:"Getting started",
		desc:"RegExr provides real-time visual results, syntax highlighting, tooltips, and undo/redo ({{getCtrlKey()}}-Z / Y) so it's easy and fun to explore Regular Expressions."+
			"<p>Browse through the <b>RegEx Reference</b> and test different tokens to see what they do, then check out <b>Community Patterns</b> to see examples.</p>"+
			"<p>You can also <b>Save</b> your patterns for later reference, or to share with others. <b>Sign In</b> to ensure you don't lose your patterns.</p>"+
			"<p>Modify your pattern's details, share it with the <b>Community</b>, or make it private, or delete it in <b>Pattern Settings</b></p>",
		kids: [
			{
			label:"Expression panel",
			desc:"This is where you enter a regular expression to test. The results in the <b>Text</b> and <b>Tools</b> panel will update as you type."+
				"Roll over the expression for information on each token."+
				"<p>The buttons to the right allow you to switch RegEx engines, or edit the expression flags.</p>"
			},
			{
			label:"Text panel",
			desc:"This is where you enter text to test your expression against. Drag & drop a text file to load its contents."+
				"<p>Matches will be highlighted as you type. Roll over a match for information on the match and its capture groups. The match count and execution time are shown in the title bar.</p>"+
				"<p>Lighter colored caps at the start or end of a line indicate the match continues between lines.</p>"
			},
			{
			label:"Tools panel",
			desc:"Click the <b>Tools</b> title bar below the <b>Text</b> panel to show or hide the <b>Tools</b> panel."+
				"<p>Tools provide different ways of working with or exploring your results.</p>",
			kids: [
				{
				label:"Replace",
				id: "replace",
				desc:"The <b>Replace</b> tool replaces matches with a specified string or pattern."+
					"<p>Matches in the <b>Text</b> panel are replaced by the substitution string & displayed as you type.</p>"+
					"<p>Substitution tokens and escaped characters are supported, such as <code>\\n</code>, <code>\\t</code> & <code>\\u0009</code>.</p>"+
					"<p>Roll over tokens for information, and check out the <b>RegEx Reference</b> for more information.</p>"
				},
				{
				label:"List",
				id: "list",
				desc:"The <b>List</b> tool lists all found matches."+
					"<p>You can specify either a simple delimiter (ex. <code>,</code> or <code>\\n</code>), or use substitution tokens to generate more advanced reports. For example, <code>$1\\n</code> would list all group 1 results (in the JavaScript engine).</p>"+
					"<p>Escaped characters are supported, such as <code>\\n</code>, <code>\\t</code> & <code>\\u0009</code>.</p>"+
					"<p>Roll over tokens for information.</p>"
				},
				{
				label:"Details",
				id: "details",
				desc:"The <b>Details</b> tool displays the full text of a match and its capture groups."+
					"<p>Click on a highlighted match in the <b>Text</b> panel to display the details for that match.</p>"+
					"<p>Roll over a group row to highlight that group in your <b>Expression</b>.</p>"
				},
				{
				label:"Explain",
				id: "explain",
				desc:"The <b>Explain</b> tool displays a detailed breakdown of the <b>Expression</b>."+
					"<p>Mouse over the explanation to highlight the related tokens in the <b>Expression</b> panel and vice versa.</p>"+
					"<p>Click an item in the explanation to show more info in the <b>RegEx Reference</b>.</p>"
				}
			]
			},
			{
			label:"Menu",
			desc:"The <b>Menu</b> (this panel) includes <b>Help</b>, a full <b>RegEx Reference</b>, a <b>Cheatsheet</b>, and <b>Pattern Settings</b> features."+
				"<p>Double-click a selected item in the <b>RegEx Reference</b> to insert it into your <b>Expression</b>. Click the arrow beside an example to load it.</p>"+
				"<p>The menu also includes searchable <b>Community Patterns</b>, and patterns you've created or favorited in <b>My Patterns</b>.</p>"
			}
		]
		},
		{
		label:"Signing in",
		id: "signin",
		desc:"Before you sign in, RegExr creates a temporary account which relies on a browser cookie. This means you can't access your patterns on other computers, and that you could lose your patterns if your cookies are deleted or expire."+
			"<p>Signing in creates a permanent account, so you can access your patterns anywhere, anytime.</p>"+
			"<p>Your existing patterns &amp; favorites will automatically be assigned to the new account.</p>"+
			"<p>We don't use your info for anything other than signing you into your RegExr account.</p>"
		},
		{
		id: "engine",
		label:"RegEx engines",
		desc:"While the core feature set of regular expressions is fairly consistent, different implementations (ex. Perl vs Java) may have different features or behaviours."+
			 "<p>RegExr currently supports JavaScript RegExp executed in your browser and PCRE via PHP.</p>"+
			 "<p>You can switch engines using the dropdown in Expression.</p>",
		kids: [
			{
			label:"JavaScript",
			desc:"Your browser's JavaScript engine is used to execute RegEx in an asynchronous worker using <code>RegExp.exec()</code>."+
				"<p>Note that while implementations are mostly consistent, there are small variations between browsers. Here is a short list of known differences:<ul>"+
				"<li>Older browsers don't support the u or y flags</li>"+
				"<li>Differences in handling of certain ambiguous escapes: \\8 \\9</li>"+
				"<li>Chrome handles \\x & \\u escapes slightly differently than other browsers</li>"+
				"<li>Chrome supports lookbehind, but it isn't yet in the JS spec</li>"+
				"<li>Safari ignores leading zeros in octal escapes (ex. \\00020)</li>"+
				"</ul></p>"
			},
			{
			label:"PCRE (PHP)",
			desc:"PHP {{getPHPVersion()}} and PCRE {{getPCREVersion()}} are used to execute your pattern on our server."
			}
		]
		},
		{
		label:"Query string support",
		desc:"In addition to the built in <b>Save</b> mechanism which creates a shareable link, RegExr also supports the ability to pre-populate a pattern via the query string."+
			"<p>The following query string params are recognized:<ul>"+
			"<li><code>engine</code> - the RegEx engine to use (<code>js</code> or <code>pcre</code>)</li>"+
			"<li><code>expression</code> - populates the Expression area. It is recommended to pass a full expression with flags (<code>/.*/ig</code>) not just the pattern (<code>.*</code>)</li>"+
			"<li><code>text</code> - populates the Text area</li>"+
			"<li><code>tool</code> - sets the tool (replace, list, details, or explain)</li>"+
			"<li><code>input</code> - populates the tool input field</li>"+
			"</ul></p>"+
			"Ex. <a href='http://regexr.com/?expression=/./g&text=test'>regexr.com/?expression=/./g&text=test</a>"
		}
	]
	}
];
