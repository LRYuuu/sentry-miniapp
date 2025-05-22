import { Scope, BaseTransportOptions, ClientOptions, DsnLike, Event, EventHint, Options, SeverityLevel, Client } from "@sentry/core";

import { SDK_VERSION } from "./version";
import { eventFromException, eventFromMessage } from './eventbuilder';

/**
 * All properties the report dialog supports
 */
export interface ReportDialogOptions {
    [key: string]: any;
    eventId?: string;
    dsn?: DsnLike;
    user?: {
        email?: string;
        name?: string;
    };
    lang?: string;
    title?: string;
    subtitle?: string;
    subtitle2?: string;
    labelName?: string;
    labelEmail?: string;
    labelComments?: string;
    labelClose?: string;
    labelSubmit?: string;
    errorGeneric?: string;
    errorFormEntry?: string;
    successMessage?: string;
    /** Callback after reportDialog showed up */
    onLoad?(): void;
}

export interface BaseMiniappOptions {
    /**
     * A pattern for error URLs which should not be sent to Sentry.
     * To whitelist certain errors instead, use {@link Options.whitelistUrls}.
     * By default, all errors will be sent.
     */
    blacklistUrls?: Array<string | RegExp>;

    /**
     * A pattern for error URLs which should exclusively be sent to Sentry.
     * This is the opposite of {@link Options.blacklistUrls}.
     * By default, all errors will be sent.
     */
    whitelistUrls?: Array<string | RegExp>;
}

/**
 * Configuration options for the Sentry Browser SDK.
 * @see @sentry/types Options for more information.
 */
export interface MiniappOptions extends Options<BaseTransportOptions>, BaseMiniappOptions { }

/**
 * Configuration options for the Sentry Browser SDK Client class
 * @see BrowserClient for more information.
 */
export interface MiniappClientOptions extends ClientOptions<BaseTransportOptions>, BaseMiniappOptions { }

/**
 * The Sentry Miniapp SDK Client.
 *
 * @see MiniappOptions for documentation on configuration options.
 * @see SentryClient for usage documentation.
 */
export class MiniappClient extends Client<MiniappClientOptions> {

    public eventFromException(exception: unknown, hint?: EventHint): PromiseLike<Event> {
        return eventFromException(this._options.stackParser, exception, hint, this._options.attachStacktrace);
    }

    public eventFromMessage(
        message: string,
        // eslint-disable-next-line deprecation/deprecation
        level: SeverityLevel = 'info',
        hint?: EventHint,
    ): PromiseLike<Event> {
        return eventFromMessage(this._options.stackParser, message, level, hint, this._options.attachStacktrace);
    }

    /**
     * Creates a new Miniapp SDK instance.
     *
     * @param options Configuration options for this SDK.
     */
    public constructor(options: MiniappClientOptions) {
        options._metadata = options._metadata || {};
        options._metadata.sdk = options._metadata.sdk || {
            name: 'sentry.javascript.miniapp',
            packages: [
                {
                    name: 'npm:@sentry/miniapp',
                    version: SDK_VERSION,
                },
            ],
            version: SDK_VERSION,
        };
        super(options);
    }

    /**
     * @inheritDoc
     */
    protected _prepareEvent(
        event: Event,
        hint: EventHint,
        currentScope: Scope,
        isolationScope: Scope,
    ): PromiseLike<Event | null> {
        event.platform = event.platform || 'javascript';

        return super._prepareEvent(event, hint, currentScope, isolationScope);
    }

    /**
     * Show a report dialog to the user to send feedback to a specific event.
     * 向用户显示报告对话框以将反馈发送到特定事件。---> 小程序上暂时用不到&不考虑。
     *
     * @param options Set individual options for the dialog
     */
    public showReportDialog(options: ReportDialogOptions = {}): void {
        // doesn't work without a document (React Native)
        console.log('sentry-miniapp 暂未实现该方法', options);
    }
}