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

/*
The PCRE profile is almost a straight copy of the core profile.
*/
let y=true, n=false;

let pcre = {
	id: "pcre",
	label: "PCRE",
	browser: false,
	
	flags: {
		"u": n,
		"y": n
	},
	
	badEscChars: "uUlLN".split("").reduce((o, c) => { o[c] = y; return o}, {}),

	escCharCodes: {
		"v": n // vertical tab // PCRE support \v as vertical whitespace
	},
	
	tokens: {
		"escunicodeu": n, // \uFFFF
		"escunicodeub": n, // \u{00A9}
		// octalo PCRE 8.34+
	},
	
	substTokens: {
		"subst_$esc": n, // $$
		"subst_$&match": n, // $&
		"subst_$before": n, // $`
		"subst_$after": n // $'
	},
	
	config: {
		"reftooctalalways": n, // does a single digit reference \1 become an octal? (vs remain an unmatched ref)
		"substdecomposeref": n, // will a subst reference decompose? (ex. \3 becomes "\" & "3" if < 3 groups)
		"looseesc": n // should unrecognized escape sequences match the character (ex. \u could match "u") // disabled when `u` flag is set
	},
	
	docs: {
		"escoctal":{ext:"+<p>The syntax <code>\\o{FFF}</code> is also supported.</p>"},
		"numref":{
			ext:"<p>There are multiple syntaxes for this feature: <code>\\1</code> <code>\\g1</code> <code>\\g{1}</code>.</p>"+
				"<p>The latter syntaxes support relative values preceded by <code>+</code> or <code>-</code>. For example <code>\\g-1</code> would match the group preceding the reference.</p>"
		},
		"lazy": { ext:"+<p>This behaviour is reversed by the ungreedy (<code>U</code>) flag/modifier.</p>" }
	}
};

export default pcre;