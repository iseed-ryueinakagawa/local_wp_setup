# 🐳 setup.js で簡単セットアップ！

## ❶ 事前準備

以下のソフトウェアをあらかじめインストールしておいてください：

- [Node.js](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

<br>

## ❷ `.env` ファイルの作成

`.env.example` を元に `.env` ファイルを作成し、以下の項目を入力してください：

```.env
# データベース自体を作る際に必要なパスワードとデータベースの名前
MYSQL_ROOT_PASSWORD
MYSQL_DATABASE

# WordPressがデータベースにアクセスする際に使うログイン情報
MYSQL_USER
MYSQL_PASSWORD
```

> 💡 ローカル環境のみで動かすデータベースなので、上段の環境変数は任意の値で構いません。

```.env
WP_SITE_TITLE
WP_ADMIN_USER
WP_ADMIN_PASSWORD
WP_THEME_DIR_NAME
WP_THEME_AUTHOR
```

> 下段のサイトタイトルやログイン情報は、本番環境に合わせておくと便利です。
> `WP_THEME_DIR_NAME` は使用するテーマのディレクトリ名を指定してください。
> テーマの作成者は社名で OK です。

<br>

## ❸ セットアップの実行

一連の設定を自動で行う `setup.js` を用意しています。
ターミナルを開き、以下のコマンドで実行してください。

```bash
node setup.js  // 開発環境のセットアップ
```

ローカルの WordPress 開発環境が構築されました！

<br>

## ❹ 使用できるコマンド一覧

```bash
npm run up        # Docker コンテナ起動
npm run stop      # Docker コンテナ停止
npm run install   # テーマフォルダ内にパッケージをインストール
npm run dev       # Vite サーバー起動
npm run build     # SASS/JS のビルド
npm run command ~ # その他 npm コマンドの実行
```

<br>

## 補足

- 新規でテーマを制作する場合は、生成されたテーマをそのまま使用してください。
- 既存テーマを使用する場合は、`themes` フォルダ内のテーマを置き換えて使用してください。
- すでに本番環境がある場合は、**All-in-One WP Migration** 等のプラグインを使って本番データをローカル環境に移してください。
