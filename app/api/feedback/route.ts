import { NextRequest, NextResponse } from "next/server";
import { loadConfig, getTargetDir, getTargetNames } from "@/lib/config";
import {
  readFeedbackUnsent,
  writeFeedbackUnsent,
  type FeedbackItem,
} from "@/lib/feedback";

export async function GET(request: NextRequest) {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const targetNames = getTargetNames(config);
  const targetParam = request.nextUrl.searchParams.get("target");
  const target =
    targetParam && config.targets[targetParam] ? targetParam : targetNames[0] ?? "default";
  const targetDir = getTargetDir(projectRoot, config, target);
  const data = readFeedbackUnsent(targetDir);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const targetNames = getTargetNames(config);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストボディは JSON である必要があります" },
      { status: 400 }
    );
  }
  const bodyTarget =
    body && typeof body === "object" && "target" in body
      ? (body as { target: unknown }).target
      : undefined;
  const target =
    typeof bodyTarget === "string" && config.targets[bodyTarget]
      ? bodyTarget
      : targetNames[0] ?? "default";
  const targetDir = getTargetDir(projectRoot, config, target);

  const asItem = (x: unknown): FeedbackItem | null => {
    if (
      x &&
      typeof x === "object" &&
      "file_path" in x &&
      "comment" in x &&
      ("line_number" in x || "whole_file" in x)
    ) {
      const o = x as Record<string, unknown>;
      const isWholeFile =
        "whole_file" in o && (o.whole_file === true || o.whole_file === "true");
      let line_number: number;
      if (isWholeFile) {
        line_number = 0;
      } else {
        const rawLine = Number(o.line_number);
        if (!Number.isFinite(rawLine)) {
          return null;
        }
        line_number = rawLine;
      }
      const rawEnd =
        "line_number_end" in o && o.line_number_end != null
          ? Number(o.line_number_end)
          : undefined;
      let line_number_end: number | undefined;
      if (!isWholeFile && rawEnd !== undefined && !Number.isNaN(rawEnd)) {
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
      if (isWholeFile) {
        item.whole_file = true;
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
    const result = writeFeedbackUnsent(targetDir, parsed);
    return NextResponse.json(result);
  }

  const single = asItem(body);
  if (!single) {
    return NextResponse.json(
        {
          error:
          "リクエストボディに file_path, comment と line_number または whole_file を含めてください",
        },
      { status: 400 }
    );
  }
  const result = writeFeedbackUnsent(targetDir, single);
  return NextResponse.json(result);
}
