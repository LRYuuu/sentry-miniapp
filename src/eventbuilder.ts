import {
    Event,
    EventHint,
    Exception,
    SeverityLevel,
    StackFrame,
    StackParser,
    addExceptionMechanism,
    addExceptionTypeValue,
    extractExceptionKeysForMessage,
    isDOMError,
    isDOMException,
    isError,
    isErrorEvent,
    isEvent,
    isPlainObject,
    normalizeToSize,
    resolvedSyncPromise,
} from '@sentry/core';

import { eventFromStacktrace } from './parsers';
import { computeStackTrace } from './tracekit';

/** JSDoc */
export function eventFromUnknownInput(
    stackParser: StackParser,
    exception: unknown,
    syntheticException?: Error,
    attachStacktrace?: boolean,
    isUnhandledRejection?: boolean,
): Event {
    let event: Event;

    if (isErrorEvent(exception as ErrorEvent) && (exception as ErrorEvent).error) {
        // If it is an ErrorEvent with `error` property, extract it to get actual Error
        const errorEvent = exception as ErrorEvent;
        exception = errorEvent.error; // tslint:disable-line:no-parameter-reassignment
        event = eventFromStacktrace(computeStackTrace(exception as Error));
        return event;
    }
    if (isDOMError(exception) || isDOMException(exception as DOMException)) {
        // If it is a DOMError or DOMException (which are legacy APIs, but still supported in some browsers)
        // then we just extract the name and message, as they don't provide anything else
        // https://developer.mozilla.org/en-US/docs/Web/API/DOMError
        // https://developer.mozilla.org/en-US/docs/Web/API/DOMException
        const domException = exception as DOMException;
        const name = domException.name || (isDOMError(domException) ? 'DOMError' : 'DOMException');
        const message = domException.message ? `${name}: ${domException.message}` : name;

        event = eventFromString(stackParser, message, syntheticException, attachStacktrace);
        addExceptionTypeValue(event, message);
        return event;
    }
    if (isError(exception as Error)) {
        // we have a real Error object, do nothing
        event = eventFromStacktrace(computeStackTrace(exception as Error));
        return event;
    }
    if (isPlainObject(exception) || isEvent(exception)) {
        // If it is plain Object or Event, serialize it manually and extract options
        // This will allow us to group events based on top-level keys
        // which is much better than creating new group when any key/value change
        const objectException = exception as {};
        event = eventFromPlainObject(stackParser, objectException, syntheticException, isUnhandledRejection);
        addExceptionMechanism(event, {
            synthetic: true,
        });
        return event;
    }

    // If none of previous checks were valid, then it means that it's not:
    // - an instance of DOMError
    // - an instance of DOMException
    // - an instance of Event
    // - an instance of Error
    // - a valid ErrorEvent (one with an error property)
    // - a plain Object
    //
    // So bail out and capture it as a simple message:
    event = eventFromString(stackParser, exception as string, syntheticException, attachStacktrace);
    addExceptionTypeValue(event, `${exception}`, undefined);
    addExceptionMechanism(event, {
        synthetic: true,
    });

    return event;
}

// this._options.attachStacktrace
/** JSDoc */
export function eventFromString(
    stackParser: StackParser,
    input: string,
    syntheticException?: Error,
    attachStacktrace?: boolean,
): Event {
    const event: Event = {
        message: input,
    };

    if (attachStacktrace && syntheticException) {
        const frames = parseStackFrames(stackParser, syntheticException);
        if (frames.length) {
            event.exception = {
                values: [{ value: input, stacktrace: { frames } }],
            };
        }
    }

    return event;
}

export function eventFromMessage(
    stackParser: StackParser,
    message: string,
    // eslint-disable-next-line deprecation/deprecation
    level: SeverityLevel = 'info',
    hint?: EventHint,
    attachStacktrace?: boolean,
): PromiseLike<Event> {
    const syntheticException = (hint && hint.syntheticException) || undefined;
    const event = eventFromString(stackParser, message, syntheticException, attachStacktrace);
    event.level = level;
    if (hint && hint.event_id) {
        event.event_id = hint.event_id;
    }
    return resolvedSyncPromise(event);
}

export function eventFromException(
    stackParser: StackParser,
    exception: unknown,
    hint?: EventHint,
    attachStacktrace?: boolean,
): PromiseLike<Event> {
    const syntheticException = (hint && hint.syntheticException) || undefined;
    const event = eventFromUnknownInput(stackParser, exception, syntheticException, attachStacktrace);
    addExceptionMechanism(event); // defaults to { type: 'generic', handled: true }
    event.level = 'error';
    if (hint && hint.event_id) {
        event.event_id = hint.event_id;
    }
    return resolvedSyncPromise(event);
}

export function parseStackFrames(
    stackParser: StackParser,
    ex: Error & { framesToPop?: number; stacktrace?: string },
): StackFrame[] {
    // Access and store the stacktrace property before doing ANYTHING
    // else to it because Opera is not very good at providing it
    // reliably in other circumstances.
    const stacktrace = ex.stacktrace || ex.stack || '';

    const popSize = getPopSize(ex);

    try {
        return stackParser(stacktrace, popSize);
    } catch (e) {
        // no-empty
    }

    return [];
}

const reactMinifiedRegexp = /Minified React error #\d+;/i;
function getPopSize(ex: Error & { framesToPop?: number }): number {
    if (ex) {
        if (typeof ex.framesToPop === 'number') {
            return ex.framesToPop;
        }

        if (reactMinifiedRegexp.test(ex.message)) {
            return 1;
        }
    }

    return 0;
}

export function eventFromPlainObject(
    stackParser: StackParser,
    exception: Record<string, unknown>,
    syntheticException?: Error,
    isUnhandledRejection?: boolean,
): Event {
    const event: Event = {
        exception: {
            values: [
                {
                    type: isEvent(exception) ? exception.constructor.name : isUnhandledRejection ? 'UnhandledRejection' : 'Error',
                    value: `Non-Error ${isUnhandledRejection ? 'promise rejection' : 'exception'
                        } captured with keys: ${extractExceptionKeysForMessage(exception)}`,
                },
            ],
        },
        extra: {
            __serialized__: normalizeToSize(exception),
        },
    };

    if (syntheticException) {
        const frames = parseStackFrames(stackParser, syntheticException);
        if (frames.length) {
            // event.exception.values[0] has been set above
            (event.exception as { values: Exception[] }).values[0].stacktrace = { frames };
        }
    }

    return event;
}