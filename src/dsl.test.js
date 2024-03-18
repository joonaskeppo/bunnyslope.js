const { parse, compile } = require("./dsl");

describe("parsing", () => {
    test("blanks should parse as empty seq", () => {
        expect(parse("")).toStrictEqual([]);
        expect(parse("    \n  ")).toStrictEqual([]);
    });

    describe("symbols only", () => {
        test("a single symbol is parsed", () => {
            expect(parse("my-thing")).toStrictEqual([
                { type: "symbol", value: "my-thing" },
            ]);
        });
        test("multiple symbols separated by whitespace are parsed", () => {
            expect(parse(" one-thing    another-thing")).toStrictEqual([
                { type: "symbol", value: "one-thing" },
                { type: "symbol", value: "another-thing" },
            ]);
        });
    });

    describe("numbers only", () => {
        test("integers are parsed", () => {
            expect(parse("1234 -123")).toStrictEqual([
                { type: "number", value: 1234 },
                { type: "number", value: -123 },
            ]);
            expect(parse("999 0001234")).toStrictEqual([
                { type: "number", value: 999 },
                { type: "number", value: 1234 },
            ]);
        });
        test("floats are parsed", () => {
            expect(parse("0.999 1.234")).toStrictEqual([
                { type: "number", value: 0.999 },
                { type: "number", value: 1.234 },
            ]);
            expect(parse("001.234 -12.34")).toStrictEqual([
                { type: "number", value: 1.234 },
                { type: "number", value: -12.34 },
            ]);
        });
    });

    describe("strings only", () => {
        test("a single string is parsed", () => {
            expect(parse("'this is a string'")).toStrictEqual([
                { type: "string", value: "this is a string" },
            ]);
        });
        test("multiple strings with escaped quotes separated by whitespace are parsed", () => {
            expect(
                parse(
                    " 'abc'  'here\\'s another' 'double \"quotes\" don\\'t count'  'def'  "
                )
            ).toStrictEqual([
                { type: "string", value: "abc" },
                { type: "string", value: "here's another" },
                { type: "string", value: 'double "quotes" don\'t count' },
                { type: "string", value: "def" },
            ]);
        });
    });

    describe("compound data", () => {
        test("a single list containing symbols", () => {
            expect(parse("(my-fn some symbols)")).toStrictEqual([
                {
                    type: "list",
                    value: [
                        { type: "symbol", value: "my-fn" },
                        { type: "symbol", value: "some" },
                        { type: "symbol", value: "symbols" },
                    ],
                },
            ]);
        });
        test("a single vector containing symbols", () => {
            expect(parse("[my-fn some symbols]")).toStrictEqual([
                {
                    type: "vector",
                    value: [
                        { type: "symbol", value: "my-fn" },
                        { type: "symbol", value: "some" },
                        { type: "symbol", value: "symbols" },
                    ],
                },
            ]);
        });
        test("a nested list", () => {
            expect(
                parse("(my-fn 'a string' (another-fn a-sym) (constantly-true))")
            ).toStrictEqual([
                {
                    type: "list",
                    value: [
                        { type: "symbol", value: "my-fn" },
                        { type: "string", value: "a string" },
                        {
                            type: "list",
                            value: [
                                { type: "symbol", value: "another-fn" },
                                { type: "symbol", value: "a-sym" },
                            ],
                        },
                        {
                            type: "list",
                            value: [
                                { type: "symbol", value: "constantly-true" },
                            ],
                        },
                    ],
                },
            ]);
        });
    });
});

describe("compiling", () => {
    test("non-nested fn calls", () => {
        expect(
            compile(parse("(no-args)"), { "no-args": () => ["NO ARGS"] })
        ).toStrictEqual([["NO ARGS"]]);
        expect(
            compile(parse("(cons 'a' 'b')"), { cons: (a, b) => [a, b] })
        ).toStrictEqual([["a", "b"]]);
        expect(
            compile(parse("(+ 1 2 3)"), {
                '+': (...args) => args.reduce((acc, v) => acc + v, 0),
            })
        ).toStrictEqual([6]);
    });

    test('nested fn calls', () => {
        expect(
            compile(parse("(+ (+ 1 1 0 0) 1 (+ 1 0) (+ 0 (+ 1 1)))"), {
                '+': (...args) => args.reduce((acc, v) => acc + v, 0),
            })
        ).toStrictEqual([6]);
    })

    test('vector with fn calls', () => {
        expect(
            compile(parse("[1 2 (+ 4 5) [0 1]]"), {
                '+': (...args) => args.reduce((acc, v) => acc + v, 0),
            })
        ).toStrictEqual([[1, 2, 9, [0, 1]]]);
    })
});
