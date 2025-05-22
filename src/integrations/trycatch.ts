import { Integration, fill, GLOBAL_OBJ } from "@sentry/core";

import { wrap } from "../helpers";

/** Wrap timer functions and event targets to catch errors and provide better meta data */
export class TryCatch implements Integration {
    /** JSDoc */
    private _ignoreOnError: number = 0;

    /**
     * @inheritDoc
     */
    public name: string = TryCatch.id;

    /**
     * @inheritDoc
     */
    public static id: string = "TryCatch";

    /** JSDoc */
    private _wrapTimeFunction(original: (...args: any[]) => number): (...args: any[]) => number {
        return function (this: any, ...args: any[]): number {
            const originalCallback = args[0];
            args[0] = wrap(originalCallback, {
                mechanism: {
                    data: { function: getFunctionName(original) },
                    handled: true,
                    type: "instrument",
                },
            });
            return original.apply(this, args); // 确保返回 original 的返回值
        };

    }

    /** JSDoc */
    private _wrapRAF(original: any): (callback: () => void) => any {
        return function (this: any, callback: () => void): () => void {
            return original(
                wrap(callback, {
                    mechanism: {
                        data: {
                            function: "requestAnimationFrame",
                            handler: getFunctionName(original)
                        },
                        handled: true,
                        type: "instrument"
                    }
                })
            );
        };
    }

    /** JSDoc */
    private _wrapEventTarget(target: string): void {
        const global = GLOBAL_OBJ as { [key: string]: any };
        const proto = global[target] && global[target].prototype;

        if (!proto || !proto.hasOwnProperty || !proto.hasOwnProperty("addEventListener")) {
            return;
        }

        // 修复 addEventListener 的类型签名
        fill(proto, "addEventListener", function (
            original: (event: string, handler: EventListener | EventListenerObject, options?: boolean | AddEventListenerOptions) => void
        ) {
            return function (this: any, eventName: string, fn: EventListenerObject, options?: boolean | AddEventListenerOptions): void {
                try {
                    if (typeof fn.handleEvent === "function") {
                        fn.handleEvent = wrap(fn.handleEvent.bind(fn), {
                            mechanism: {
                                data: {
                                    function: "handleEvent",
                                    handler: getFunctionName(fn),
                                    target,
                                },
                                handled: true,
                                type: "instrument",
                            },
                        });
                    }
                } catch (err) {
                    // 忽略权限错误等异常
                }

                return original.call(
                    this,
                    eventName,
                    wrap(fn, {
                        mechanism: {
                            data: {
                                function: "addEventListener",
                                handler: getFunctionName(fn),
                                target,
                            },
                            handled: true,
                            type: "instrument",
                        },
                    }),
                    options
                );
            };
        });

        // 修复 removeEventListener 的类型签名
        fill(proto, "removeEventListener", function (
            original: (
                eventName: string,
                handler: EventListener | EventListenerObject,
                options?: boolean | EventListenerOptions
            ) => void
        ) {
            return function (
                this: any,
                eventName: string,
                fn: EventListener | EventListenerObject,
                options?: boolean | EventListenerOptions
            ): void {
                let callback: EventListener | EventListenerObject = fn;

                try {
                    // 如果 fn 是 EventListenerObject 类型，处理它的 handleEvent 方法
                    if (typeof (fn as EventListenerObject).handleEvent === "function") {
                        const objectHandler = fn as EventListenerObject;
                        objectHandler.handleEvent = objectHandler.handleEvent && (objectHandler.handleEvent as any).__sentry_wrapped__;
                        callback = objectHandler; // 使用处理后的 EventListenerObject
                    } else {
                        // 如果 fn 是普通函数（EventListener）
                        callback = fn && ((fn as any).__sentry_wrapped__ || fn);
                    }
                } catch (e) {
                    // 忽略环境相关错误
                }

                // 调用原始的 removeEventListener 方法
                return original.call(this, eventName, callback, options);
            };
        });
    }

    /**
     * Wrap timer functions and event targets to catch errors
     * and provide better metadata.
     */
    public setupOnce(): void {
        this._ignoreOnError = this._ignoreOnError;

        const global = GLOBAL_OBJ;

        fill(global, "setTimeout", this._wrapTimeFunction.bind(this));
        fill(global, "setInterval", this._wrapTimeFunction.bind(this));
        fill(global, "requestAnimationFrame", this._wrapRAF.bind(this));

        [
            "EventTarget",
            "Window",
            "Node",
            "ApplicationCache",
            "AudioTrackList",
            "ChannelMergerNode",
            "CryptoOperation",
            "EventSource",
            "FileReader",
            "HTMLUnknownElement",
            "IDBDatabase",
            "IDBRequest",
            "IDBTransaction",
            "KeyOperation",
            "MediaController",
            "MessagePort",
            "ModalWindow",
            "Notification",
            "SVGElementInstance",
            "Screen",
            "TextTrack",
            "TextTrackCue",
            "TextTrackList",
            "WebSocket",
            "WebSocketWorker",
            "Worker",
            "XMLHttpRequest",
            "XMLHttpRequestEventTarget",
            "XMLHttpRequestUpload"
        ].forEach(this._wrapEventTarget.bind(this));
    }
}

/**
 * Safely extract function name from itself
 */
function getFunctionName(fn: any): string {
    try {
        return (fn && fn.name) || "<anonymous>";
    } catch (e) {
        // Just accessing custom props in some Selenium environments
        // can cause a "Permission denied" exception (see raven-js#495).
        return "<anonymous>";
    }
}