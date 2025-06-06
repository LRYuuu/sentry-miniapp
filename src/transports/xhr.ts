import { createTransport, BaseTransportOptions, Transport, TransportMakeRequestResponse, TransportRequest, SyncPromise } from '@sentry/core';

/**
 * The DONE ready state for XmlHttpRequest
 *
 * Defining it here as a constant b/c XMLHttpRequest.DONE is not always defined
 * (e.g. during testing, it is `undefined`)
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/readyState}
 */
const XHR_READYSTATE_DONE = 4;

/**
 * Creates a Transport that uses the XMLHttpRequest API to send events to Sentry.
 */
export function makeXHRTransport(options: BaseTransportOptions): Transport {
    function makeRequest(request: TransportRequest): PromiseLike<TransportMakeRequestResponse> {
        return new SyncPromise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.onerror = reject;

            xhr.onreadystatechange = (): void => {
                if (xhr.readyState === XHR_READYSTATE_DONE) {
                    resolve({
                        statusCode: xhr.status,
                        headers: {
                            'x-sentry-rate-limits': xhr.getResponseHeader('X-Sentry-Rate-Limits'),
                            'retry-after': xhr.getResponseHeader('Retry-After'),
                        },
                    });
                }
            };

            xhr.open('POST', options.url);

            xhr.send(request.body);
        });
    }

    return createTransport(options, makeRequest);
}