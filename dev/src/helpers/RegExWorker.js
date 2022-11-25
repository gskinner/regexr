/**
 * At build time this file is injected into the index.html file.
 * In the .regexWorker script tag.
 *
 */
import PCRE from "../pcre2-wasm/dist/PCRE";

onmessage = async function (evt) {
	const o = evt.data;
	const { text, tests, mode, flavor, tool, pattern, flags } = o;
	const matches = [];
	let error, toolResult;

	// Only init PCRE once. Its fairly resource intensive, and will actually crash the browser if called too often.
	if (flavor === "pcre" && !this._pcreInitilized) {
		await PCRE.init();
		this._pcreInitilized = true;
	}

	const createPCRE = () => {
		// Only supported flags are:  i, m, s, and x
		// PCRE doesn't have a "g" flag, instead `matchAll()` is used.
		return new PCRE(pattern, flags.replace("g", ""));
	}

	const pcreMatch = (subject) => {
		const pcre = createPCRE();
		let result;

		try {
			result = flags.includes("g")
				? pcre.matchAll(subject)
				: [pcre.match(subject)];
		} catch (e) {
			error = {id: e.message};
		}

		pcre.destroy();

		return result;
	};

	const pcreReplace = (subject, replacement) => {
		const pcre = createPCRE();
		let result;

		try {
			result = pcre.substitute(subject, replacement);
		} catch (e) {
			error = {id: e.message};
		}

		pcre.destroy();
		return result;
	}

	const runPCRE = () => {
		if (mode === "tests") {
			for (let i = 0, l = tests.length; i < l; i++) {
				const test = tests[i];
				const match = pcreMatch(test.text);
				const firstMatch = match[0];

				matches[i] =
					firstMatch && firstMatch?.length > 0
						? {
								i: firstMatch[0].start,
								l: firstMatch[0].end - firstMatch[0].start,
								id: test.id,
						  }
						: { id: test.id };
			}
		} else {
			const matchResult = pcreMatch(text);
			matchResult.forEach((match) => {
				const groups = [];
				for (let i = 1; i < match.length; i++) {
					groups.push({ s: match[i].match });
				}

				matches.push({
					i: match[0].start,
					l: match[0].end - match[0].start,
					groups,
				});
			});

			let result = "", repl, ref, trimR = 0;
			let resultText = text;

			switch (tool.id) {
				case 'replace':
					result = pcreReplace(text, tool.input);
					resultText = result;
					break;
				case 'list':
					let str = tool.input;

					if (str.search(/\$[&1-9`']/) === -1) {
						trimR = str.length;
						str = "$&"+str;
					}
					do {
						ref = pcreReplace(resultText, "\b"); // bell char - just a placeholder to find
						if (!ref) { break; }
						let index = ref.indexOf("\b"), empty = (ref.length > resultText.length);
						if (index === -1) { break; }
						repl = pcreReplace(resultText, str);
						if (!repl) { break; }

						result += repl.substr(index, repl.length-ref.length+1);
						resultText = ref.substr(index+(empty?2:1));
					} while (resultText.length);

					if (trimR) { result = result.substr(0, result.length-trimR); }

					toolResult = result;
					break;
			}
		}
	};

	const runJS = () => {
		let regex = new RegExp(pattern, flags);
		let match, index;

		if (mode === "tests") {
			for (let i = 0, l = tests.length; i < l; i++) {
				const test = tests[i];
				regex.lastIndex = 0;
				match = regex.exec(test.text);
				matches[i] = match
					? { i: match.index, l: match[0].length, id: test.id }
					: { id: test.id };
			}
		} else {
			// Matches first
			while ((match = regex.exec(text))) {
				if (index === regex.lastIndex) {
					error = { id: "infinite", warning: true };
					++regex.lastIndex;
				}
				index = regex.lastIndex;
				const groups = match.reduce(function (arr, s, i) {
					return (i === 0 || arr.push({ s: s })) && arr;
				}, []);
				matches.push({ i: match.index, l: match[0].length, groups });
				if (!regex.global) {
					break;
				} // or it will become infinite.
			}

			// Tool output.
			let str = tool.input;
			switch (tool.id) {
				case 'replace':
					toolResult = text.replace(regex, str);
					break;
				case 'list':
					let result = "", repl, ref, trimR = 0;
					let resultText = text;

					// build a RegExp without the global flag:
					try {
						regex = new RegExp(pattern, flags.replace("g", ""));
					} catch(e) {
						toolResult = null;
					}

					if (regex) {
						if (str.search(/\$[&1-9`']/) === -1) {
							trimR = str.length;
							str = "$&"+str;
						}
						do {
							ref = resultText.replace(regex, "\b"); // bell char - just a placeholder to find
							let index = ref.indexOf("\b"), empty = (ref.length > resultText.length);
							if (index === -1) { break; }
							repl = resultText.replace(regex, str);
							result += repl.substr(index, repl.length-ref.length+1);
							resultText = ref.substr(index+(empty?2:1));
						} while (resultText.length);

						if (trimR) { result = result.substr(0, result.length-trimR); }

						toolResult = result;
					}
					break;
			}
		}
	};

	// Signal when we actually start processing the RegEx, so the parent can start its timeout timer.
	postMessage("onstart");

	if (flavor === "pcre") {
		runPCRE();
	} else {
		runJS();
	}

	postMessage({ error, matches, mode, tool: toolResult });
};
