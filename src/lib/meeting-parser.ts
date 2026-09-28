export interface ParsedMeeting {
  title: string;
  participants: string[];
  summary: string;
  topics: string[];
  decisions: string[];
  actions: string[];
  speakerBlocks: Array<{ speaker: string; text: string }>;
  sections: Array<{ heading: string; body: string }>;
}

const PARTICIPANT_HINTS =
  /участник|присутств|спикер|speaker|people|команда/i;
const SUMMARY_HINTS = /резюме|summary|итог|кратк|обзор|о чём/i;
const TOPIC_HINTS = /тем[аы]|topic|обсужд|повестк|agenda/i;
const DECISION_HINTS = /решени|договорён|договорил|decision/i;
const ACTION_HINTS =
  /задач|action|следующ|to[\s-]?do|поручен|ответственн|сделать/i;

function splitSections(markdown: string): Array<{ heading: string; body: string }> {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<{ heading: string; body: string }> = [];
  let current = { heading: "Вступление", body: "" };

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)$/) || line.match(/^\*\*(.+?)\*\*\s*$/);
    if (heading) {
      if (current.body.trim()) sections.push(current);
      current = { heading: heading[1].trim(), body: "" };
    } else {
      current.body += `${line}\n`;
    }
  }
  if (current.body.trim()) sections.push(current);
  return sections;
}

function extractListItems(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((l) => l.length > 2 && !l.startsWith("#"));
}

function extractInlineParticipants(text: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /(?:участник\w*|присутств\w*|спикер\w*)[:\s—-]+([^\n]+)/gi,
    /\*\*([А-ЯA-Z][а-яa-zёЁ-]+(?:\s+[А-ЯA-Z][а-яa-zёЁ-]+)?)\*\*/g,
    /^([А-ЯA-Z][а-яa-zёЁ-]{2,})[:：]/gm,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const chunk = m[1];
      chunk
        .split(/[,，;/|и]+/)
        .map((p) => p.trim().replace(/^[@#]/, ""))
        .filter((p) => /^[А-ЯA-Z][а-яa-zёЁ-]{2,}(?:\s+[А-ЯA-Z][а-яa-zёЁ-]+)?$/.test(p))
        .forEach((p) => names.add(p));
    }
  }
  return [...names];
}

function extractSpeakerBlocks(
  text: string,
): Array<{ speaker: string; text: string }> {
  const blocks: Array<{ speaker: string; text: string }> = [];
  const re =
    /(?:^|\n)\s*(?:\*\*)?([А-ЯA-Z][а-яa-zёЁ-]{2,}(?:\s+[А-ЯA-Z][а-яa-zёЁ-]+)?)(?:\*\*)?\s*[:：]\s*([^\n]+(?:\n(?!\s*(?:\*\*)?[А-ЯA-Z][а-яa-zёЁ-].*[:：])[^\n]+)*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const speaker = m[1].trim();
    const speech = m[2].trim();
    if (speech.length < 8) continue;
    if (/резюме|итог|тема|задач|решени/i.test(speaker)) continue;
    blocks.push({ speaker, text: speech });
  }
  return blocks;
}

export function parseMeetingMarkdown(
  markdown: string,
  fallbackTitle = "Запись встречи",
): ParsedMeeting {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() || fallbackTitle;
  const sections = splitSections(markdown);

  const participants = new Set<string>(extractInlineParticipants(markdown));
  const topics: string[] = [];
  const decisions: string[] = [];
  const actions: string[] = [];
  let summary = "";

  for (const section of sections) {
    const h = section.heading;
    const items = extractListItems(section.body);
    if (PARTICIPANT_HINTS.test(h)) {
      items.forEach((i) => {
        const name = i.split(/[—–\-:(]/)[0]?.trim();
        if (name && name.length < 40) participants.add(name);
      });
    } else if (SUMMARY_HINTS.test(h)) {
      summary = section.body.trim() || items.join(" ");
    } else if (TOPIC_HINTS.test(h)) {
      topics.push(...(items.length ? items : [section.body.trim()]).filter(Boolean));
    } else if (DECISION_HINTS.test(h)) {
      decisions.push(...(items.length ? items : [section.body.trim()]).filter(Boolean));
    } else if (ACTION_HINTS.test(h)) {
      actions.push(...(items.length ? items : [section.body.trim()]).filter(Boolean));
    }
  }

  if (!summary) {
    const first = sections.find((s) => s.body.trim().length > 40);
    summary = first?.body.trim().slice(0, 600) || markdown.slice(0, 600);
  }

  const speakerBlocks = extractSpeakerBlocks(markdown);
  for (const b of speakerBlocks) participants.add(b.speaker);

  return {
    title,
    participants: [...participants],
    summary,
    topics,
    decisions,
    actions,
    speakerBlocks,
    sections,
  };
}
