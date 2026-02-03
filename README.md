# AgentScrutiny

CLI ベースの AI コーディングエージェント（Aider, Claude Code 等）と人間との共同作業を最適化する**ローカル専用レビューツール**です。AI が生成したコードの差分をブラウザ上で GitHub PR 風に確認し、行ごとのフィードバックを `.scrutiny/feedback.yaml` に保存し、Tmux 経由でターミナルの AI に修正指示を送る「密結合ループ」を実現します。

## 密結合ワークフロー

1. **CLI:** 開発者がターミナルで AI に指示を出す。
2. **Web UI:** AI が書き換えたコードの差分をブラウザで精査（Scrutiny）する。
3. **Feedback:** ブラウザで差分にフィードバックを入力し、`.scrutiny/feedback.yaml` に保存する。
4. **Action:** ブラウザの「Submit to Agent」ボタンで、Tmux を介してターミナルの AI に修正命令を送信する。

## セットアップ

```bash
npm install
./scripts/bootstrap.sh
```

`bootstrap.sh` は `.scrutiny` ディレクトリを作成し、`config.json.example` を `config.json` にコピー（未存在時）、`scripts/*.sh` に実行権限を付与します。**実際の設定ファイルは .gitignore されているため、初回は bootstrap の実行か手動で `config.json` を用意してください。**

```bash
# 手動で行う場合
cp config.json.example config.json
# 必要に応じて config.json を編集
```

`config.json` で以下を設定します（未設定時は環境変数または `process.cwd()` にフォールバック）。

| キー           | 説明                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `targetDir`    | レビュー対象の Git リポジトリの絶対パス。`git diff HEAD` をこのディレクトリで実行する。                                                 |
| `tmuxSession`  | Submit 時にコマンドを送る tmux セッション名。既定: `scrutiny`。                                                                         |
| `agentCommand` | `start-scrutiny.sh` 実行時に agent セッション（`<tmuxSession>-agent`）で自動起動するコマンド（例: `aider`）。未設定時は何も起動しない。 |
| `hooks`        | Submit前後に実行するコマンドの設定。詳細は下記参照。                                                                                    |

環境変数（任意）:

- `AGENT_SCRUTINY_TARGET_DIR` — `targetDir` のフォールバック。
- `AGENT_SCRUTINY_TMUX_SESSION` — `tmuxSession` のフォールバック。

例:

```json
{
  "targetDir": "/path/to/your/repo",
  "tmuxSession": "scrutiny",
  "agentCommand": "agent",
  "hooks": {
    "preSubmit": ["npm run lint"],
    "postSubmit": ["echo 'Done!'"]
  }
}
```

### Hooks

`hooks` でSubmit前後に任意のコマンドを実行できます。

| キー         | 説明                                           |
| ------------ | ---------------------------------------------- |
| `preSubmit`  | Submit前に実行するコマンドの配列。順番に実行。 |
| `postSubmit` | Submit後に実行するコマンドの配列。順番に実行。 |

コマンドは対象の `targetDir` をカレントディレクトリとして実行されます。`preSubmit` でエラー（終了コード非0）が発生した場合、Submitは中断されます。

## 使い方

1. **差分確認:** `npm run dev` で起動し、ブラウザで [http://localhost:3000](http://localhost:3000) を開く。`targetDir` の `git diff HEAD` が Side-by-Side で表示される。
2. **コメント追加:** 行番号をクリックし、コメントを入力して「保存」する。`.scrutiny/feedback.yaml` に追記される。
3. **Submit to Agent:** 「Submit to Agent」を押すと、feedback の内容が要約された指示文が、tmux の **agent セッション**（`scrutiny-agent` 等）に送られ、Enter が押される。そのセッションで Aider 等の AI エージェントを起動しておけば、指示がそのまま入力される。

## 起動（tmux で 2 セッション）

**`scripts/start-scrutiny.sh`** を 1 回実行すると、tmux セッションが **2 つ**立つ。既存の同名セッションがあれば自動で kill して作り直す。**スクリプトは tmux にアタッチしない**。実行後、用途に応じて **手動で** アタッチする。

- **`<tmuxSession>-dev`**（既定: `scrutiny-dev`）: `npm run dev` が自動実行される。ブラウザで [http://localhost:3000](http://localhost:3000) を開く。
- **`<tmuxSession>-agent`**（既定: `scrutiny-agent`）: `agentCommand` が設定されていればそのコマンドが自動実行される。**Submit はこのセッションに送られる。**

```bash
./scripts/start-scrutiny.sh
# 次のステップとして、用途に応じてアタッチ:
tmux attach-session -t scrutiny-dev   # dev サーバーのログを見る
tmux attach-session -t scrutiny-agent # エージェントに指示を送る（Submit の送信先）
```

初回は `./scripts/bootstrap.sh` で `config.json` と scripts の実行権限を用意しておいてください。

## 注意事項

- **ローカル専用:** 認証は想定していません。ネットワークに公開する場合は別途対策が必要です。
- **.scrutiny の位置:** 差分は各 target（作業ディレクトリ）の Git リポジトリで取得し、`.scrutiny/feedback.yaml`（有効な指摘）および `feedback-resolved.yaml`（完了済み履歴）は **各 target の作業ディレクトリ直下** に作成されます。target を切り替えると、その target 用の feedback だけが表示・編集されます。（`.ai/` は廃止されています。）

## 技術スタック

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **Diff:** react-diff-viewer-continued
- **Data:** YAML (js-yaml)、config (JSON)
- **Integration:** Node.js child_process（Git / Tmux）

## ライセンス

[MIT](LICENSE)
