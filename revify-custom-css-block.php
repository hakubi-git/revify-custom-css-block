<?php
/**
 * Plugin Name: Revify Custom CSS Block
 * Description: ブロックエディターに、親ブロック単位で適用できるカスタムCSSブロックを追加します。
 * Version: 3.0.3
 * Author: Revify
 * Plugin URI: https://github.com/hakubi-git/revify-custom-css-block
 * Update URI: https://github.com/hakubi-git/revify-custom-css-block
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: revify-custom-css-block
 */

defined( 'ABSPATH' ) || exit;

define( 'REVIFY_CCB_VERSION', '3.0.3' );
define( 'REVIFY_CCB_PATH', plugin_dir_path( __FILE__ ) );
define( 'REVIFY_CCB_URL', plugin_dir_url( __FILE__ ) );

/**
 * 管理画面で保存するグローバルCSS変数のオプション名です。
 */
define( 'REVIFY_CCB_GLOBAL_VARS_OPTION', 'revify_ccb_global_vars' );

/**
 * GitHub上の公開リポジトリから更新通知を受け取るための設定です。
 *
 * plugin-update-checker は Composer で同梱される想定です。
 * vendor/autoload.php がない環境でもプラグイン本体は動くように、存在確認してから読み込みます。
 */
function revify_ccb_register_update_checker() {
	$autoload = REVIFY_CCB_PATH . 'vendor/autoload.php';

	if ( file_exists( $autoload ) ) {
		require_once $autoload;
	}

	if ( ! class_exists( '\\YahnisElsts\\PluginUpdateChecker\\v5\\PucFactory' ) ) {
		return;
	}

	$update_checker = \YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
		'https://github.com/hakubi-git/revify-custom-css-block/',
		__FILE__,
		'revify-custom-css-block'
	);

	// 最新リリースにZIPアセットがある場合は、そのZIPを優先して利用します。
	if ( method_exists( $update_checker, 'getVcsApi' ) && method_exists( $update_checker->getVcsApi(), 'enableReleaseAssets' ) ) {
		$update_checker->getVcsApi()->enableReleaseAssets( '/revify-custom-css-block.*\.zip($|[?&#])/i' );
	}

	// リリースやタグがない場合のフォールバックとして main ブランチを見ます。
	if ( method_exists( $update_checker, 'setBranch' ) ) {
		$update_checker->setBranch( 'main' );
	}
}
add_action( 'plugins_loaded', 'revify_ccb_register_update_checker', 1 );

/**
 * CSS変数名を --name 形式へ正規化します。
 */
function revify_ccb_sanitize_css_var_name( $name ) {
	$name = is_string( $name ) ? trim( $name ) : '';
	$name = preg_replace( '/[^a-zA-Z0-9_-]/', '', $name );
	$name = ltrim( $name, '-' );

	if ( '' === $name ) {
		return '';
	}

	return '--' . $name;
}

/**
 * CSS変数値をstyle要素内で安全に扱える形へ整えます。
 * CSS値としての自由度は残しつつ、宣言やstyle要素を脱出しにくくします。
 */
function revify_ccb_sanitize_css_var_value( $value ) {
	$value = is_string( $value ) ? trim( $value ) : '';
	$value = wp_strip_all_tags( $value );
	$value = str_replace( array( "\r", "\n", ';', '{', '}' ), '', $value );
	$value = str_ireplace( '</style', '<\/style', $value );
	return $value;
}

/**
 * CSS変数設定をサニタイズします。
 */
function revify_ccb_sanitize_global_vars_option( $input ) {
	$output = array();

	if ( ! is_array( $input ) ) {
		return $output;
	}

	foreach ( $input as $row ) {
		if ( ! is_array( $row ) ) {
			continue;
		}

		$name  = revify_ccb_sanitize_css_var_name( $row['name'] ?? '' );
		$value = revify_ccb_sanitize_css_var_value( $row['value'] ?? '' );

		if ( '' === $name || '' === $value ) {
			continue;
		}

		$output[] = array(
			'name'  => $name,
			'value' => $value,
		);
	}

	return $output;
}

/**
 * 保存済みグローバルCSS変数を取得します。
 */
function revify_ccb_get_global_vars() {
	$vars = get_option( REVIFY_CCB_GLOBAL_VARS_OPTION, array() );
	return is_array( $vars ) ? revify_ccb_sanitize_global_vars_option( $vars ) : array();
}

/**
 * グローバルCSS変数のCSSを生成します。
 */
function revify_ccb_build_global_vars_css() {
	$vars = revify_ccb_get_global_vars();
	if ( empty( $vars ) ) {
		return '';
	}

	$lines = array( ':root {' );
	foreach ( $vars as $var ) {
		$lines[] = "\t" . $var['name'] . ': ' . $var['value'] . ';';
	}
	$lines[] = '}';

	return implode( "\n", $lines );
}

/**
 * グローバルCSS変数設定を登録します。
 */
function revify_ccb_register_global_vars_settings() {
	register_setting(
		'revify_ccb_global_vars',
		REVIFY_CCB_GLOBAL_VARS_OPTION,
		array(
			'type'              => 'array',
			'sanitize_callback' => 'revify_ccb_sanitize_global_vars_option',
			'default'           => array(),
		)
	);
}
add_action( 'admin_init', 'revify_ccb_register_global_vars_settings' );

/**
 * 設定ページを追加します。
 */
function revify_ccb_add_settings_page() {
	add_options_page(
		'Revify CSS変数',
		'Revify CSS変数',
		'manage_options',
		'revify-css-vars',
		'revify_ccb_render_settings_page'
	);
}
add_action( 'admin_menu', 'revify_ccb_add_settings_page' );

/**
 * 設定ページを表示します。
 */
function revify_ccb_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$vars = revify_ccb_get_global_vars();
	?>
	<div class="wrap revify-ccb-settings">
		<h1>Revify CSS変数</h1>
		<p>サイト全体で使用するCSSカスタムプロパティを管理できます。ここで登録した変数は、フロントとブロックエディターの両方で<code>:root</code>へ出力されます。</p>
		<p><code>--</code>から始まる名前で値を保存しておくと、CSS内で<code>var(--変数名)</code>として呼び出せます。</p>
		<form method="post" action="options.php">
			<?php settings_fields( 'revify_ccb_global_vars' ); ?>
			<table class="widefat striped" id="revify-ccb-vars-table" style="max-width: 920px;">
				<thead>
					<tr>
						<th style="width: 34%;">変数名</th>
						<th>値</th>
						<th style="width: 80px;">操作</th>
					</tr>
				</thead>
				<tbody>
					<?php if ( empty( $vars ) ) : ?>
						<?php $vars = array( array( 'name' => '', 'value' => '' ) ); ?>
					<?php endif; ?>
					<?php foreach ( $vars as $index => $var ) : ?>
						<tr>
							<td>
								<input type="text" class="regular-text revify-ccb-var-name" name="<?php echo esc_attr( REVIFY_CCB_GLOBAL_VARS_OPTION ); ?>[<?php echo esc_attr( $index ); ?>][name]" value="<?php echo esc_attr( $var['name'] ); ?>" placeholder="--my-color-accent">
							</td>
							<td>
								<input type="text" class="large-text" name="<?php echo esc_attr( REVIFY_CCB_GLOBAL_VARS_OPTION ); ?>[<?php echo esc_attr( $index ); ?>][value]" value="<?php echo esc_attr( $var['value'] ); ?>" placeholder="#3DA1D3">
							</td>
							<td><button type="button" class="button revify-ccb-remove-var">削除</button></td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
			<p><button type="button" class="button" id="revify-ccb-add-var">変数を追加</button></p>
			<div class="revify-ccb-settings-help">
				<p class="description">入力例:</p>
				<pre><code>--my-color-accent: #3DA1D3;
--my-space-section: 80px;
--my-shadow-card: 0 10px 30px rgba(0, 0, 0, .08);</code></pre>
				<p class="description">使用例:</p>
				<pre><code>.my-section {
  padding-block: var(--my-space-section);
}

.my-card {
  box-shadow: var(--my-shadow-card);
}

.my-label {
  color: var(--my-color-accent);
}</code></pre>
			</div>
			<?php submit_button(); ?>
		</form>
	</div>
	<script>
	(function(){
		const table = document.getElementById('revify-ccb-vars-table');
		const addButton = document.getElementById('revify-ccb-add-var');
		if (!table || !addButton) return;
		const tbody = table.querySelector('tbody');
		const optionName = <?php echo wp_json_encode( REVIFY_CCB_GLOBAL_VARS_OPTION ); ?>;
		function renumber(){
			Array.from(tbody.querySelectorAll('tr')).forEach(function(row, index){
				const inputs = row.querySelectorAll('input');
				if (inputs[0]) inputs[0].name = optionName + '[' + index + '][name]';
				if (inputs[1]) inputs[1].name = optionName + '[' + index + '][value]';
			});
		}
		addButton.addEventListener('click', function(){
			const index = tbody.querySelectorAll('tr').length;
			const tr = document.createElement('tr');
			tr.innerHTML = '<td><input type="text" class="regular-text revify-ccb-var-name" name="' + optionName + '[' + index + '][name]" value="" placeholder="--my-color-accent"></td><td><input type="text" class="large-text" name="' + optionName + '[' + index + '][value]" value="" placeholder="#3DA1D3"></td><td><button type="button" class="button revify-ccb-remove-var">削除</button></td>';
			tbody.appendChild(tr);
		});
		tbody.addEventListener('click', function(event){
			if (!event.target.classList.contains('revify-ccb-remove-var')) return;
			event.preventDefault();
			event.target.closest('tr').remove();
			renumber();
		});
		tbody.addEventListener('blur', function(event){
			if (!event.target.classList.contains('revify-ccb-var-name')) return;
			let value = event.target.value.trim().replace(/[^a-zA-Z0-9_-]/g, '').replace(/^-+/, '');
			if (value) event.target.value = '--' + value;
		}, true);
	})();
	</script>
	<?php
}

/**
 * headへ事前出力したCSSブロックの識別子です。
 *
 * @var array<string, bool>
 */
$GLOBALS['revify_ccb_collected_css_blocks'] = array();

/**
 * 現在のユーザーがシンタックスハイライトを有効にしているか確認します。
 */
function revify_ccb_is_syntax_highlighting_enabled() {
	if ( ! is_user_logged_in() ) {
		return false;
	}

	return 'false' !== wp_get_current_user()->syntax_highlighting;
}

/**
 * WordPress標準CodeMirrorの設定とアセットを読み込みます。
 * ユーザーがシンタックスハイライトを無効にしている場合は読み込みません。
 */
function revify_ccb_enqueue_code_editor() {
	wp_add_inline_script(
		'revify-ccb-editor',
		'window.revifyCcbGlobalVarsCss = ' . wp_json_encode( revify_ccb_build_global_vars_css(), JSON_HEX_TAG | JSON_UNESCAPED_SLASHES ) . ';',
		'before'
	);

	if ( ! revify_ccb_is_syntax_highlighting_enabled() ) {
		return;
	}

	$settings = wp_enqueue_code_editor(
		array(
			'type'       => 'text/css',
			'codemirror' => array(
				'theme'           => 'revify-monokai',
				'lineNumbers'     => true,
				'lineWrapping'    => false,
				'indentUnit'      => 4,
				'tabSize'         => 4,
				'indentWithTabs'  => true,
				'matchBrackets'   => true,
				'autoCloseBrackets' => true,
				'styleActiveLine' => true,
				'lint'            => false,
				'gutters'         => array( 'CodeMirror-linenumbers' ),
			),
		)
	);

	if ( false === $settings ) {
		return;
	}

	wp_add_inline_script(
		'revify-ccb-editor',
		'window.revifyCcbCodeEditorSettings = ' . wp_json_encode( $settings, JSON_HEX_TAG | JSON_UNESCAPED_SLASHES ) . ';',
		'before'
	);
}
add_action( 'enqueue_block_editor_assets', 'revify_ccb_enqueue_code_editor', 5 );

/**
 * ブロックエディター用アセットを登録します。
 */
function revify_ccb_register_editor_assets() {
	$asset_file = REVIFY_CCB_PATH . 'assets/editor.asset.php';
	$asset      = file_exists( $asset_file ) ? require $asset_file : array(
		'dependencies' => array( 'wp-blocks', 'wp-block-editor', 'wp-components', 'wp-element', 'wp-i18n' ),
		'version'      => REVIFY_CCB_VERSION,
	);

	$script_dependencies = $asset['dependencies'];
	$style_dependencies  = array();

	if ( revify_ccb_is_syntax_highlighting_enabled() ) {
		$script_dependencies[] = 'code-editor';
		$style_dependencies[]  = 'code-editor';
	}

	wp_register_script(
		'revify-ccb-editor',
		REVIFY_CCB_URL . 'assets/editor.js',
		array_values( array_unique( $script_dependencies ) ),
		$asset['version'],
		true
	);

	wp_register_style(
		'revify-ccb-editor',
		REVIFY_CCB_URL . 'assets/editor.css',
		$style_dependencies,
		REVIFY_CCB_VERSION
	);

	// 外部CSSファイルを持たない、ページ固有インラインCSS専用のハンドルです。
	wp_register_style( 'revify-ccb-page-css', false, array(), REVIFY_CCB_VERSION );
}
add_action( 'init', 'revify_ccb_register_editor_assets', 5 );

/**
 * ブロックを登録します。
 */
function revify_ccb_register_blocks() {
	$common = array(
		'editor_script'   => 'revify-ccb-editor',
		'editor_style'    => 'revify-ccb-editor',
		'render_callback' => 'revify_ccb_render_block',
	);

	register_block_type(
		'revify/custom-css',
		array_merge(
			$common,
			array(
				'api_version' => 3,
				'attributes'  => array(
					'base'    => array( 'type' => 'string', 'default' => '' ),
					'desktop' => array( 'type' => 'string', 'default' => '' ), // 2.0.1以前との互換用。
					'pc'      => array( 'type' => 'string', 'default' => '' ),
					'tablet'  => array( 'type' => 'string', 'default' => '' ),
					'mobile'  => array( 'type' => 'string', 'default' => '' ),
					'scopeId' => array( 'type' => 'string', 'default' => '' ),
				),
			)
		)
	);

}
add_action( 'init', 'revify_ccb_register_blocks', 20 );

/**
 * カスタムコードブロックを編集できる権限があるか確認します。
 */
function revify_ccb_user_can_use_blocks() {
	return current_user_can( 'unfiltered_html' );
}

/**
 * 権限がないユーザーにはブロックをインサーターへ表示しません。
 */
function revify_ccb_filter_block_metadata( $metadata ) {
	if ( isset( $metadata['name'] ) && 'revify/custom-css' === $metadata['name'] ) {
		if ( is_admin() && ! revify_ccb_user_can_use_blocks() ) {
			$metadata['supports']['inserter'] = false;
		}
	}
	return $metadata;
}
add_filter( 'block_type_metadata', 'revify_ccb_filter_block_metadata' );

/**
 * CSSを安全にstyle要素へ格納できる形へ整えます。
 */
function revify_ccb_prepare_css( $css ) {
	$css = is_string( $css ) ? $css : '';
	return str_ireplace( '</style', '<\/style', $css );
}

/**
 * selectorプレースホルダーを親ブロック専用クラスへ置換します。
 */
function revify_ccb_scope_css( $css, $scope_id ) {
	$scope_id = sanitize_html_class( (string) $scope_id );
	if ( '' === $scope_id ) {
		return $css;
	}

	$scope_selector = '.revify-scope-' . $scope_id;

	// .selector や #selector、単語の一部は置換しません。
	return preg_replace( '/(?<![.#\w-])selector(?![\w-])/i', $scope_selector, $css );
}

/**
 * CSSブロックの属性から、出力するCSSを生成します。
 */
function revify_ccb_build_css( $attributes ) {
	$base     = revify_ccb_prepare_css( $attributes['base'] ?? ( $attributes['desktop'] ?? '' ) );
	$pc       = revify_ccb_prepare_css( $attributes['pc'] ?? '' );
	$tablet   = revify_ccb_prepare_css( $attributes['tablet'] ?? '' );
	$mobile   = revify_ccb_prepare_css( $attributes['mobile'] ?? '' );
	$scope_id = $attributes['scopeId'] ?? '';

	$base   = revify_ccb_scope_css( $base, $scope_id );
	$pc     = revify_ccb_scope_css( $pc, $scope_id );
	$tablet = revify_ccb_scope_css( $tablet, $scope_id );
	$mobile = revify_ccb_scope_css( $mobile, $scope_id );

	$parts = array();

	if ( '' !== trim( $base ) ) {
		$parts[] = $base;
	}
	if ( '' !== trim( $pc ) ) {
		$parts[] = "@media (min-width: 960px) {\n" . $pc . "\n}";
	}
	if ( '' !== trim( $tablet ) ) {
		$parts[] = "@media (max-width: 959px) {\n" . $tablet . "\n}";
	}
	if ( '' !== trim( $mobile ) ) {
		$parts[] = "@media (max-width: 599px) {\n" . $mobile . "\n}";
	}

	return implode( "\n", $parts );
}

/**
 * 同一CSSブロックを識別するためのハッシュを生成します。
 */
function revify_ccb_css_block_hash( $attributes ) {
	$relevant = array(
		'base'    => $attributes['base'] ?? '',
		'desktop' => $attributes['desktop'] ?? '',
		'pc'      => $attributes['pc'] ?? '',
		'tablet'  => $attributes['tablet'] ?? '',
		'mobile'  => $attributes['mobile'] ?? '',
		'scopeId' => $attributes['scopeId'] ?? '',
	);

	return md5( wp_json_encode( $relevant ) );
}

/**
 * ブロック配列からカスタムCSSを再帰的に収集します。
 * core/block（同期パターン・旧再利用ブロック）も辿ります。
 */
function revify_ccb_collect_css_from_blocks( $blocks, &$css_items, &$visited_refs ) {
	foreach ( $blocks as $block ) {
		$block_name = $block['blockName'] ?? '';
		$attrs      = is_array( $block['attrs'] ?? null ) ? $block['attrs'] : array();

		if ( 'revify/custom-css' === $block_name ) {
			$css  = revify_ccb_build_css( $attrs );
			$hash = revify_ccb_css_block_hash( $attrs );

			if ( '' !== trim( $css ) && ! isset( $css_items[ $hash ] ) ) {
				$css_items[ $hash ] = $css;
			}
			$GLOBALS['revify_ccb_collected_css_blocks'][ $hash ] = true;
		}

		if ( 'core/block' === $block_name && ! empty( $attrs['ref'] ) ) {
			$ref_id = absint( $attrs['ref'] );
			if ( $ref_id && empty( $visited_refs[ $ref_id ] ) ) {
				$visited_refs[ $ref_id ] = true;
				$reusable = get_post( $ref_id );
				if ( $reusable instanceof WP_Post && 'wp_block' === $reusable->post_type ) {
					revify_ccb_collect_css_from_blocks( parse_blocks( $reusable->post_content ), $css_items, $visited_refs );
				}
			}
		}

		if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
			revify_ccb_collect_css_from_blocks( $block['innerBlocks'], $css_items, $visited_refs );
		}
	}
}


/**
 * グローバルCSS変数をフロントへ出力します。
 */
function revify_ccb_enqueue_global_vars_css() {
	if ( is_admin() || wp_doing_ajax() || is_feed() || is_robots() || is_trackback() ) {
		return;
	}

	$css = revify_ccb_build_global_vars_css();
	if ( '' === trim( $css ) ) {
		return;
	}

	wp_enqueue_style( 'revify-ccb-page-css' );
	wp_add_inline_style( 'revify-ccb-page-css', $css );
}
add_action( 'wp_enqueue_scripts', 'revify_ccb_enqueue_global_vars_css', 15 );

/**
 * 現在のメインコンテンツに含まれるCSSをheadへ1つに集約します。
 */
function revify_ccb_enqueue_collected_page_css() {
	if ( is_admin() || wp_doing_ajax() || is_feed() || is_robots() || is_trackback() ) {
		return;
	}

	$object = get_queried_object();
	if ( ! $object instanceof WP_Post || ! has_blocks( $object->post_content ) ) {
		return;
	}

	$css_items    = array();
	$visited_refs = array();
	revify_ccb_collect_css_from_blocks( parse_blocks( $object->post_content ), $css_items, $visited_refs );

	if ( empty( $css_items ) ) {
		return;
	}

	wp_enqueue_style( 'revify-ccb-page-css' );
	wp_add_inline_style( 'revify-ccb-page-css', implode( "\n\n", array_values( $css_items ) ) );
}
add_action( 'wp_enqueue_scripts', 'revify_ccb_enqueue_collected_page_css', 20 );

/**
 * 動的ブロックのフロント出力です。
 */
function revify_ccb_render_block( $attributes, $content, $block ) {
	if ( is_admin() && ! wp_doing_ajax() ) {
		return '';
	}

	if ( 'revify/custom-css' === $block->name ) {
		$css  = revify_ccb_build_css( $attributes );
		$hash = revify_ccb_css_block_hash( $attributes );

		if ( '' === trim( $css ) ) {
			return '';
		}

		// headへ事前収集済みなら、本文側には何も出力しません。
		if ( ! empty( $GLOBALS['revify_ccb_collected_css_blocks'][ $hash ] ) ) {
			return '';
		}

		// テンプレートパーツや動的コンテンツなど、事前解析できなかった場合の安全な補完です。
		$GLOBALS['revify_ccb_collected_css_blocks'][ $hash ] = true;
		return "\n<style class=\"revify-custom-css revify-custom-css-fallback\">\n" . $css . "\n</style>\n";
	}

	return '';
}
