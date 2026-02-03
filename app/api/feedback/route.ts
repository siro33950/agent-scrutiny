import { NextRequest, NextResponse } from "next/server";
import { loadConfig, getTargetDir, getTargetNames } from "@/lib/config";
import {
  readFeedback,
  readFeedbackResolved,
  writeFeedback,
  moveItemsToResolved,
  deleteFeedbackItems,
  unresolveItems,
  type FeedbackItem,
} from "@/lib/feedback";
import { checkOrigin } from "@/lib/api/checkOrigin";

export async function GET(request: NextRequest) {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const targetNames = getTargetNames(config);
  const targetParam = request.nextUrl.searchParams.get("target");
  const target =
    targetParam && config.targets[targetParam] ? targetParam : targetNames[0] ?? "default";
  const targetDir = getTargetDir(projectRoot, config, target);
  const items = readFeedback(targetDir);
  const resolved = readFeedbackResolved(targetDir);
  return NextResponse.json({ items: items.items, resolved: resolved.items });
}

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) {
    return NextResponse.json({ error: originError }, { status: 403 });
  }

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

  if (body && typeof body === "object" && "resolve" in body && body.resolve === true) {
    const single = asItem(body);
    if (!single) {
      return NextResponse.json(
        { error: "resolve する指摘の file_path, line_number 等を指定してください" },
        { status: 400 }
      );
    }
    const current = readFeedback(targetDir);
    const key = (i: FeedbackItem) =>
      `${i.file_path}:${i.line_number}:${i.line_number_end ?? i.line_number}`;
    const match = current.items.find((i) => key(i) === key(single));
    if (!match) {
      return NextResponse.json(
        { error: "該当する指摘が見つかりません" },
        { status: 404 }
      );
    }
    moveItemsToResolved(targetDir, [match]);
    return NextResponse.json({
      items: readFeedback(targetDir).items,
      resolved: readFeedbackResolved(targetDir).items,
    });
  }

  // DELETE: draft または resolved を完全削除（submitted は削除不可）
  if (body && typeof body === "object" && "delete" in body && (body as Record<string, unknown>).delete === true) {
    const single = asItem(body);
    if (!single) {
      return NextResponse.json(
        { error: "削除する指摘の file_path, line_number 等を指定してください" },
        { status: 400 }
      );
    }
    const key = (i: FeedbackItem) =>
      `${i.file_path}:${i.line_number}:${i.line_number_end ?? i.line_number}`;

    // まず feedback.yaml から検索
    const current = readFeedback(targetDir);
    const feedbackMatch = current.items.find((i) => key(i) === key(single));
    if (feedbackMatch) {
      if (feedbackMatch.submitted_at) {
        return NextResponse.json(
          { error: "送信済みの指摘は削除できません" },
          { status: 400 }
        );
      }
      deleteFeedbackItems(targetDir, [feedbackMatch]);
      return NextResponse.json({
        items: readFeedback(targetDir).items,
        resolved: readFeedbackResolved(targetDir).items,
      });
    }

    // feedback.yaml になければ resolved.yaml から検索
    const resolved = readFeedbackResolved(targetDir);
    const resolvedMatch = resolved.items.find((i) => key(i) === key(single));
    if (resolvedMatch) {
      deleteFeedbackItems(targetDir, [resolvedMatch], true);
      return NextResponse.json({
        items: readFeedback(targetDir).items,
        resolved: readFeedbackResolved(targetDir).items,
      });
    }

    return NextResponse.json(
      { error: "該当する指摘が見つかりません" },
      { status: 404 }
    );
  }

  // UNRESOLVE: resolved → draft に戻す
  if (body && typeof body === "object" && "unresolve" in body && (body as Record<string, unknown>).unresolve === true) {
    const single = asItem(body);
    if (!single) {
      return NextResponse.json(
        { error: "再開する指摘の file_path, line_number 等を指定してください" },
        { status: 400 }
      );
    }
    const resolved = readFeedbackResolved(targetDir);
    const key = (i: FeedbackItem) =>
      `${i.file_path}:${i.line_number}:${i.line_number_end ?? i.line_number}`;
    const match = resolved.items.find((i) => key(i) === key(single));
    if (!match) {
      return NextResponse.json(
        { error: "該当する完了済み指摘が見つかりません" },
        { status: 404 }
      );
    }
    unresolveItems(targetDir, [match]);
    return NextResponse.json({
      items: readFeedback(targetDir).items,
      resolved: readFeedbackResolved(targetDir).items,
    });
  }

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
    // submitted_at を持つアイテムを上書きする場合、submitted_at をクリアして draft に戻す
    const current = readFeedback(targetDir);
    const key = (i: FeedbackItem) =>
      `${i.file_path}:${i.line_number}:${i.line_number_end ?? i.line_number}`;
    const existingByKey = new Map(current.items.map((i) => [key(i), i]));
    const updatedParsed = parsed.map((p) => {
      const existing = existingByKey.get(key(p));
      if (existing?.submitted_at) {
        return { ...p, submitted_at: undefined };
      }
      return p;
    });
    const result = writeFeedback(targetDir, updatedParsed);
    return NextResponse.json({ items: result.items, resolved: readFeedbackResolved(targetDir).items });
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
  // submitted_at を持つアイテムの編集: submitted_at をクリアして draft に戻す
  const current = readFeedback(targetDir);
  const key = (i: FeedbackItem) =>
    `${i.file_path}:${i.line_number}:${i.line_number_end ?? i.line_number}`;
  const existing = current.items.find((i) => key(i) === key(single));
  const itemToSave = existing?.submitted_at
    ? { ...single, submitted_at: undefined }
    : single;
  const result = writeFeedback(targetDir, itemToSave);
  return NextResponse.json({ items: result.items, resolved: readFeedbackResolved(targetDir).items });
}
