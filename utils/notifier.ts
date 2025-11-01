import { LogType, SlackErr, SlackOk, TYPE_META } from "./types";

export async function sendNotificationChannel({
  title,
  details,
  link,
  initiateLink,
  destinationLink,
  type,
}: {
  title: string;
  details: string;
  link?: string;
  initiateLink?: string;
  destinationLink?: string;
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
  const fieldsMap = new Map<string, string>();
  const sections: string[] = [];
  let currentSection = "";

  for (const line of detailLines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("*") && trimmedLine.includes(":*")) {
      const match = trimmedLine.match(/^\*([^:]+):\*\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        const keyLower = key.trim().toLowerCase();
        if (keyLower === "job started" || keyLower === "job finished") {
          continue;
        }
        if (value) {
          fieldsMap.set(key.trim(), value.trim());
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

  const fieldOrder = ["Action", "Reason"];
  const fields: Array<{ type: string; text: string }> = [];

  for (const fieldName of fieldOrder) {
    if (fieldsMap.has(fieldName)) {
      fields.push({
        type: "mrkdwn",
        text: `*${fieldName}:*\n${fieldsMap.get(fieldName)}`,
      });
    }
  }

  for (const [key, value] of fieldsMap.entries()) {
    if (!fieldOrder.includes(key)) {
      fields.push({
        type: "mrkdwn",
        text: `*${key}:*\n${value}`,
      });
    }
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

  if (initiateLink || destinationLink) {
    let linksText = "*Explorer Links:*\n";
    if (initiateLink) {
      linksText += `- Initiate Transaction: <${initiateLink}|View in Explorer>\n`;
    }
    if (destinationLink) {
      linksText += `- Destination Transaction: <${destinationLink}|View in Explorer>`;
    }
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: linksText,
      },
    });
  } else if (link) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${link}|View in Log Explorer>`,
      },
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
      text: `${meta.prefix}: ${title}`,
      attachments: [
        {
          color: meta.color,
          blocks: blocks,
        },
      ],
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
