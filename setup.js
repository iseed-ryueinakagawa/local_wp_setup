/* ---------------------------------------------------------- */
/* WordPressローカル開発環境の構築用スクリプト
/* ---------------------------------------------------------- */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// package.json の生成
if (!fs.existsSync('package.json')) {
  console.log('⏳ npm プロジェクトの初期化中...');
  try {
    execSync('npm init -y', { stdio: ['ignore', 'ignore', 'inherit'] });
    console.log('✅ npm プロジェクトを初期化しました');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }

  // scripts セクションの上書き
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  packageJson.scripts = {
    "up": "docker-compose up -d",
    "stop": "docker-compose stop",
    "install": "node theme_command.js install",
    "command": "node theme_command.js",
    "dev": "node theme_command.js run dev",
    "build": "node theme_command.js run build"
  };
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  console.log('✅ package.json の scripts を書き換えました');
} else {
  console.log('✅ 既に package.json が存在します');
}

// dotenv のインストール
if (!fs.existsSync('./node_modules/dotenv')) {
  console.log('⏳ dotenvのインストール中...');
  try {
    execSync('npm install dotenv', { stdio: ['ignore', 'ignore', 'inherit'] });
    console.log('✅ dotenv をインストールしました');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ dotenv は既にインストールされています');
}

// dotenv 読み込み
require('dotenv').config();
console.log('✅ .env 読み込み完了');

// docker-compose.yml の作成
if (!fs.existsSync('docker-compose.yml')) {
  const dockerComposeContent = `\
# ---------------------------------------------------------- #
# 共通設定をまとめたYAMLアンカー
# ---------------------------------------------------------- #
# WordPressの環境変数（.envファイルから参照）
x-wp-env: &wp-env
  WORDPRESS_DB_HOST: db
  WORDPRESS_DB_NAME: \${MYSQL_DATABASE}
  WORDPRESS_DB_USER: \${MYSQL_USER}
  WORDPRESS_DB_PASSWORD: \${MYSQL_PASSWORD}

# すべてマウントすると重くなるので、編集する範囲だけマウント
x-wp-volumes: &wp-volumes
  - ./wp-content/themes:/var/www/html/wp-content/themes
  - ./wp-content/plugins:/var/www/html/wp-content/plugins
  - ./wp-content/uploads:/var/www/html/wp-content/uploads
  - wp_data:/var/www/html

# ---------------------------------------------------------- #
# 実行するサービス
# ---------------------------------------------------------- #
services:
  db:
    image: mysql:latest
    volumes:
      - db_data:/var/lib/mysql
    command: --max_allowed_packet=32505856
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: \${MYSQL_DATABASE}
      MYSQL_USER: \${MYSQL_USER}
      MYSQL_PASSWORD: \${MYSQL_PASSWORD}

  wordpress:
    image: wordpress:latest
    ports:
      - "80:80"
    volumes: *wp-volumes
    environment:
      <<: *wp-env

  wpcli:
    image: wordpress:cli
    volumes: *wp-volumes
    environment:
      <<: *wp-env
    depends_on:
      - db
      - wordpress

volumes:
  db_data:
  wp_data:
`;
  fs.writeFileSync('docker-compose.yml', dockerComposeContent);
  console.log('✅ docker-compose.yml を作成しました');
} else {
  console.log('✅ 既に docker-compose.yml が存在します');
}

// Docker Desktop が起動しているかチェック
try {
  execSync('docker info', { stdio: 'ignore' });
  console.log('✅ Docker 起動確認');
} catch (e) {
  console.error('❌ Docker が起動していません');
  process.exit(1);
}

// docker-composeを起動してwordPressコンテナを生成
try {
  execSync('docker-compose up -d', { stdio: 'inherit' });
  console.log('✅ コンテナ起動成功');
} catch (e) {
  const msg = e.stderr?.toString() || e.message;
  if (msg.includes('port is already allocated')) {
    console.error('❌ ポートが競合しています。');
  } else {
    console.error('❌ コンテナ起動失敗:\n' + msg);
  }
  process.exit(1);
}

//データベース接続待ち
const dbUser = process.env.MYSQL_USER;
const dbPassword = process.env.MYSQL_PASSWORD;
try {
  for (let i = 0; i < 1000; i++) {
    try {
      execSync(`docker-compose exec db mysql -u${dbUser} -p${dbPassword} -e "SELECT 1"`, { stdio: 'ignore' });
      console.log('✅ DB接続成功');
      break;
    } catch (e) {
      if (i === 0) {
        console.log(`⏳ DB接続待機中...`);
      }
    }
  }
} catch {
  console.error('❌ DB接続失敗：タイムアウト');
  process.exit(1);
}

// WordPressのインストール
const site_title = process.env.WP_SITE_TITLE;
const admin_user = process.env.WP_ADMIN_USER;
const admin_password = process.env.WP_ADMIN_PASSWORD;
if (!site_title || !admin_user || !admin_password) {
  console.error('❌ WP_SITE_TITLE, WP_ADMIN_USER または WP_ADMIN_PASSWORD が .env にが定義されていません');
  process.exit(1);
}
try {
  execSync('docker-compose run --rm wpcli wp core is-installed', { stdio: 'ignore' });
  isInstalled = true;
  console.log('✅ WordPress は既にインストール済みです');
} catch {
  console.log('⏳ WordPressのインストール中...');
  try {
    //WordPressをインストール
    execSync(`docker-compose run --rm wpcli wp core install \
      --url="http://localhost" \
      --title="${site_title}" \
      --admin_user=${admin_user} \
      --admin_password=${admin_password} \
      --admin_email=admin@example.com`, { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch (err) {
    console.error('❌ WordPressのインストール失敗:\n' + err.message);
    process.exit(1);
  }
}

// テーマ生成準備
const theme_name = process.env.WP_THEME_DIR_NAME;
const author = process.env.WP_THEME_AUTHOR;
if (!theme_name || !author) {
  console.error('❌ .env に WP_THEME_DIR_NAME または WP_THEME_AUTHOR が定義されていません');
  process.exit(1);
}

// 新規テーマを生成するディレクトリを作成
console.log('⏳ テーマディレクトリの作成中...');
const themeDir = path.join(__dirname, 'wp-content', 'themes', theme_name);
if (!fs.existsSync(themeDir)) {
  fs.mkdirSync(themeDir, { recursive: true });
  console.log(`✅ テーマディレクトリを作成しました: ${themeDir}`);
} else {
  console.log(`✅ 既存ディレクトリ: ${themeDir}`);
}

// テーマ生成
console.log('⏳ テーマの生成中...');
try {
  const scaffoldCmd = `docker-compose run --rm wpcli wp scaffold _s ${theme_name} --theme_name="${theme_name}" --author="${author}" --sassify --force --activate`;
  execSync(scaffoldCmd, { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('✅ テーマを生成しました');
} catch (err) {
  console.error(`❌ エラーが発生しました:\n${err.message}`);
  process.exit(1);
}

// 不要な package.json を削除
const packageJsonPath = path.join(themeDir, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  fs.unlinkSync(packageJsonPath);
  console.log('✅ package.json を削除しました');
}

// テーマディレクトリ内のnpmプロジェクトを初期化
try {
  console.log('⏳ テーマディレクトリ内の npm プロジェクトの初期化中...');
  execSync('npm init -y', { cwd: themeDir, stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('✅ テーマディレクトリ内の npm プロジェクトを初期化しました');

  // scripts セクションの上書き
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.scripts = {
    "dev": "vite",
    "build": "vite build"
  };
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ テーマディレクトリ内の package.json の scripts を書き換えました');
} catch (error) {
  console.error('❌ エラーが発生しました:', error.message);
  process.exit(1);
}

// vite, sassのインストール
const vitePath = path.join(themeDir, './node_modules/vite');
const sassPath = path.join(themeDir, './node_modules/sass');
if (!fs.existsSync(vitePath) || !fs.existsSync(sassPath)) {
  console.log('⏳ vite, sassのインストール中...');
  try {
    execSync('npm install vite sass', { cwd: themeDir, stdio: ['ignore', 'ignore', 'inherit'] });
    console.log('✅ vite, sass をインストールしました');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ vite, sass は既にインストールされています');
}

// 不要なjsディレクトリの削除
const jsDirPath = path.join(themeDir, 'js');
if (jsDirPath) {
  fs.rmSync(jsDirPath, { recursive: true, force: true });
  console.log('✅ 不要な js を削除しました');
}

// srcディレクトリを作成して、sassを移動
const srcPath = path.join(themeDir, 'src');
const sassDirPath = path.join(themeDir, 'sass');
if (!fs.existsSync(srcPath)) {
  fs.mkdirSync(srcPath, { recursive: true });
  console.log('✅ src ディレクトリを作成しました');

  fs.renameSync(sassDirPath, path.join(srcPath, 'sass'));
  console.log('✅ src 内に sass ディレクトリを移動しました');

  fs.mkdirSync(path.join(srcPath, 'js'), { recursive: true });
  console.log('✅ src 内に js ディレクトリを作成しました');
} else {
  console.log('✅ 既に src ディレクトリが存在します');
}

// main.js、import_sass.jsの作成
if (fs.existsSync(path.join(srcPath, 'js'))) {
  const importSassJsContent = `\
// Sassをインポート
// main.jsでインポートする場合はimport_sass.js不要。
import '../sass/style.scss';
`;

  fs.writeFileSync(path.join(srcPath, 'js', 'main.js'), '');
  fs.writeFileSync(path.join(srcPath, 'js', 'import_sass.js'), importSassJsContent);
  console.log('✅ js ファイル準備完了');
} else {
  console.log('❌ src 内に js ディレクトリが存在しません');
}

// vite.config.mjs の作成
const viteConfigPath = path.join(themeDir, 'vite.config.mjs');
if (!fs.existsSync(viteConfigPath)) {
  const viteConfigMjsContent = `\
/* ---------------------------------------------------------- */
/* viteの設定ファイル
/* ---------------------------------------------------------- */
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    root: './',            // ソースディレクトリ
    build: {
        outDir: './dist',  // ビルドの出力先
        assetsDir: 'css',
        rollupOptions: {
            input: {
                //ビルド対象のjs
                main: path.resolve(__dirname, 'src/js/main.js'),
                //コンパイル対象のsass
                style: path.resolve(__dirname, 'src/sass/style.scss'),
            },
            output: {
                entryFileNames: 'js/[name].js',  // 出力するJSファイルのパス
                chunkFileNames: 'js/[name].js',
                assetFileNames: 'css/[name].css' // 出力するCSSファイルのパス
            },
        },
    },
});
`;
  fs.writeFileSync(viteConfigPath, viteConfigMjsContent);
  console.log('✅ vite.config.mjs を作成しました');
} else {
  console.log('✅ 既に vite.config.mjs が存在します');
}

// viteサーバのエントリポイントとしてindex.htmlを作成
const indexHtmlPath = path.join(themeDir, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  const indexHtmlContent = `\
<!------------------------------
   viteサーバのエントリポイント
-------------------------------->

<!DOCTYPE html>
<html lang="jp">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="http://localhost:5173/src/sass/style.scss">
  <script type="module" src="http://localhost:5173/src/js/main.js"></script>
</head>

<body>
  <h1>Vite is available</h1>
</body>

</html>
`;
  fs.writeFileSync(indexHtmlPath, indexHtmlContent);
  console.log('✅ index.html を作成しました');
} else {
  console.log('✅ 既に index.html が存在します');
}

// functions.phpのスタイル・スクリプト読み込みを修正
const functionsPath = path.join(themeDir, 'functions.php');
if (fs.existsSync(functionsPath)) {
  let functionsPhpContent = fs.readFileSync(functionsPath, 'utf8');
  const replacement = `
//スタイルとスクリプトを読み込み
function enqueue_style_scripts()
{
\t//ローカル環境
\t\$is_local = strpos(\$_SERVER['HTTP_HOST'], 'localhost') !== false;

\tif (\$is_local) {
\t\t// ローカル環境
\t\t\$script_handle = 'dev-script';
\t\twp_enqueue_script(
\t\t\t\$script_handle,
\t\t\t'http://localhost:5173/src/js/main.js',
\t\t\t[],
\t\t\tnull,
\t\t\ttrue
\t\t);
\t\t// 分ける場合はimport_sass.jsも読み込む
\t\twp_enqueue_script(
\t\t\t\$script_handle . '-style',
\t\t\t'http://localhost:5173/src/js/import_sass.js',
\t\t\t[],
\t\t\tnull,
\t\t\ttrue
\t\t);
\t} else {
\t\t// 本番環境
\t\t\$script_handle = 'prod-script';
\t\twp_enqueue_script(
\t\t\t\$script_handle,
\t\t\tget_template_directory_uri() . '/dist/js/main.js',
\t\t\t[],
\t\t\tnull,
\t\t\ttrue
\t\t);

\t\twp_enqueue_style(
\t\t\t'common-style',
\t\t\tget_template_directory_uri() . '/dist/css/style.css',
\t\t\t[],
\t\t\tnull
\t\t);
\t}
}
add_action('wp_enqueue_scripts', 'enqueue_style_scripts');


// モジュールタイプを追加する
function add_module_attribute(\$tag, \$handle, \$src)
{
\t// スクリプトハンドルを指定
\t\$module_scripts = ['dev-script', 'prod-script', 'dev-script-style', 'prod-script-style'];

\tif (in_array(\$handle, \$module_scripts)) {
\t\t// type="module" を追加してタグを再生成
\t\t\$tag = '<script type="module" src=\"' . esc_url(\$src) . '\"></script>';
\t}

\treturn \$tag;
}
add_filter('script_loader_tag', 'add_module_attribute', 10, 3);
`;

  const updatedContent = functionsPhpContent.replace(
    /function\s+\w+_scripts\s*\(\)\s*\{[\s\S]+?add_action\([\s\S]+?\);\n?/,
    replacement
  );
  fs.writeFileSync(functionsPath, updatedContent, 'utf8');
  console.log('✅ functions.php の読み込み設定が完了しました');
} else {
  console.log('❌ functions.php が存在しません');
}

// theme_command.js の作成
if (!fs.existsSync('theme_command.js')) {
  const themeCommandJsContent = `\
/* ---------------------------------------------------------- */
/* テーマフォルダ内でnpmコマンドを実行するためのスクリプト
/* ---------------------------------------------------------- */
const { exec } = require('child_process');
const path = require('path');
require('dotenv').config();

//.envファイルから環境変数を読み込み
const dir_name = process.env.WP_THEME_DIR_NAME;
if (!dir_name) {
    console.error('❌ .env に環境変数が定義されていません');
    process.exit(1);
}

// テーマディレクトリのパス
const themeDir = path.join('wp-content', 'themes', dir_name);

// npmコマンド
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('❌ 実行したい npm コマンドを指定してください');
    process.exit(1);
}

const command = \`npm \${args.join(' ')}\`;
console.log(\`🛠 実行中: \${command}（作業ディレクトリ: \${themeDir}）\`);

// 指定のパスに移動してコマンドを実行
exec(command, { cwd: themeDir }, (err, stdout, stderr) => {
    if (err) {
        console.error(\`❌ エラー:\\n\${stderr}\`);
        process.exit(1);
    }
    console.log(\`✅ 成功:\\n\${stdout}\`);
});
`;
  fs.writeFileSync('theme_command.js', themeCommandJsContent);
  console.log('✅ theme_command.js を作成しました');
} else {
  console.log('✅ 既に theme_command.js が存在します');
}