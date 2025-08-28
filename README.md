# Backlog Comment Sorter

Backlogの課題ページにコメントのソート切り替えボタンを追加するChrome拡張機能です。React + Vite + TypeScriptで実装されています。

## 機能

- Backlogの課題ページに「古い順/新しい順」切り替えボタンを自動追加
- 現在の並び順を自動判別し、適切なボタンラベルを表示
- ワンクリックでコメントの並び順を切り替え可能
- 過去のコメントがある場合は自動的に展開
- 拡張機能のオン/オフ切り替え機能（ポップアップUI）
- 設定の永続保存（Chrome Storage API）
- リロード不要で即座に反映される動的な有効/無効切り替え
- Chrome、Microsoft Edgeなど、Chromiumベースのブラウザで動作

## 開発環境のセットアップ

### 必要な環境
- Node.js (v18以上推奨)
- npm

### インストール手順

1. このリポジトリをクローンします
```bash
git clone https://github.com/yourusername/backlog-comment-sorter.git
cd backlog-comment-sorter
```

2. 依存関係をインストールします
```bash
npm install
```

3. 拡張機能をビルドします
```bash
npm run build
```

### 開発時のコマンド

```bash
# 拡張機能をビルド
npm run build

# 開発サーバーを起動（ホットリロード）
npm run dev

# コードのリント
npm run lint

# プレビューサーバーを起動
npm run preview
```

## Chrome拡張機能としてのインストール方法

1. `npm run build`でビルドを実行します

2. Chrome（またはEdge）で、アドレスバーに `chrome://extensions` と入力して拡張機能管理ページを開きます

3. ページの右上にある「デベロッパー モード」のスイッチをオンにします

4. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリックします

5. ファイル選択ダイアログで、ビルドされた`dist/`フォルダを選択します

6. 拡張機能が読み込まれ、一覧に「Backlog Comment Sorter」が表示されます

## 使い方

### コメントソート機能

1. 拡張機能をインストール後、Backlogの課題ページ（`/view/`を含むURL）にアクセスします

2. ページ上部のフィルターナビゲーションエリアに「古い順で表示」または「新しい順で表示」ボタンが自動的に追加されます

3. ボタンをクリックすることで、コメントの並び順を切り替えることができます

### 拡張機能のオン/オフ切り替え

1. ブラウザのツールバーにある拡張機能アイコンをクリックします

2. ポップアップウィンドウが開き、トグルスイッチが表示されます

3. トグルスイッチをクリックして拡張機能の有効/無効を切り替えます
   - 有効時：Backlogページにソートボタンが表示されます
   - 無効時：ソートボタンが非表示になります

4. 設定は自動的に保存され、ページのリロードは不要です

## プロジェクト構成

```
backlog-comment-sorter/
├── src/
│   ├── background/
│   │   └── index.tsx       # バックグラウンドサービスワーカー
│   ├── content/
│   │   └── index.tsx       # コメントソート機能のメインスクリプト
│   └── popup/
│       ├── index.tsx       # ポップアップUIのReactコンポーネント
│       ├── popup.css       # ポップアップUIのスタイル
│       └── popup.html      # ポップアップUIのHTML
├── manifest.json           # Chrome拡張機能マニフェスト
├── vite.config.ts          # Vite設定
├── tsconfig.json           # TypeScript基本設定
├── tsconfig.app.json       # アプリケーション用TypeScript設定
├── tsconfig.node.json      # Node.js用TypeScript設定
├── eslint.config.js        # ESLint設定
├── package.json            # プロジェクト設定と依存関係
├── .gitignore             # Git除外ファイル
└── README.md              # このファイル
```

## 技術スタック

- **React**: UIコンポーネントの構築
- **TypeScript**: 型安全性を確保したJavaScript開発
- **Vite**: 高速なビルドツールとバンドラー
- **@crxjs/vite-plugin**: Vite用Chrome拡張機能開発プラグイン
- **Chrome Extension Manifest V3**: 最新の拡張機能仕様に準拠
- **Chrome Storage API**: 拡張機能の設定を永続的に保存
- **Service Worker**: バックグラウンドでの状態管理
- **ESLint**: コード品質の維持

## 対応サイト

- `https://*.backlog.jp/view/*`
- `https://*.backlog.com/view/*`

## ライセンス

MIT License