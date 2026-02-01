import { NextRequest, NextResponse } from "next/server";
import {
  readFeedbackUnsent,
  writeFeedbackUnsent,
  type FeedbackItem,
} from "@/lib/feedback";

export async function GET() {
  const projectRoot = process.cwd();
  const data = readFeedbackUnsent(projectRoot);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const projectRoot = process.cwd();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストボディは JSON である必要があります" },
      { status: 400 }
    );
  }

  const asItem = (x: unknown): FeedbackItem | null => {
    if (
      x &&
      typeof x === "object" &&
      "file_path" in x &&
      "line_number" in x &&
      "comment" in x
    ) {
      const o = x as Record<string, unknown>;
      let line_number = Number(o.line_number);
      const rawEnd =
        "line_number_end" in o && o.line_number_end != null
          ? Number(o.line_number_end)
          : undefined;
      let line_number_end: number | undefined;
      if (rawEnd !== undefined && !Number.isNaN(rawEnd)) {
        if (line_number > rawEnd) {
          [line_number, line_number_end] = [rawEnd, line_number];
        } else {
          line_number_end = rawEnd;
        }
        if (line_number_end === line_number) {
          line_number_end = undefined;
        }
      }
      const item: FeedbackItem = {
        file_path: String(o.file_path),
        line_number,
        comment: String(o.comment),
      };
      if (line_number_end !== undefined) {
        item.line_number_end = line_number_end;
      }
      return item;
    }
    return null;
  };

  if (body && typeof body === "object" && "items" in body) {
    const items = (body as { items: unknown[] }).items;
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "items は配列である必要があります" },
        { status: 400 }
      );
    }
    const parsed = items.map(asItem).filter((x): x is FeedbackItem => x !== null);
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "有効なフィードバックがありません" },
        { status: 400 }
      );
    }
    const result = writeFeedbackUnsent(projectRoot, parsed);
    return NextResponse.json(result);
  }

  const single = asItem(body);
  if (!single) {
    return NextResponse.json(
      {
        error:
          "リクエストボディに file_path, line_number, comment を含めてください",
      },
      { status: 400 }
    );
  }
  const result = writeFeedbackUnsent(projectRoot, single);
  return NextResponse.json(result);
}
