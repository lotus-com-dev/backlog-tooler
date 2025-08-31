# 開発ガイド

## 新機能の開発方法

v3.0のプラグインアーキテクチャにより、新しいBacklog支援機能を簡単に追加できます：

### 1. 新機能プラグインの作成

#### ステップ1: 機能ディレクトリの作成
```bash
mkdir src/features/task-manager  # kebab-case ディレクトリ名
```

#### ステップ2: 機能クラスの実装
```typescript
// src/features/task-manager/task-manager-feature.tsx  # kebab-case ファイル名
import { BaseFeature } from '@/core';
import type { FeatureConfig, FeatureContext, PageContext } from '@/core';

export class TaskManagerFeature extends BaseFeature {  # PascalCase クラス名
  constructor(
    featureConfig: FeatureConfig,
    context: FeatureContext,
    pageContext: PageContext
  ) {
    super(featureConfig, context, pageContext);
  }

  shouldActivate(): boolean {
    // この機能がアクティブになる条件を定義
    return this.pageContext.isViewPage();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    this.logger.debug('Initializing...');
    
    // 機能の初期化処理
    // DOM操作、イベントリスナー設定など
    
    this.setInitialized(true);
  }

  cleanup(): void {
    this.logger.debug('Cleaning up...');
    
    // クリーンアップ処理
    // イベントリスナー削除、DOM要素削除など
    
    this.setInitialized(false);
  }
}
```

#### ステップ3: エクスポートファイルの作成
```typescript
// src/features/task-manager/index.ts
export { TaskManagerFeature } from './task-manager-feature';
export type * from './types'; // 必要に応じて
```

### 2. 機能の登録

#### コンテンツスクリプトへの登録
```typescript
// src/scripts/content.tsx の initializeFeatureSystem() 内
const taskManagerFeature = new TaskManagerFeature(
  {
    id: 'task-manager',        // kebab-case ID
    name: 'Task Manager',       // Title Case 表示名
    description: 'Manage tasks in Backlog',
    enabled: true,
    version: '1.0.0'
  },
  context,
  pageContext
);

featureManager.registerFeature(taskManagerFeature);
// ログ出力: [TaskManager] ... (PascalCase、空白なし)
```

### 3. 設定の追加（オプション）

#### デフォルト設定の追加
```typescript
// src/scripts/background.ts の initializeDefaultStorage() 内
const defaultFeatures: FeatureSettings = {
  'comment-sorter': { /* 既存 */ },
  'task-manager': {  // kebab-case ID
    enabled: true,
    config: {
      // 機能固有の設定
      maxTasks: 100
    }
  }
};
```

### 4. 利用可能なユーティリティ

#### リソース管理
```typescript
// Observer の追跡
this.context.resourceTracker.trackObserver(observer);

// タイムアウトの追跡  
const timeoutId = setTimeout(() => { /* ... */ }, 1000);
this.context.resourceTracker.trackTimeout(timeoutId);

// DOM要素の追跡
this.context.resourceTracker.trackElement(element);
```

#### ページコンテキスト判定
```typescript
// 現在のページタイプを判定
if (this.pageContext.isViewPage()) { /* 課題ページ */ }
if (this.pageContext.isBoardPage()) { /* ボードページ */ }  
if (this.pageContext.isIframeContext()) { /* iframe内 */ }
```

#### 拡張機能状態の確認
```typescript
const enabled = await this.context.isExtensionEnabled();
```

#### ロガーの使用
```typescript
// ロガーはBaseFeatureで自動作成されるため、設定不要
// 機能名から自動的にプレフィックスが生成される

// 直接使用可能
this.logger.debug('Debug information');
this.logger.info('Information message');
this.logger.warn('Warning message');
this.logger.error('Error message');
```

### 5. 機能開発のベストプラクティス

- **リソース管理**: 必ず`cleanup()`でリソースを解放
- **abort signal**: `this.context.abortController.signal`で中断処理に対応
- **エラーハンドリング**: try-catch を使った適切なエラー処理
- **デバッグログ**: 開発時のデバッグ情報を出力（`console.log`ではなく適切なloggerを使用）
- **型安全**: TypeScriptの型定義を活用
- **統一ログ**: `contentLogger`（コンテンツスクリプト）や`this.logger`（機能クラス）を使用

### 6. 新機能開発時の必須チェックリスト

新機能を実装する際は、以下の項目を段階的に確認してください：

#### ステップ1: 基本実行確認
```typescript
// コンテンツスクリプトの実行確認
contentLogger.debug('Script loaded', { url: window.location.href });
```

- [ ] コンテンツスクリプトがページで実行されているか
- [ ] manifest.jsonの対象URLパターンに含まれているか  
- [ ] 基本的なログが出力されるか

#### ステップ2: ページ判定ロジック確認
- [ ] `pageContext.isXxxPage()` メソッドが正しく動作するか
- [ ] 初期化条件に新しいページタイプが含まれているか
- [ ] URL_PATTERNSに適切な定数が追加されているか

#### ステップ3: DOM要素検出
- [ ] 実際のHTMLからセレクターを正確に特定
- [ ] DOM要素が存在することを確認
- [ ] セレクターの大文字小文字やクラス名の組み合わせを確認

#### ステップ4: 段階的実装
- [ ] 機能を小さな単位に分割
- [ ] 各段階で動作確認を実施
- [ ] エラーハンドリングを適切に実装

### 7. よくある実装ミスと対策

#### ページ初期化漏れ
**症状**: 新しいページタイプで機能が動作しない
**原因**: content.tsxの初期化条件に追加し忘れ
**対策**: 
```typescript
// content.tsx の最後部分を確認
if (pageContext.isNewPageType()) {
  initializeFeatureSystem();
}
```

#### DOMセレクター不一致  
**症状**: DOM要素が見つからないエラー
**原因**: 実際のHTML構造との相違
**対策**: 実際のHTMLを確認してセレクターを正確に記述

#### 機能登録漏れ
**症状**: shouldActivate()が呼ばれない  
**原因**: FeatureManagerに機能を登録し忘れ
**対策**: initializeFeatureSystem()内での登録処理を確認

### 8. ログ使用ガイドライン

#### 適切なロガーの使用
```typescript
// 避けるべき
console.log('Debug message');

// 推奨
// コンテンツスクリプトで
contentLogger.debug('Debug message');

// 機能クラス内で
this.logger.debug('Debug message');
```

#### ログレベルの使い分け
- **debug**: 詳細なデバッグ情報、開発時のみ
- **info**: 重要な処理の開始・完了
- **warn**: 警告、処理は継続可能  
- **error**: エラー、処理の中断

#### ログ出力例
```typescript
// 機能初期化時
this.logger.info('Feature initialized successfully');

// 条件判定時
this.logger.debug('Page validation result', { isValid: result });

// 警告時
this.logger.warn('Element not found, retrying...', { attempt: 3 });

// エラー時  
this.logger.error('Critical error occurred', error);
```

### 9. テスト

```bash
npm run build
npm run lint
```

新機能を追加した後は、Chrome拡張機能として読み込んでBacklogページで動作確認してください。

## 開発環境コマンド

```bash
# 開発サーバーを起動（ホットリロード + 全ログレベル有効）
npm run dev

# 拡張機能をビルド（本番用 - WARN/ERRORのみ）
npm run build

# コードのリント
npm run lint

# プレビューサーバーを起動
npm run preview
```

### 開発ワークフロー

#### 1. 開発環境での作業
```bash
npm run dev
```
- Vite開発サーバーが起動
- `dist/` フォルダに開発版が生成される
- ファイル変更時に自動リロード（HMR）
- 全ログレベル（DEBUG/INFO/WARN/ERROR）が有効

#### 2. Chrome拡張機能として読み込み
```bash
# 一度だけ設定
1. chrome://extensions/ を開く
2. 「デベロッパー モード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `dist/` フォルダを選択

# 開発中
- ファイルを編集すると自動でリロードされる
- F12でDevToolsを開いてログを確認
- リアルタイムでデバッグ可能
```

#### 3. ログ確認方法
```bash
# Content Scriptのログ確認
1. BacklogページでF12キー
2. Consoleタブを選択
3. フィルターで機能名を検索（例：「CommentSorter」）

# Background Scriptのログ確認
1. chrome://extensions/ → 拡張機能の「詳細」
2. 「バックグラウンド ページを調べる」をクリック
3. DevToolsでConsoleを確認
```

## 本番環境での最終テスト

本番リリース前には本番ビルドでのテストを実施：

```bash
npm run build  # 本番ビルド（WARN/ERRORのみ）
```

1. Chrome拡張機能として読み込み
2. 本番と同等の環境でテスト
3. ログレベルが適切に制御されていることを確認

## 技術スタック詳細

- **React**: UIコンポーネントの構築（forwardRef、useCallback、useImperativeHandle活用）
- **TypeScript**: 型安全性を確保したJavaScript開発（厳密な型チェック）
- **Vite**: 高速なビルドツールとバンドラー
- **@crxjs/vite-plugin**: Vite用Chrome拡張機能開発プラグイン
- **Chrome Extension Manifest V3**: 最新の拡張機能仕様に準拠
- **ESLint**: コード品質の維持