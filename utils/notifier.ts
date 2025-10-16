import { ActionsBlock, HeaderBlock, SectionBlock } from "@slack/web-api";
import { LogType, SlackErr, SlackOk, TYPE_META } from "./types";

export async function sendNotificationChannel({
  title,
  details,
  link,
  type,
}: {
  title: string;
  details: string;
  link?: string;
  type: LogType;
}) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !token.startsWith("xoxb-")) {
    throw new Error(
      "Missing or invalid SLACK_BOT_TOKEN (must start with xoxb-)",
    );
  }

  const meta = TYPE_META[type] ?? TYPE_META.info;

  const baseBlocks: [HeaderBlock, SectionBlock] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${meta.emoji} ${title}` },
    },
    { type: "section", text: { type: "mrkdwn", text: details } },
  ];
  const actionBlocks: [ActionsBlock] | [] = link
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
    : [];
  const blocks = [...baseBlocks, ...actionBlocks];
  const textFallback = `${meta.prefix}: ${title} — ${details}`;

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: "C09LZ3R9MT3",
      text: textFallback,
      blocks,
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`Slack HTTP ${res.status}: ${bodyText || res.statusText}`);
  }

  const json = (await res.json()) as SlackOk | SlackErr;

  if (!json.ok) {
    const needed = json.needed ? ` (needed: ${json.needed})` : "";
    const provided = json.provided ? ` (provided: ${json.provided})` : "";
    throw new Error(`Error sending Message: ${json.error}${needed}${provided}`);
  }

  return json.ts;
}
