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

// this is just raw content for the Reference.
// right now all examples are executed in-browser, so they need to be compatible. Maybe swap to XRegExp at some point.
// TODO: rewrite to use multiline template literals?

let reference_content = {}, o = reference_content;
export default reference_content; 

o.label = "RegEx Reference";
o.id = "reference";
o.search = true,
o.desc = `Information on all of the tokens available to create regular expressions.
	<p>Double-click an item in the list to insert it into your Expression.</p>
	<p>Click the arrow beside an example to load it.</p>`;

o.kids = [
	{
	label: "Character classes",
	id: "charclasses",
	desc: "Character classes match a character from a specific set. There are a number of predefined character classes and you can also define your own sets.",
	kids: [
		
		{
		id:"set",
		label: "character set",
		desc:"Match any character in the set.",
		example:["[aeiou]","glib jocks vex dwarves!"],
		token:"[ABC]"
		},
		{
		id:"setnot",
		label: "negated set",
		desc:"Match any character that is not in the set.",
		example:["[^aeiou]","glib jocks vex dwarves!"],
		token:"[^ABC]"
		},
		{
		id:"range",
		tip:"Matches a character in the range {{getChar(prev)}} to {{getChar(next)}} (char code {{prev.code}} to {{next.code}}). {{getInsensitive()}}",
		example:["[g-s]","abcdefghijklmnopqrstuvwxyz"],
		desc: "Matches a character having a character code between the two specified characters inclusive.",
		token:"[A-Z]"
		},
		{
		id:"posixcharclass",
		tip:"Matches any character in the '{{value}}' POSIX class.",
		label:"POSIX class",
		desc:"Matches any character in the specified POSIX class. Must be in a character set. For example, <code>[[:alnum:]$]</code> will match alphanumeric characters and <code>$</code>.",
		ext:"<p>For a list of classes, see the <a href='http://www.pcre.org/original/doc/html/pcrepattern.html'>PCRE spec</a>.</p>",
		token:"[:alnum:]"
		},
		{
		id:"dot",
		tip:"Matches any character {{getDotAll()}}.",
		desc:"Matches any character except linebreaks.",
		ext:" Equivalent to <code>[^\\n\\r]</code>.",
		example:[".", "glib jocks vex dwarves!"],
		token:"."
		},
		{
		id:"matchanyset",
		label:"match any",
		desc:"A character set that can be used to match any character, including line breaks, without the dotall flag (<code>s</code>)."+
			"<p>An alternative is <code>[^]</code>, but it is not supported in all browsers.</p>",
		example:["[\\s\\S]", "glib jocks vex dwarves!"],
		token:"[\\s\\S]"
		},
		{
		id:"unicodegrapheme",
		label:"unicode grapheme",
		desc:"Matches any single unicode grapheme (ie. character).",
		ext:" This includes line breaks (regardless of the dotall mode) and graphemes encoded as multiple code points.",
		token:"\\X"
		},
		{
		id:"word",
		desc:"Matches any word character (alphanumeric & underscore).",
		ext:" Only matches low-ascii characters (no accented or non-roman characters). Equivalent to <code>[A-Za-z0-9_]</code>",
		example:["\\w","bonjour, mon fr\u00E8re"],
		token:"\\w"
		},
		{
		id:"notword",
		label: "not word",
		desc:"Matches any character that is not a word character (alphanumeric & underscore).",
		ext:" Equivalent to <code>[^A-Za-z0-9_]</code>",
		example:["\\W","bonjour, mon fr\u00E8re"],
		token:"\\W"
		},
		{
		id:"digit",
		desc:"Matches any digit character (0-9).",
		ext:" Equivalent to <code>[0-9]</code>.",
		example:["\\d","+1-(444)-555-1234"],
		token:"\\d"
		},
		{
		id:"notdigit",
		label: "not digit",
		desc:"Matches any character that is not a digit character (0-9).",
		ext:" Equivalent to <code>[^0-9]</code>.",
		example:["\\D","+1-(444)-555-1234"],
		token:"\\D"
		},
		{
		id:"whitespace",
		desc:"Matches any whitespace character (spaces, tabs, line breaks).",
		example:["\\s", "glib jocks vex dwarves!"],
		token:"\\s"
		},
		{
		id:"notwhitespace",
		label: "not whitespace",
		desc:"Matches any character that is not a whitespace character (spaces, tabs, line breaks).",
		example:["\\S", "glib jocks vex dwarves!"],
		token:"\\S"
		},
		{
		id:"hwhitespace",
		label:"horizontal whitespace",
		desc:"Matches any horizontal whitespace character (spaces, tabs).",
		token:"\\h"
		},
		{
		id:"nothwhitespace",
		label: "not horizontal whitespace",
		desc:"Matches any character that is not a horizontal whitespace character (spaces, tabs).",
		token:"\\H"
		},
		{
		id:"vwhitespace",
		label:"vertical whitespace",
		desc:"Matches any vertical whitespace character (line breaks).",
		token:"\\v"
		},
		{
		id:"notvwhitespace",
		label: "not vertical whitespace",
		desc:"Matches any character that is not a vertical whitespace character (line breaks).",
		token:"\\V"
		},
		{
		id:"linebreak",
		label:"line break",
		desc:"Matches any line break character, including the CRLF pair, and CR / LF individually.",
		token:"\\R"
		},
		{
		id:"notlinebreak",
		label:"not line break",
		desc:"Matches any character that is not a line break.",
		ext:" Similar to dot (<code>.</code>) but is unaffected by the dotall flag (<code>s</code>).",
		token:"\\N"
		},
		{
		id:"unicodecat",
		tip:"Matches any character in the '{{getUniCat()}}' unicode category.",
		label:"unicode category",
		desc:"Matches a character in the specified unicode category. For example, <code>\\p{Ll}</code> will match any lowercase letter.",
		ext:"<p>For a list of categories, see the <a href='http://www.pcre.org/original/doc/html/pcrepattern.html'>PCRE spec</a>.</p>"+
			"<p>There are multiple syntaxes for this feature:</p><p><code>\\p{L}</code> <code>\\pL</code></p>",
		token:"\\p{L}"
		},
		{
		id:"notunicodecat",
		tip:"Matches any character that is not in the '{{getUniCat()}}' unicode category.",
		label:"not unicode category",
		desc:"Matches any character that is not in the specified unicode category.",
		ext:"<p>For a list of categories, see the <a href='http://www.pcre.org/original/doc/html/pcrepattern.html'>PCRE spec</a>.</p>"+
			"<p>There are multiple syntaxes for this feature:</p><p><code>\\P{L}</code> <code>\\p{^L}</code> <code>\\PL</code></p>",
		token:"\\P{L}"
		},
		{
		id:"unicodescript",
		tip:"Matches any character in the '{{value}}' unicode script.",
		label:"unicode script",
		desc:"Matches any character in the specified unicode script. For example, <code>\\p{Arabic}</code> will match characters in the Arabic script.",
		ext:"<p>For a list of scripts, see the <a href='http://www.pcre.org/original/doc/html/pcrepattern.html'>PCRE spec</a>.</p>",
		token:"\\p{Han}"
		},
		{
		id:"notunicodescript",
		tip:"Matches any character that is not in the '{{value}}' unicode script.",
		label:"not unicode script",
		desc:"Matches any character that is not in the specified unicode script.",
		ext:"<p>For a list of scripts, see the <a href='http://www.pcre.org/original/doc/html/pcrepattern.html'>PCRE spec</a>.</p>"+
			"<p>There are multiple syntaxes for this feature:</p><p><code>\\P{Han}</code> <code>\\p{^Han}</code>",
		token:"\\P{Han}"
		}
	]
	},

	{
	label:"Anchors",
	id:"anchors",
	desc:"Anchors are unique in that they match a position within a string, not a character.",
	kids:[
		{
		id:"bos",
		label:"beginning of string",
		desc:"Matches the beginning of the string.",
		ext:" Unlike <code>^</code>, this is unaffected by the multiline flag (<code>m</code>). This matches a position, not a character.",
		token:"\\A"
		},
		{
		id:"eos",
		label:"end of string",
		desc:"Matches the end of the string.",
		ext:" Unlike <code>$</code>, this is unaffected by the multiline flag (<code>m</code>). This matches a position, not a character.",
		token:"\\Z"
		},
		{
		id:"abseos",
		label:"strict end of string",
		desc:"Matches the end of the string. Unlike <code>$</code> or <code>\\Z</code>, it does not allow for a trailing newline.",
		ext:" This is unaffected by the multiline flag (<code>m</code>). This matches a position, not a character.",
		token:"\\z"
		},
		{
		id:"bof",
		label:"beginning",
		desc:"Matches the beginning of the string, or the beginning of a line if the multiline flag (<code>m</code>) is enabled.",
		ext:" This matches a position, not a character.",
		example:["^\\w+","she sells seashells"],
		token:"^"
		},
		{
		id:"eof",
		label:"end",
		desc:"Matches the end of the string, or the end of a line if the multiline flag (<code>m</code>) is enabled.",
		ext:" This matches a position, not a character.",
		example:["\\w+$","she sells seashells"],
		token:"$"
		},
		{
		id:"wordboundary",
		label:"word boundary",
		desc:"Matches a word boundary position between a word character and non-word character or position (start / end of string).",
		ext:" See the word character class (<code>\w</code>) for more info.",
		example:["s\\b","she sells seashells"],
		token:"\\b"
		},
		{
		id:"notwordboundary",
		label: "not word boundary",
		desc:"Matches any position that is not a word boundary.",
		ext:" This matches a position, not a character.",
		example:["s\\B","she sells seashells"],
		token:"\\B"
		},
		{
		id:"prevmatchend",
		label: "previous match end",
		desc:"Matches the end position of the previous match.",
		ext:" This matches a position, not a character.",
		token:"\\G"
		}
	]
	},
	
	{
	label: "Escaped characters",
	id:"escchars",
	desc: "Escape sequences can be used to insert reserved, special, and unicode characters. All escaped characters begin with the <code>\\</code> character.",
	kids: [
		{
		id:"reservedchar",
		label:"reserved characters",
		desc:"The following character have special meaning, and should be preceded by a <code>\\</code> (backslash) to represent a literal character:"+
			"<p><code>{{getEscChars()}}</code></p>"+
			"<p>Within a character set, only <code>\\</code>, <code>-</code>, and <code>]</code> need to be escaped.</p>",
		example:["\\+","1 + 1 = 2"],
		token:"\\+",
		show:true
		},
		{
		id:"escoctal",
		label:"octal escape",
		desc:"Octal escaped character in the form <code>\\000</code>.",
		ext:" Value must be less than 255 (<code>\\377</code>).", // PCRE profile adds to ext.
		example:["\\251","RegExr is \u00A92014"],
		token:"\\000"
		},
		{
		id:"eschexadecimal",
		label:"hexadecimal escape",
		desc:"Hexadecimal escaped character in the form <code>\\xFF</code>.",
		example:["\\xA9","RegExr is \u00A92014"],
		token:"\\xFF"
		},
		{
		id:"escunicodeu",
		label:"unicode escape",
		desc:"Unicode escaped character in the form <code>\\uFFFF</code>",
		example:["\\u00A9","RegExr is \u00A92014"],
		token:"\\uFFFF"
		},
		{
		id:"escunicodeub",
		label:"extended unicode escape",
		desc:"Unicode escaped character in the form <code>\\u{FFFF}</code>.",
		ext:" Supports a full range of unicode point escapes with any number of hex digits. <p>Requires the unicode flag (<code>u</code>).</p>",
		token:"\\u{FFFF}"
		},
		{
		id:"escunicodexb",
		label:"unicode escape",
		desc:"Unicode escaped character in the form <code>\\x{FF}</code>.",
		token:"\\x{FF}"
		},
		{
		id:"esccontrolchar",
		label:"control character escape",
		desc:"Escaped control character in the form <code>\\cZ</code>.",
		ext:" This can range from <code>\\cA</code> (SOH, char code 1) to <code>\\cZ</code> (SUB, char code 26). <h1>Example:</h1><code>\\cI</code> matches TAB (char code 9).",
		token:"\\cI"
		},
		{
		id:"escsequence",
		label:"escape sequence",
		tip: "Matches the literal string '{{value}}'.",
		desc:"All characters between the <code>\\Q</code> and the <code>\\E</code> are interpreted as a literal string. If <code>\\E</code> is omitted, it continues to the end of the expression.",
		ext:" For example, the expression <code>/\\Q(?.)\\E/</code> will match the string <code>(?.)</code>.",
		token:"\\Q...\\E"
		}
	]
	},
	
	{
	label: "Groups & References",
	id:"groups",
	desc: "Groups allow you to combine a sequence of tokens to operate on them together. Capture groups can be referenced by a backreference and accessed separately in the results.",
	kids: [
		{
		id:"group",
		label: "capturing group",
		desc: "Groups multiple tokens together and creates a capture group for extracting a substring or using a backreference.",
		example:["(ha)+","hahaha haa hah!"],
		token:"(ABC)"
		},
		{
		id:"namedgroup",
		label: "named capturing group",
		tip:"Creates a capturing group named '{{name}}'.",
		desc:"Creates a capturing group that can be referenced via the specified name.",
		ext:"<p>There are multiple syntaxes for this feature:</p><p><code>(?'name'ABC)</code> <code>(?P&lt;name>ABC)</code> <code>(?&lt;name>ABC)</code></p>",
		token:"(?'name'ABC)"
		},
		{
		id:"namedref",
		label:"named reference",
		tip:"Matches the results of the capture group named '{{group.name}}'.",
		desc:"Matches the results of a named capture group.",
		ext:"<p>There are multiple syntaxes for this feature:</p><p><code>\\k'name'</code> <code>\\k&lt;name></code> <code>\\k{name}</code> <code>\\g{name}</code> <code>(?P=name)</code></p>",
		token:"\\k'name'"
		},
		{
		id:"numref",
		label:"numeric reference",
		tip:"Matches the results of capture group #{{group.num}}.",
		desc:"Matches the results of a capture group. For example <code>\\1</code> matches the results of the first capture group & <code>\\3</code> matches the third.",
		// PCRE adds relative and alternate syntaxes in ext
		example:["(\\w)a\\1","hah dad bad dab gag gab"],
		token:"\\1"
		},
		{
		id:"branchreset",
		label: "branch reset group",
		desc:"Define alternative groups that share the same group numbers.",
		ext: "<p>For example, in <code>(?|(a)|(b))</code> both groups (a and b) would be counted as group #1.",
		token:"(?|(a)|(b))"
		},
		{
		id:"noncapgroup",
		label: "non-capturing group",
		desc:"Groups multiple tokens together without creating a capture group.",
		example:["(?:ha)+","hahaha haa hah!"],
		token:"(?:ABC)"
		},
		{
		id:"atomic",
		label:"atomic group",
		desc:"Non-capturing group that discards backtracking positions once matched.",
		ext:"<p>For example, <code>/(?>ab|a)b/</code> will match <code>abb</code> but not <code>ab</code> because once the <code>ab</code> option has matched, the atomic group prevents backtracking to retry with the <code>a</code> option.</p>",
		token:"(?>ABC)"
		},
		{
		id:"define",
		desc:"Used to define named groups for use as subroutines without including them in the match.",
		ext:"<p>For example, <code>/A(?(DEFINE)(?'foo'Z))B\\g'foo'/</code> will match <code>ABZ</code>, because the define group is ignored in the match except to define the <code>foo</code> subroutine that is referenced later with <code>\\g'foo'</code>.</p>",
		token:"(?(DEFINE)(?'foo'ABC))"
		},
		{
		id:"numsubroutine",
		label:"numeric subroutine",
		tip:"Matches the expression in capture group #{{group.num}}.",
		desc:"Matches the expression in a capture group. Compare this to a reference, that matches the result."+
			" For example <code>/(a|b)\\g'1'/</code> can match <code>ab</code>, because the expression <code>a|b</code> is evaluated again.",
		ext:"<p>There are multiple syntaxes for this feature: <code>\\g&lt;1></code> <code>\\g'1'</code> <code>(?1)</code>.</p>"+
			"<p>Relative values preceded by <code>+</code> or <code>-</code> are also supported. For example <code>\\g<-1></code> would match the group preceding the reference.</p>",
		token:"\\g'1'"
		},
		{
		id:"namedsubroutine",
		label:"named subroutine",
		tip:"Matches the expression in the capture group named '{{group.name}}'.",
		desc:"Matches the expression in a capture group. Compare this to a reference, that matches the result.",
		ext:"<p>There are multiple syntaxes for this feature: <code>\\g&lt;name></code> <code>\\g'name'</code> <code>(?&name)</code> <code>(?P>name)</code>.</p>",
		token:"\\g'name'"
		}
	]
	},
	
	{
	label: "Lookaround",
	id:"lookaround",
	desc: "Lookaround lets you match a group before (lookbehind) or after (lookahead) your main pattern without including it in the result."+
		"<p>Negative lookarounds specify a group that can NOT match before or after the pattern.</p>",
	kids: [
		{
		id:"poslookahead",
		label: "positive lookahead",
		desc:"Matches a group after the main expression without including it in the result.",
		example:["\\d(?=px)","1pt 2px 3em 4px"],
		token:"(?=ABC)"
		},
		{
		id:"neglookahead",
		label: "negative lookahead",
		desc:"Specifies a group that can not match after the main expression (if it matches, the result is discarded).",
		example:["\\d(?!px)","1pt 2px 3em 4px"],
		token:"(?!ABC)"
		},
		{
		id:"poslookbehind",
		label: "positive lookbehind",
		desc:"Matches a group before the main expression without including it in the result.",
		token:"(?<=ABC)"
		},
		{
		id:"neglookbehind",
		label: "negative lookbehind",
		desc:"Specifies a group that can not match before the main expression (if it matches, the result is discarded).",
		token:"(?<!ABC)"
		},
		{
		id:"keepout",
		label:"keep out",
		desc:"Keep text matched so far out of the returned match, essentially discarding the match up to this point.",
		ext:"For example <code>/o\\Kbar/</code> will match <code>bar</code> within the string <code>foobar</code>",
		token:"\\K"
		}
	]
	},
	
	{
	label: "Quantifiers & Alternation",
	id:"quants",
	desc: "Quantifiers indicate that the preceding token must be matched a certain number of times. By default, quantifiers are greedy, and will match as many characters as possible."+
		"<hr/>Alternation acts like a boolean OR, matching one sequence or another.",
	kids: [
		{
		id:"plus",
		desc:"Matches 1 or more of the preceding token.",
		example:["b\\w+","b be bee beer beers"],
		token:"+"
		},
		{
		id:"star",
		desc:"Matches 0 or more of the preceding token.",
		example:["b\\w*","b be bee beer beers"],
		token:"*"
		},
		{
		id:"quant",
		label:"quantifier",
		tip:"Match {{getQuant()}} of the preceding token.",
		desc:"Matches the specified quantity of the previous token. "+
			"<code>{1,3}</code> will match 1 to 3. "+
			"<code>{3}</code> will match exactly 3. "+
			"<code>{3,}</code> will match 3 or more. ",
		example:["b\\w{2,3}","b be bee beer beers"],
		token:"{1,3}"
		},
		{
		id:"opt",
		label:"optional",
		desc:"Matches 0 or 1 of the preceding token, effectively making it optional.",
		example: ["colou?r", "color colour"],
		token:"?"
		},
		{
		id:"lazy",
		tip:"Makes the preceding quantifier {{getLazy()}}, causing it to match as {{getLazyFew()}} characters as possible.",
		desc:"Makes the preceding quantifier lazy, causing it to match as few characters as possible.",
		ext:" By default, quantifiers are greedy, and will match as many characters as possible.",
		example:["b\\w+?","b be bee beer beers"],
		token:"?"
		},
		{
		id:"possessive",
		desc:"Makes the preceding quantifier possessive. It will match as many characters as possible, and will not release them to match subsequent tokens.",
		ext:"<p>For example <code>/.*a/</code> would match <code>aaa</code>, but <code>/.*+a/</code> would not, because the repeating dot would match and not release the last character to match <code>a</code>.</p>",
		token:"+"
		},
		{
		id:"alt",
		label:"alternation",
		desc:"Acts like a boolean OR. Matches the expression before or after the <code>|</code>.",
		ext:"<p>It can operate within a group, or on a whole expression. The patterns will be tested in order.</p>",
		example:["b(a|e|i)d","bad bud bod bed bid"],
		token:"|"
		}
	]
	},
	
	{
	label: "Special",
	id:"other",
	desc: "Tokens that don't quite fit anywhere else.",
	kids: [
		{
		id:"comment",
		desc:"Allows you to insert a comment into your expression that is ignored when finding a match.",
		token:"(?#foo)"
		},
		{
		id:"conditional",
		desc:"Conditionally matches one of two options based on whether a lookaround is matched.",
		ext:"<p>For example, <code>/(?(?=a)ab|..)/</code> will match <code>ab</code> and <code>zx</code> but not <code>ax</code>, because if the first character matches the condition <code>a</code> then it evaluates the pattern <code>ab</code>.</p>"+
			"<p>Any lookaround can be used as the condition. A lookahead will start the subsequent match at the start of the condition, a lookbehind will start it after.</p>",
		token:"(?(?=A)B|C)"
		},
		{
		id:"conditionalgroup",
		label:"group conditional",
		desc:"Conditionally matches one of two options based on whether group '{{name}}' matched.",
		ext:"<p>For example, <code>/(z)?(?(1)a|b)/</code> will match <code>za</code> because the first capture group matches <code>z</code> successfully, which causes the conditional to match the first option <code>a</code>.</p>"+
			"<p>The same pattern will also match <code>b</code> on its own, because group 1 doesn't match, so it instead tries to match the second option <code>b</code>.</p>"+
			"<p>You can reference a group by name, number, or relative position (ex. <code>-1</code>).</p>",
		token:"(?(1)B|C)"
		},
		{
		id:"recursion",
		desc:"Attempts to match the full expression again at the current position.",
		ext:"<p>For example, <code>/a(?R)?b/</code> will match any number of <code>a</code> followed by the same number of <code>z</code>: the full text of <code>az</code> or <code>aaaazzzz</code>, but not <code>azzz</code>.</p>"+
			"<p>There are multiple syntaxes for this feature:</p><p><code>(?R)</code> <code>(?0)</code> <code>\\g<0></code> <code>\\g'0'</code></p>",
		token:"(?R)"
		},
		{
		id:"mode",
		label:"mode modifier",
		tip:"{{~getDesc()}}{{~getModes()}}",
		desc:"Enables or disables modes for the remainder of the expression.",
		ext:"Matching modes generally map to expression flags. For example <code>(?i)</code> would enable case insensitivity for the remainder of the expression."+
			"<p>Multiple modifiers can be specified, and any modifiers that follow <code>-</code> are disabled. For example <code>(?im-s)</code> would enable case insensitivity &amp; multiline modes, and disable dotall.</p>"+
			"<p>Supported modifiers are: <code>i</code> - case insensitive, <code>s</code> - dotall, <code>m</code> - multiline, <code>x</code> - free spacing, <code>J</code> - allow duplicate names, <code>U</code> - ungreedy.</p>",
		token:"(?i)"
		}
	]
	},

	{
	label: "Substitution",
	desc: "These tokens are used in a substitution string to insert different parts of the match.",
	target: "subst",
	id:"subst",
	kids: [
		{
		id:"subst_$&match",
		label: "match",
		desc:"Inserts the matched text.",
		token:"$&"
		},
		{
		id:"subst_0match",
		label: "match",
		desc:"Inserts the matched text.",
		ext:"<p>There are multiple syntaxes for this feature:</p><p><code>$0</code> <code>\\0</code> <code>\\{0}</code></p>",
		token:"$0"
		},
		{
		id:"subst_group",
		label: "capture group",
		tip:"Inserts the results of capture group #{{group.num}}.",
		desc:"Inserts the results of the specified capture group. For example, <code>$3</code> would insert the third capture group.",
		// NOTE: javascript profile overrides this:
		ext:"<p>There are multiple syntaxes for this feature:</p><p><code>$1</code> <code>\\1</code> <code>\\{1}</code></p>",
		token:"$1"
		},
		{
		id:"subst_$before",
		label: "before match",
		desc:"Inserts the portion of the source string that precedes the match.",
		token:"$`"
		},
		{
		id:"subst_$after",
		label: "after match",
		desc:"Inserts the portion of the source string that follows the match.",
		token:"$'"
		},
		{
		id:"subst_$esc",
		label: "escaped $",
		desc:"Inserts a dollar sign character ($).",
		token:"$$"
		},
		{
		id: "subst_esc",
		label: "escaped characters",
		token: "\\n",
		desc: "For convenience, these escaped characters are supported in the Replace string in RegExr: <code>\\n</code>, <code>\\r</code>, <code>\\t</code>, <code>\\\\</code>, and unicode escapes <code>\\uFFFF</code>. This may vary in your deploy environment."
		}
	]
	},
	
	{
	id:"flags",
	label:"Flags",
	tooltip:"Expression flags change how the expression is interpreted. Click to edit.",
	desc:"Expression flags change how the expression is interpreted. Flags follow the closing forward slash of the expression (ex. <code>/.+/igm</code> ).",
	target:"flags",
	kids: [
		{
		id:"caseinsensitive",
		label: "ignore case",
		desc:"Makes the whole expression case-insensitive.",
		ext:" For example, <code>/aBc/i</code> would match <code>AbC</code>.",
		token:"i"
		},
		{
		id:"global",
		label: "global search",
		tip: "Retain the index of the last match, allowing iterative searches.",
		desc:"Retain the index of the last match, allowing subsequent searches to start from the end of the previous match."+
			"<p>Without the global flag, subsequent searches will return the same match.</p><hr/>"+
			"RegExr only searches for a single match when the global flag is disabled to avoid infinite match errors.",
		token:"g"
		},
		{
		id:"multiline",
		tip:"Beginning/end anchors (<b>^</b>/<b>$</b>) will match the start/end of a line.",
		desc:"When the multiline flag is enabled, beginning and end anchors (<code>^</code> and <code>$</code>) will match the start and end of a line, instead of the start and end of the whole string."+
			"<p>Note that patterns such as <code>/^[\\s\\S]+$/m</code> may return matches that span multiple lines because the anchors will match the start/end of <b>any</b> line.</p>",
		token:"m"
		},
		{
		id:"unicode",
		tip:"Enables <code>\\x{FFFFF}</code> unicode escapes.",
		desc:"When the unicode flag is enabled, you can use extended unicode escapes in the form <code>\\x{FFFFF}</code>."+
			"<p>It also makes other escapes stricter, causing unrecognized escapes (ex. <code>\\j</code>) to throw an error.</p>",
		token:"u"
		},
		{
		id:"sticky",
		desc:"The expression will only match from its lastIndex position and ignores the global (<code>g</code>) flag if set.",
		ext:" Because each search in RegExr is discrete, this flag has no further impact on the displayed results.",
		token:"y"
		},
		{
		id:"dotall",
		desc:"Dot (<code>.</code>) will match any character, including newline.",
		token:"s"
		},
		{
		id:"extended",
		desc:"Literal whitespace characters are ignored, except in character sets.",
		token:"x"
		},
		{
		id:"ungreedy",
		tip:"Makes quantifiers ungreedy (lazy) by default.",
		desc:"Makes quantifiers ungreedy (lazy) by default. Quantifiers followed by <code>?</code> will become greedy.",
		token:"U"
		}
	]
	}
];

// content that isn't included in the Reference menu item:
o.misc = {
	kids:[
		{
		id:"ignorews",
		label:"ignored whitespace",
		tip:"Whitespace character ignored due to the e<b>x</b>tended flag or mode."
		},
		{
		id:"extnumref", // alternative syntaxes.
		proxy:"numref"
		},
		{
		id:"char",
		label:"character",
		tip:"Matches a {{getChar()}} character (char code {{code}}). {{getInsensitive()}}"
		},
		{
		id:"escchar",
		label:"escaped character",
		tip:"Matches a {{getChar()}} character (char code {{code}})."
		},
		{
		id:"open",
		tip:"Indicates the start of a regular expression."
		},
		{
		id:"close",
		tip:"Indicates the end of a regular expression and the start of expression flags."
		},
		{
		id:"condition",
		tip:"The lookaround to match in resolving the enclosing conditional statement. See 'conditional' in the Reference for info."
		},
		{
		id:"conditionalelse",
		label:"conditional else",
		tip:"Delimits the 'else' portion of the conditional."
		},
		{
		id:"ERROR",
		tip:"Errors in the expression are underlined in red. Roll over errors for more info."
		},
		{
		id:"PREG_INTERNAL_ERROR",
		tip:"Internal PCRE error"
		},
		{
		id:"PREG_BACKTRACK_LIMIT_ERROR",
		tip:"Backtrack limit was exhausted."
		},
		{
		id:"PREG_RECURSION_LIMIT_ERROR",
		tip:"Recursion limit was exhausted"
		},
		{
		id:"PREG_BAD_UTF8_ERROR",
		tip:"Malformed UTF-8 data"
		},
		{
		id:"PREG_BAD_UTF8_OFFSET_ERROR",
		tip:"Malformed UTF-8 data"
		}
	]
};

o.errors = {
	groupopen:"Unmatched opening parenthesis.",
	groupclose:"Unmatched closing parenthesis.",
	setopen:"Unmatched opening square bracket.",
	rangerev:"Range values reversed. Start char code is greater than end char code.",
	quanttarg:"Invalid target for quantifier.",
	quantrev:"Quantifier minimum is greater than maximum.",
	esccharopen:"Dangling backslash.",
	esccharbad:"Unrecognized or malformed escape character.",
	unicodebad:"Unrecognized unicode category or script.",
	posixcharclassbad:"Unrecognized POSIX character class.",
	posixcharclassnoset:"POSIX character class must be in a character set.",
	notsupported:"The \"{{~getLabel()}}\" feature is not supported in this flavor of RegEx.",
	fwdslash:"Unescaped forward slash. This may cause issues if copying/pasting this expression into code.",
	esccharbad:"Invalid escape sequence.",
	servercomm:"An error occurred while communicating with the server.",
	extraelse:"Extra else in conditional group.",
	unmatchedref:"Reference to non-existent group \"{{name}}\".",
	modebad:"Unrecognized mode flag \"<code>{{errmode}}</code>\".",
	badname:"Group name can not start with a digit.",
	dupname:"Duplicate group name.",
	branchreseterr:"<b>Branch Reset.</b> Results will be ok, but RegExr's parser does not number branch reset groups correctly. Coming soon!",
	timeout:"The expression took longer than 250ms to execute.", // TODO: can we couple this to the help content somehow?

	// warnings:
	jsfuture:"The \"{{~getLabel()}}\" feature may not be supported in all browsers.",
	infinite:"The expression can return empty matches, and may match infinitely in some use cases.", // TODO: can we couple this to the help content somehow?
};

/*
classes:
quant
set
special
ref
esc
anchor
charclass
group
comment
 */
