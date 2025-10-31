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

  const detailLines = details.split("\n").filter((line) => line.trim());
  const fields: Array<{ type: string; text: string }> = [];
  const sections: string[] = [];
  let currentSection = "";

  for (const line of detailLines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("*") && trimmedLine.includes(":*")) {
      const match = trimmedLine.match(/^\*([^:]+):\*\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        if (value) {
          fields.push({
            type: "mrkdwn",
            text: `*${key.trim()}:*\n${value.trim()}`,
          });
        } else {
          if (currentSection) {
            sections.push(currentSection.trim());
          }
          currentSection = `*${key.trim()}:*\n`;
        }
      }
    } else if (trimmedLine.startsWith("-") || trimmedLine) {
      currentSection += trimmedLine + "\n";
    }
  }

  if (currentSection) {
    sections.push(currentSection.trim());
  }

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${title} ${meta.emoji} `,
        emoji: true,
      },
    },
    { type: "divider" },
  ];

  if (fields.length > 0) {
    blocks.push({
      type: "section",
      fields: fields,
    });
  }

  for (const section of sections) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: section },
    });
  }

  if (link) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Details", emoji: true },
          url: link,
          style: meta.buttonStyle,
        },
      ],
    });
  }

  blocks.push(
    { type: "divider" },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `⏰ ${new Date().toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}`,
        },
      ],
    },
  );

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
