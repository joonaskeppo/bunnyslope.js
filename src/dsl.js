// ## Parser

const openToClosingParen = {
    "(": ")",
    "[": "]",
};

const isDelimiter = (ch) => {
    return ["[", "]", "(", ")", " ", "\t", "\n", "\r", undefined].includes(ch);
};

// For parsing both vectors and lists
const parseNextParens = (input) => {
    const parenType = input.at(0);
    let s = input.substring(1);
    let acc = [];
    let parenCount = 1;

    for (;;) {
        if (!s.at(0)) {
            return [];
        }
        if (openToClosingParen[parenType] === s.at(0)) {
            parenCount += 1;
            if (parenCount % 2 === 0) {
                break;
            }
        }

        [s, v] = parseNext(s);
        acc = acc.concat(v);
    }

    return [
        s.substring(1),
        { type: parenType === "(" ? "list" : "vector", value: acc },
    ];
};

const parseNextString = (input) => {
    // Start `idx` at char after initial single quote
    for (let idx = 1; ; idx++) {
        // Should find closing quotation mark, not EOF
        if (!input.at(idx)) {
            return [];
        }
        if ("'" === input.at(idx) && "\\" !== input.at(idx - 1)) {
            return [
                input.substring(idx + 1),
                {
                    type: "string",
                    value: input.substring(1, idx).replaceAll("\\", ""),
                },
            ];
        }
    }
};

const parseNextSymbol = (input) => {
    for (let idx = 0; ; idx++) {
        if (isDelimiter(input.at(idx))) {
            return [
                input.substring(idx),
                { type: "symbol", value: input.substring(0, idx) },
            ];
        }
    }
};

const parseNextNumber = (input) => {
    let acc = input.at(0);
    let s = input.substring(1);
    let decimal = false;

    for (;;) {
        const ch = s.at(0);
        if (isDelimiter(ch)) {
            break;
        } else if ("." === ch) {
            if (decimal) {
                throw new Error(
                    `Malformed number; found more than one decimal point, starting with: ${acc}${ch}`
                );
            } else {
                decimal = true;
                acc += ch;
                s = s.substring(1);
            }
        } else if ("0" <= ch && ch <= "9") {
            acc += ch;
            s = s.substring(1);
        } else {
            throw new Error(`Malformed number, starting with: ${acc}${ch}`);
        }
    }

    return [
        s,
        {
            type: "number",
            value: decimal ? parseFloat(acc) : parseInt(acc),
        },
    ];
};

const parseNext = (input) => {
    const s = input.trimStart();
    const ch = s.at(0);

    switch (ch) {
        case undefined:
        case "":
            return [];
        case "-":
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
            return parseNextNumber(s);
        case "(":
        case "[":
            return parseNextParens(s);
        case "'":
            return parseNextString(s);
        default:
            return parseNextSymbol(s);
    }
};

const parse = (input) => {
    let acc = [];
    let rem = input;

    while (rem) {
        [rem, token] = parseNext(rem);
        if (token) {
            acc.push(token);
        }
    }

    return acc;
};

// ## Compiler

// We compile the parsed "AST" with data we've inferred from attributes, registry.

const compileNode = (node, data, opts) => {
    switch (node.type) {
        // Function call
        case "list":
            const fName = node.value[0].value;
            const f = data[fName];
            if ("symbol" !== node.value[0].type) {
                throw new Error(
                    `Expected a symbol for fn call, got a ${node.value[0].type}.`
                );
            }
            if (!f) {
                throw new Error(
                    `'${fName}' not found, could not eval function.`
                );
            }
            const args = node.value
                .slice(1)
                .map((arg) => compileNode(arg, data, opts));
            return f.apply(null, args);
        // Just an array
        case "vector":
            return node.value.map((elt) => compileNode(elt, data, opts));
        case "symbol":
            return (
                (opts.getSymbolValue && opts.getSymbolValue(node.value)) ||
                data[node.value]
            );
        case "number":
        case "string":
            return node.value;
    }
};

const compile = (ast, data, opts = {}) => {
    let acc = [];
    let rem = ast;

    for (const node of ast) {
        value = compileNode(node, data, opts);
        acc.push(value);
    }

    return acc;
};

module.exports = { parse, compile };
