// tslint:disable:object-literal-sort-keys

/**
 * This was originally forked from https://github.com/occ/TraceKit, but has since been
 * largely modified and is now maintained as part of Sentry JS SDK.
 */

/**
 * An object representing a single stack frame.
 */
export interface StackFrame {
    url: string;
    func: string;
    args: string[];
    line: number | null;
    column: number | null;
}

/**
 * An object representing a JavaScript stack trace.
 */
export interface StackTrace {
    name: string;
    message: string;
    mechanism?: string;
    stack: StackFrame[];
    failed?: boolean;
}

// Constant for unknown function name
const UNKNOWN_FUNCTION = "?";

// Regular expressions for parsing stack traces from different browsers
const chrome = /^\s*at (?:(.*?) ?\()?((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|[-a-z]+:|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
const gecko = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:file|https?|blob|chrome|webpack|resource|moz-extension).*?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js))(?::(\d+))?(?::(\d+))?\s*$/i;
const winjs = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;
const geckoEval = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
const chromeEval = /\((\S*)(?::(\d+))(?::(\d+))\)/;
const miniapp = /^\s*at (\w.*) \((\w*.js):(\d*):(\d*)/i;

/** Compute a JavaScript stack trace */
export function computeStackTrace(ex: any): StackTrace {
    let stack: StackTrace | null = null;
    const popSize: number = ex && ex.framesToPop;

    try {
        stack = computeStackTraceFromStacktraceProp(ex);
        if (stack) {
            return popFrames(stack, popSize);
        }
    } catch (e) {
        // ignore exception
    }

    try {
        stack = computeStackTraceFromStackProp(ex);
        if (stack) {
            return popFrames(stack, popSize);
        }
    } catch (e) {
        // ignore exception
    }

    return {
        message: extractMessage(ex),
        name: ex && ex.name,
        stack: [],
        failed: true,
    };
}

/** Compute stack trace from `stack` property */
function computeStackTraceFromStackProp(ex: any): StackTrace | null {
    if (!ex || !ex.stack) {
        return null;
    }

    const stack: StackFrame[] = [];
    const lines = ex.stack.split("\n");
    let isEval: string | boolean;
    let submatch: RegExpExecArray | null;
    let parts: RegExpExecArray | null;

    for (let i = 0; i < lines.length; ++i) {
        let element: StackFrame | null = null;

        if ((parts = chrome.exec(lines[i]))) {
            const isNative = parts[2] && parts[2].indexOf("native") === 0;
            isEval = parts[2] && parts[2].indexOf("eval") === 0;

            if (isEval && (submatch = chromeEval.exec(parts[2]))) {
                parts[2] = submatch[1];
                parts[3] = submatch[2];
                parts[4] = submatch[3];
            }

            element = {
                url: parts[2],
                func: parts[1] || UNKNOWN_FUNCTION,
                args: isNative ? [parts[2]] : [],
                line: parts[3] ? +parts[3] : null,
                column: parts[4] ? +parts[4] : null,
            };

        } else if ((parts = winjs.exec(lines[i]))) {
            element = {
                url: parts[2],
                func: parts[1] || UNKNOWN_FUNCTION,
                args: [],
                line: +parts[3],
                column: parts[4] ? +parts[4] : null,
            };

        } else if ((parts = gecko.exec(lines[i]))) {
            isEval = parts[3] && parts[3].indexOf(" > eval") > -1;

            if (isEval && (submatch = geckoEval.exec(parts[3]))) {
                parts[1] = parts[1] || `eval`;
                parts[3] = submatch[1];
                parts[4] = submatch[2];
                parts[5] = "";
            } else if (i === 0 && !parts[5] && ex.columnNumber !== void 0) {
                stack[0].column = (ex.columnNumber as number) + 1;
            }

            element = {
                url: parts[3],
                func: parts[1] || UNKNOWN_FUNCTION,
                args: parts[2] ? parts[2].split(",") : [],
                line: parts[4] ? +parts[4] : null,
                column: parts[5] ? +parts[5] : null,
            };

        } else if ((parts = miniapp.exec(lines[i]))) {
            element = {
                url: parts[2],
                func: parts[1] || UNKNOWN_FUNCTION,
                args: [],
                line: parts[3] ? +parts[3] : null,
                column: parts[4] ? +parts[4] : null,
            };

        } else {
            continue;
        }

        if (!element.func && element.line) {
            element.func = UNKNOWN_FUNCTION;
        }

        stack.push(element);
    }

    if (!stack.length) {
        return null;
    }

    return {
        message: extractMessage(ex),
        name: ex.name,
        stack,
    };
}

/** Compute stack trace from `stacktrace` property */
function computeStackTraceFromStacktraceProp(ex: any): StackTrace | null {
    if (!ex || !ex.stacktrace) {
        return null;
    }

    const stacktrace = ex.stacktrace;
    const opera10Regex = / line (\d+).*script (?:in )?(\S+)(?:: in function (\S+))?$/i;
    const opera11Regex = / line (\d+), column (\d+)\s*(?:in (?:<anonymous function: ([^>]+)>|([^\)]+))\((.*)\))? in (.*):\s*$/i;
    const lines = stacktrace.split("\n");
    const stack: StackFrame[] = [];
    let parts: RegExpExecArray | null;

    for (let line = 0; line < lines.length; line += 2) {
        let element: StackFrame | null = null;

        if ((parts = opera10Regex.exec(lines[line]))) {
            element = {
                url: parts[2],
                func: parts[3],
                args: [],
                line: +parts[1],
                column: null,
            };
        } else if ((parts = opera11Regex.exec(lines[line]))) {
            element = {
                url: parts[6],
                func: parts[3] || parts[4],
                args: parts[5] ? parts[5].split(",") : [],
                line: +parts[1],
                column: +parts[2],
            };
        }

        if (element) {
            if (!element.func && element.line) {
                element.func = UNKNOWN_FUNCTION;
            }
            stack.push(element);
        }
    }

    if (!stack.length) {
        return null;
    }

    return {
        message: extractMessage(ex),
        name: ex.name,
        stack,
    };
}

/** Remove N number of frames from the stack */
function popFrames(stacktrace: StackTrace, popSize: number): StackTrace {
    return {
        ...stacktrace,
        stack: stacktrace.stack.slice(popSize),
    };
}

/** Extract message from the exception object */
function extractMessage(ex: any): string {
    const message = ex && ex.message;
    if (!message) {
        return "No error message";
    }
    if (message.error && typeof message.error.message === "string") {
        return message.error.message;
    }
    return message;
}