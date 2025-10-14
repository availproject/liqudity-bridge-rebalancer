import { WebClient, LogLevel } from "@slack/web-api";
import { LogType, TYPE_META } from "./types";

const slackToken = process.env.SLACK_BOT_TOKEN;

export const slack = new WebClient(slackToken, {
  logLevel: process.env.CONFIG === "Mainnet" ? LogLevel.ERROR : LogLevel.INFO,
});

export async function sendDmToUser(userId: string, text: string) {
  try {
    const open = await slack.conversations.open({ users: userId });
    const imChannelId = open.channel?.id;
    if (!imChannelId) {
      throw new Error("Failed to open DM channel");
    }

    const res = await slack.chat.postMessage({
      channel: imChannelId,
      text,
    });
    return res.ts;
  } catch (err) {
    console.error("Slack sendDmToUser error:", err);
    throw err;
  }
}

export async function sendNotificationChannel(
  channelId: string,
  title: string,
  details: string,
  link?: string,
  type: LogType = "info",
) {
  const meta = TYPE_META[type] ?? TYPE_META.info;

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `${meta.emoji} ${title}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: details },
    },
    ...(link
      ? [
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "View Details" },
                url: link,
                style: meta.buttonStyle,
              },
            ],
          },
        ]
      : []),
  ];

  const textFallback = `${meta.prefix}: ${title} — ${details}`;

  try {
    const res = await slack.chat.postMessage({
      channel: channelId,
      text: textFallback,
      blocks,
    });
    return res.ts;
  } catch (err) {
    console.error("Slack sendNotificationChannel error:", err);
    throw err;
  }
}
