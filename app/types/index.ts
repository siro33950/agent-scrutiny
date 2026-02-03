export type FolderNode = {
  type: "folder";
  name: string;
  path: string;
  children: TreeNode[];
};

export type FileNode = { type: "file"; name: string; path: string };

export type TreeNode = FolderNode | FileNode;
