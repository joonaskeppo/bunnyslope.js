import { REIFICATION, TEMPLATE, INTERNAL_PREFIX, BINDING, PREFIX } from "./internals";
import { parse, compile } from "./dsl";

// Namespaces for DSL
export let namespaces = {};

// Walk DOM while `pred` is satisfied,
// starting at `root` element, and invoking `f` on each element.
export const walkWhile = (pred, f, root) => {
    if (pred(root)) {
        f(root);
        for (
            let child = root.firstElementChild;
            child;
            child = child.nextElementSibling
        ) {
            walkWhile(pred, f, child);
        }
    }
};

// Wrap DOM element `elt` with `wrapperElement` (e.g., `<template>`)
export const wrapWith = (elt, wrapperElement) => {
    const tmpl = document.createElement(wrapperElement);
    tmpl.appendChild(elt.cloneNode(true));
    elt.replaceWith(tmpl);
    return tmpl;
};

export const setBinding = (elt, key, value) => {
    elt.setAttribute(`${BINDING}:${key}`, value);
};

export const getBinding = (elt, key) => elt.getAttribute(`${BINDING}:${key}`);

// Recursively infer value of binding `key`, for DOM element `elt`
export const inferRefValue = (elt, key) =>
    elt &&
    (elt.getAttribute(`${BINDING}:${key}`) ||
        inferRefValue(elt.parentElement, key));

// "Tokenize" instrumented attribute
// e.g., `b-for:state="default"` -> [['for', 'state'], 'default']
export const readAttribute = ({ name, value }) => [
    name.substring(2).split(":"),
    value,
];

// Mapping of directive type to handler fn
export const handlers = {
    when: (elt, value) => {
        if (value) {
            elt.style.display = "";
        } else {
            elt.style.display = "none";
        }
    },
    "when-not": (elt, value) => {
        handlers.when(elt, !value);
    },
    text: (elt, value) => {
        elt.innerText = value;
    },
    html: (elt, value) => {
        elt.innerHTML = value;
    },
    for: (elt, value) => {
        const tmplContent = elt.children[0];
        const child =
            tmplContent.tagName.toLowerCase() !== "template"
                ? wrapWith(tmplContent, "template")
                : tmplContent;
        child.setAttribute(TEMPLATE, "");

        const bindingKey = value[0];
        const bindingValues = value[1];

        for (let i = 0; i < bindingValues.length; i++) {
            const copy = child.children[0].cloneNode(true);
            copy.setAttribute(REIFICATION, "");
            setBinding(copy, "index", i);
            setBinding(copy, bindingKey, bindingValues[i]);
            elt.appendChild(copy);
            process(copy);
        }
    },
    let: (elt, value) => {
        for (const [k, v] of value) {
            setBinding(elt, k, v);
        }
    },
};

// Evaluate attribute through DSL
export const evalAttribute = (elt, attribute) => {
    const [nameTokens, dslStr] = readAttribute(attribute);
    const nsMap = nameTokens[1] ? getNamespace(nameTokens[1]) : {};
    const v = compile(parse(dslStr), nsMap, {
        getSymbolValue: (sym) => inferRefValue(elt, sym),
    })[0]; // array of compiled items (for now) -> take initial item only
    return { type: nameTokens[0], value: v };
};

// Get `elt` instrumentations (if any); return attributes starting with `prefix`
export const getInstrumentations = (elt, prefix = PREFIX) =>
    [...elt.attributes].filter(({ name }) => name.startsWith(prefix));

// Process individual DOM element `elt`
const process = (elt) => {
    const attrs = getInstrumentations(elt);
    if (attrs) {
        // TODO: need to actually sort these by precedence (`when` and `when-not` have higher precedence than `for`)
        for (let attr of attrs) {
            attr = evalAttribute(elt, attr);
            handlers[attr.type](elt, attr.value);
        }
    }
};

export const initialize = () => {
    for (const elt of document.querySelectorAll("body *")) {
        if (elt.hasAttribute(REIFICATION)) {
            elt.remove();
        }
        for (const attr of getInstrumentations(elt, INTERNAL_PREFIX)) {
            elt.removeAttribute(attr.name);
        }
    }
};

export const render = () => {
    initialize();
    walkWhile(
        (elt) => !elt.getAttribute(TEMPLATE),
        process,
        document.querySelector("body")
    );
};

// Register new namespace
// Example case: register `state` lookup for `b-show` -> `b-show:state`
export const registerNamespace = (nsKey, nsMap) => {
    namespaces[nsKey] = nsMap;
};

const getNamespace = (nsKey) => {
    const m = namespaces[nsKey];
    if (!m) {
        throw new Error(`Lookup failed, namespace not defined: ${nsKey}`);
    }
    return m;
};
