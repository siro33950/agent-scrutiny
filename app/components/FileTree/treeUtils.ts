import type { TreeNode, FolderNode } from "@/app/types";

export function buildTree(paths: string[]): TreeNode[] {
  const root: FolderNode = { type: "folder", name: "", path: "", children: [] };
  for (const path of paths) {
    const parts = path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const folderPath = parts.slice(0, i + 1).join("/");
      if (isLast) {
        current.children.push({ type: "file", name: part, path });
      } else {
        let child = current.children.find(
          (c): c is FolderNode => c.type === "folder" && c.path === folderPath
        );
        if (!child) {
          child = { type: "folder", name: part, path: folderPath, children: [] };
          current.children.push(child);
        }
        current = child;
      }
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const aIsFolder = a.type === "folder";
      const bIsFolder = b.type === "folder";
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    nodes.forEach((n) => {
      if (n.type === "folder") sortNodes(n.children);
    });
  };
  sortNodes(root.children);
  return root.children;
}

export function collectFolderPaths(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.type === "folder") {
      out.push(n.path);
      out.push(...collectFolderPaths(n.children));
    }
  }
  return out;
}

export function getFolderState(
  node: FolderNode,
  modifiedSet: Set<string>,
  untrackedSet: Set<string>
): "modified" | "untracked" | "clean" {
  let hasModified = false;
  let hasUntracked = false;
  const visit = (n: TreeNode) => {
    if (n.type === "folder") {
      n.children.forEach(visit);
    } else {
      if (modifiedSet.has(n.path)) hasModified = true;
      else if (untrackedSet.has(n.path)) hasUntracked = true;
    }
  };
  visit(node);
  if (hasModified) return "modified";
  if (hasUntracked) return "untracked";
  return "clean";
}

export function getFileTypeIcon(filePath: string): string {
  const name = filePath.split("/").pop() ?? "";
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  if (name.endsWith(".tsx") || name.endsWith(".ts")) return "TS";
  if (name.endsWith(".jsx") || name.endsWith(".mjs") || ext === "js") return "JS";
  if (ext === "json") return "{}";
  if (ext === "css") return "#";
  if (ext === "sh") return "$";
  if (ext === "md") return "MD";
  if (name === ".gitignore") return "◇";
  if (ext === "yaml" || ext === "yml") return "Y";
  return "◇";
}
