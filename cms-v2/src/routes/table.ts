import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';

const router = Router();

type ExtractedTag = { text: string; color: string };
type ExtractedCell = { title: string; text: string; tags: ExtractedTag[]; button: { text: string; url: string } };
type ExtractedTable = {
  showHeader: boolean;
  headerBg?: string;
  headerText?: string;
  textColor?: string;
  mutedColor?: string;
  buttonBg?: string;
  buttonText?: string;
  columnWidths: number[];
  rows: ExtractedCell[][];
};

const MAX_IMAGE_B64 = 8 * 1024 * 1024;

function hex(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTable(raw: any): ExtractedTable {
  const sourceRows = Array.isArray(raw?.rows) && raw.rows.length ? raw.rows : [[{}]];
  const colCount = Math.max(1, Math.min(12, Math.max(
    Array.isArray(raw?.columnWidths) ? raw.columnWidths.length : 0,
    ...sourceRows.map((row: any[]) => Array.isArray(row) ? row.length : 0),
  )));

  const rows = sourceRows.slice(0, 40).map((row: any[]) => {
    const cells = Array.isArray(row) ? row : [];
    const next: ExtractedCell[] = [];
    for (let i = 0; i < colCount; i += 1) {
      const cell = cells[i] || {};
      next.push({
        title: text(cell.title),
        text: text(cell.text),
        tags: Array.isArray(cell.tags)
          ? cell.tags.slice(0, 8).map((tag: any) => ({ text: text(tag.text), color: hex(tag.color, '#5b3fc8') })).filter((tag: ExtractedTag) => tag.text)
          : [],
        button: {
          text: text(cell.button?.text),
          url: text(cell.button?.url),
        },
      });
    }
    return next;
  });

  const widths = Array.isArray(raw?.columnWidths)
    ? raw.columnWidths.slice(0, colCount).map((width: unknown) => Number(width)).filter((width: number) => Number.isFinite(width) && width > 0)
    : [];
  while (widths.length < colCount) widths.push(100 / colCount);

  return {
    showHeader: raw?.showHeader !== false,
    headerBg: hex(raw?.headerBg, '#0f1e3c'),
    headerText: hex(raw?.headerText, '#ffffff'),
    textColor: hex(raw?.textColor, '#1a2438'),
    mutedColor: hex(raw?.mutedColor, '#6b7689'),
    buttonBg: hex(raw?.buttonBg, '#0f1e3c'),
    buttonText: hex(raw?.buttonText, '#ffffff'),
    columnWidths: widths,
    rows,
  };
}

function parseResponseText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

router.use(authGuard, requireRole('admin', 'editor'));

router.post('/extract-image', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: 'OPENAI_API_KEY is not configured on the CMS API.' });
    }

    const { data, contentType } = req.body || {};
    if (typeof data !== 'string' || !data) {
      return res.status(400).json({ ok: false, error: 'Image data is required.' });
    }
    if (data.length > MAX_IMAGE_B64) {
      return res.status(400).json({ ok: false, error: 'Image is too large. Please upload a smaller/compressed screenshot.' });
    }

    const imageType = typeof contentType === 'string' && contentType.startsWith('image/') ? contentType : 'image/png';
    const imageUrl = `data:${imageType};base64,${data}`;
    const model = process.env.OPENAI_TABLE_MODEL || 'gpt-4.1-mini';

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: [
                  'Extract the table from this image for a CMS table builder.',
                  'Return only JSON that matches the schema.',
                  'Rules:',
                  '- Preserve visible row and column order.',
                  '- Put the main bold/primary line in each cell as title.',
                  '- Put supporting copy/date/tutor/details in text.',
                  '- Put pill/badge labels in tags with approximate hex colors.',
                  '- Use button.text for visible CTA buttons, leave button.url empty.',
                  '- Set showHeader true when the first row is a column header.',
                  '- Estimate columnWidths as percentages.',
                ].join('\n'),
              },
              { type: 'input_image', image_url: imageUrl },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'cms_table_autofill',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                showHeader: { type: 'boolean' },
                headerBg: { type: 'string' },
                headerText: { type: 'string' },
                textColor: { type: 'string' },
                mutedColor: { type: 'string' },
                buttonBg: { type: 'string' },
                buttonText: { type: 'string' },
                columnWidths: { type: 'array', items: { type: 'number' } },
                rows: {
                  type: 'array',
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        title: { type: 'string' },
                        text: { type: 'string' },
                        tags: {
                          type: 'array',
                          items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              text: { type: 'string' },
                              color: { type: 'string' },
                            },
                            required: ['text', 'color'],
                          },
                        },
                        button: {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            text: { type: 'string' },
                            url: { type: 'string' },
                          },
                          required: ['text', 'url'],
                        },
                      },
                      required: ['title', 'text', 'tags', 'button'],
                    },
                  },
                },
              },
              required: ['showHeader', 'headerBg', 'headerText', 'textColor', 'mutedColor', 'buttonBg', 'buttonText', 'columnWidths', 'rows'],
            },
          },
        },
        max_output_tokens: 8000,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || `OpenAI request failed (${response.status})`;
      return res.status(502).json({ ok: false, error: message });
    }

    const outputText = parseResponseText(payload);
    const extracted = normalizeTable(JSON.parse(outputText));
    return res.json({ ok: true, data: extracted });
  } catch (err) {
    next(err);
  }
});

export default router;
