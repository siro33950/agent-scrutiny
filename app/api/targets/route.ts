import { NextResponse } from "next/server";
import { loadConfig, getTargetNames } from "@/lib/config";

export async function GET() {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const targets = getTargetNames(config);
  const defaultTarget = targets[0] ?? "default";
  return NextResponse.json({ targets, defaultTarget });
}
