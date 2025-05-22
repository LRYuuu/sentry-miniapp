import { addEventProcessor, getClient, Event, Integration } from "@sentry/core";

import { appName, sdk } from "../crossPlatform";

/**
 * IgnoreMpcrawlerErrors
 *
 * https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/sitemap.html
 */
export class IgnoreMpcrawlerErrors implements Integration {
    /**
     * @inheritDoc
     */
    public static id: string = "IgnoreMpcrawlerErrors";
    /**
     * @inheritDoc
     */
    public name: string = IgnoreMpcrawlerErrors.id;

    /**
     * @inheritDoc
     */
    public setupOnce(): void {
        addEventProcessor((event: Event) => {
            if (
                getClient()?.getIntegrationByName(IgnoreMpcrawlerErrors.id) &&
                appName === "wechat" &&
                sdk.getLaunchOptionsSync
            ) {
                const options = sdk.getLaunchOptionsSync();

                if (options.scene === 1129) {
                    return null;
                }
            }

            return event;
        });
    }
}