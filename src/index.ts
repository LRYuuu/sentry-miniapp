export {
    addEventProcessor,
    addBreadcrumb,
    captureException,
    captureEvent,
    captureMessage,
    setContext,
    setExtra,
    setExtras,
    setTag,
    setTags,
    setUser,
    withScope,
    Scope,
    Breadcrumb,
    BreadcrumbHint,
    SdkInfo,
    Event,
    EventHint,
    Exception,
    SeverityLevel,
    StackFrame,
    Stacktrace,
    Thread,
    User,
} from "@sentry/core";

export { SDK_NAME, SDK_VERSION } from "./version";
export {
    defaultIntegrations,
    init,
    lastEventId,
    showReportDialog,
    flush,
    close,
    wrap
} from "./sdk";
export { MiniappClient, ReportDialogOptions } from "./client";

import * as Integrations from "./integrations/index";
import * as Transports from "./transports/index";

export { Integrations, Transports };