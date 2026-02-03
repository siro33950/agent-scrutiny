---
name: auto-pr
description: オープンなGitHub Issueを古い順に自動処理。不明点はコメントで確認し、返信があれば実装する。
disable-model-invocation: true
---

## タスク

オープンなGitHub Issueを全て処理してください。

### ループ処理

以下を全てのオープンIssueに対して繰り返してください：

#### 1. Issue一覧取得
```bash
gh issue list --state open --sort created --order asc
```

#### 2. 各Issueの処理判定

各Issueについて以下を確認：

```bash
gh issue view [番号] --comments
```

**判定基準:**

a) **Claudeの質問コメントがあり、人間の返信がない場合**
   → スキップ（待機中）

   識別方法：コメント末尾に `*このコメントはClaude Codeによる自動確認です*` または `🤖` が含まれる

b) **Claudeの質問コメントがあり、人間の返信がある場合**
   → 返信内容を読んで実装開始

c) **コメントなし or 通常のIssue**
   - 実装方針が明確 → 実装開始
   - 不明点あり → 質問コメントを投稿してスキップ

#### 3. 不明点がある場合：質問コメント投稿

```bash
gh issue comment [番号] --body "## 🤖 実装確認

[具体的な質問や提案]

例：
- この機能はどのコンポーネントに追加すべきですか？
- A案とB案のどちらが望ましいですか？
- 既存の〇〇との整合性について確認させてください

---
*このコメントはClaude Codeによる自動確認です*"
```
→ 次のIssueへ

#### 4. 実装可能な場合：実装→PR

```bash
# ブランチ作成
git checkout main && git pull origin main
git checkout -b [fix|feat]/issue-[番号]-[簡潔な説明]
```

コードベース調査 → 実装 → テスト

```bash
# コミット・Push・PR
git add [files]
git commit -m "[type]: [description]

Closes #[番号]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push -u origin [branch-name]
gh pr create --title "[type]: [description]" --body "## Summary
- [変更内容]

Closes #[番号]

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

#### 5. 次のIssueへ

```bash
git checkout main
```

次のIssueの処理に進む。

### 終了時の報告

全Issue処理完了後、以下を報告：

- **PR作成**: 実装してPR作成したIssue（PR URLの一覧）
- **質問投稿**: 質問コメントを投稿したIssue（Issue番号と質問内容の要約）
- **スキップ**: スキップしたIssue（返信待ちのため）
