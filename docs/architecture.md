# アーキテクチャ詳細

## 命名規則

### ファイル・ディレクトリ名
- **ディレクトリ**: `kebab-case` (例: `comment-sorter`, `task-manager`)
- **TypeScriptファイル**: `kebab-case` (例: `comment-sorter-feature.tsx`, `feature-manager.ts`)
- **インデックスファイル**: `index.ts` または `index.tsx`

### コード内の命名
- **クラス名**: `PascalCase` (例: `CommentSorterFeature`, `FeatureManager`)
- **機能ID**: `kebab-case` (例: `'comment-sorter'`, `'task-manager'`)
- **機能表示名**: `Title Case` (例: `'Comment Sorter'`, `'Task Manager'`)
- **ログプレフィックス**: `[PascalCase]` 空白なし (例: `[CommentSorter]`, `[TaskManager]`)

### 例
```typescript
// ファイル: src/features/comment-sorter/comment-sorter-feature.tsx
export class CommentSorterFeature extends BaseFeature {
  // クラス名: PascalCase
}

// 登録時
{
  id: 'comment-sorter',        // kebab-case
  name: 'Comment Sorter',       // Title Case
  // ログ出力: [CommentSorter]  // PascalCase、空白なし
}
```

## プラグインアーキテクチャ（v3.0新規）

### コア機能管理システム
- **core/**: 機能管理の中枢システム
  - `FeatureManager`: 機能の動的な登録・管理
  - `FeatureRegistry`: 機能のレジストリ管理
  - `BaseFeature`: 全機能が継承する抽象基底クラス
- **features/**: 独立した機能プラグイン
  - 各機能が独立したディレクトリとして実装
  - 機能間の依存関係を最小限に
  - 新機能の追加が簡単

### 機能プラグインの特徴
- **Feature Manager**: 機能の動的な登録・管理・有効化/無効化
- **Feature Registry**: プラグイン機能のレジストリ管理
- **リソーストラッカー**: メモリリークを防ぐ自動リソース管理
- **独立した機能開発**: 各機能が独立したプラグインとして開発可能

## 三層アーキテクチャ

プロジェクトは以下の3つの明確な層で構成されています：

### 1. Scripts Layer (`src/scripts/`)
- Chrome拡張機能の核となる処理
- Service Worker とContent Scriptの分離
- 適切な拡張子使用（.ts/.tsx）

### 2. UI Layer (`src/ui/`)
- ユーザーインターフェースの完全な統合
- コンポーネント・ベース設計
- レスポンシブでアクセシブルなUI

### 3. Shared Layer (`src/shared/`)
- プロジェクト横断的な共有リソース
- 定数・型定義・ユーティリティの体系化
- 一貫したエクスポート戦略

## 定数管理システム

### 従来の課題
- 単一ファイルによる肥大化と可読性の低下
- 関係性が不明確な定数群の混在
- インポート時の不要な依存関係

### 新しい分類システム
- **storage.ts**: データ永続化関連（STORAGE_KEYS, DEFAULT_SETTINGS等）
- **messages.ts**: 通信プロトコル関連（MESSAGE_ACTIONS, POST_MESSAGE_TYPES等）
- **dom.ts**: DOM操作関連（セレクター, ID, クラス, URL パターン等）
- **ui.ts**: ユーザーインターフェース関連（ラベル, 順序, タイミング等）

### メリット
- **認知負荷の軽減**: 関連する定数のグループ化
- **インポートの最適化**: 必要な部分のみの選択的インポート
- **型安全性の向上**: 関連する型と定数の近接配置

## コンポーネント設計

### ファイル・コロケーション戦略
```
sort-toggle-button/
├── index.tsx      # メインコンポーネント
├── types.ts       # 専用型定義
└── styles.css     # 専用スタイル
```

### 利点
- **関連性の可視化**: 1つのフォルダ内に関連するすべてのファイル
- **再利用性**: 独立したコンポーネント単位での移植・共有
- **保守性**: 変更時の影響範囲の明確化
- **型安全性**: コンポーネント固有の型定義による厳密なチェック

## スケーラブルな構造設計

### 設計原則
- **論理的分割**: 機能別・関心別の明確な境界線
- **コロケーション**: 関連ファイルの物理的な近接配置
- **拡張性**: 新機能追加に対応できる柔軟な構造
- **保守性**: 依存関係の可視化と最小化

## ユーティリティシステム

### ロガーシステム
- **統一ログ形式**: タイムスタンプとプレフィックス付きの構造化ログ
- **ログレベル制御**: DEBUG/INFO/WARN/ERROR の4段階
- **環境別設定**: 本番環境では WARN 以上のみを出力
- **自動ロガー作成**: BaseFeatureが機能名から自動的にロガーを生成
- **ゼロ設定**: 機能開発者はロガー設定を意識する必要なし

### 拡張ポイント
- **index.ts**: 各層での適切なエクスポート管理
- **将来の拡張**: utils/フォルダ等、成長に対応できる構造
- **保守性**: 関連ファイルの物理的な近接配置