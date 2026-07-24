(function (wp) {
	'use strict';

	const el = wp.element.createElement;
	const useEffect = wp.element.useEffect;
	const useRef = wp.element.useRef;
	const useState = wp.element.useState;
	const registerBlockType = wp.blocks.registerBlockType;
	const hasBlockSupport = wp.blocks.hasBlockSupport;
	const useBlockProps = wp.blockEditor.useBlockProps;
	const TabPanel = wp.components.TabPanel;
	const Notice = wp.components.Notice;
	const Button = wp.components.Button;
	const useSelect = wp.data.useSelect;
	const useDispatch = wp.data.useDispatch;
	const __ = wp.i18n.__;

	function cloneCodeEditorSettings() {
		const source = window.revifyCcbCodeEditorSettings;
		if (!source || !window.wp.codeEditor || typeof window.wp.codeEditor.initialize !== 'function') {
			return null;
		}

		const settings = Object.assign({}, source);

		// WordPress標準CodeMirrorのCSSLint設定を除去します。
		// CSSネストなど、現代的なCSSを誤検知させないためです。
		delete settings.csslint;
		settings.codemirror = Object.assign({}, source.codemirror || {}, {
			theme: 'revify-monokai',
			mode: 'text/css',
			lineNumbers: true,
			lineWrapping: false,
			indentUnit: 4,
			tabSize: 4,
			indentWithTabs: true,
			matchBrackets: true,
			autoCloseBrackets: true,
			styleActiveLine: true,
			lint: false,
			gutters: ['CodeMirror-linenumbers'],
			extraKeys: {
				Tab: function (editor) {
					if (editor.somethingSelected()) {
						editor.indentSelection('add');
						return;
					}
					editor.replaceSelection('\t', 'end');
				},
				'Shift-Tab': function (editor) {
					editor.indentSelection('subtract');
				}
			}
		});

		return settings;
	}

	function CodeField(props) {
		const textareaRef = useRef(null);
		const editorRef = useRef(null);
		const changeHandlerRef = useRef(props.onChange);
		const [isEnhanced, setIsEnhanced] = useState(false);
		changeHandlerRef.current = props.onChange;

		useEffect(function () {
			const textarea = textareaRef.current;
			const settings = cloneCodeEditorSettings();
			if (!isEnhanced || !textarea || !settings) return undefined;

			const initialized = window.wp.codeEditor.initialize(textarea, settings);
			if (!initialized || !initialized.codemirror) return undefined;

			const codeMirror = initialized.codemirror;

			// wp.codeEditor.initialize() がLintを再設定する環境でも確実に停止します。
			codeMirror.setOption('lint', false);
			codeMirror.setOption('gutters', ['CodeMirror-linenumbers']);
			if (typeof codeMirror.clearGutter === 'function') {
				codeMirror.clearGutter('CodeMirror-lint-markers');
			}

			editorRef.current = codeMirror;
			codeMirror.setValue(props.value || '');
			codeMirror.clearHistory();

			const handleChange = function (instance) {
				changeHandlerRef.current(instance.getValue());

				// 色分けエディター入力時だけ、属性更新後の次フレームで
				// プレビューを再評価します。メディアクエリ生成処理には触れません。
				window.requestAnimationFrame(function () {
					scheduleEditorPreviewCssUpdate(0);
				});
			};
			codeMirror.on('change', handleChange);
			window.requestAnimationFrame(function () {
				codeMirror.refresh();
			});

			return function () {
				codeMirror.off('change', handleChange);
				if (typeof codeMirror.toTextArea === 'function') {
					codeMirror.toTextArea();
				}
				editorRef.current = null;
			};
		}, [isEnhanced]);

		useEffect(function () {
			const nextValue = props.value || '';
			const codeMirror = editorRef.current;
			if (codeMirror) {
				if (codeMirror.getValue() !== nextValue) {
					const cursor = codeMirror.getCursor();
					codeMirror.setValue(nextValue);
					codeMirror.setCursor(cursor);
				}
				return;
			}
			if (textareaRef.current && textareaRef.current.value !== nextValue) {
				textareaRef.current.value = nextValue;
			}
		}, [props.value]);

		useEffect(function () {
			const textarea = textareaRef.current;
			const wrapper = textarea ? textarea.closest('.revify-ccb-code-editor-wrap') : null;
			if (!wrapper || typeof window.ResizeObserver !== 'function') return undefined;

			let frame = 0;
			const observer = new window.ResizeObserver(function () {
				if (frame) window.cancelAnimationFrame(frame);
				frame = window.requestAnimationFrame(function () {
					frame = 0;
					const height = Math.round(wrapper.getBoundingClientRect().height);
					if (editorRef.current) editorRef.current.refresh();
					if (height >= 180 && props.onHeightChange && height !== props.height) {
						props.onHeightChange(height);
					}
				});
			});
			observer.observe(wrapper);

			return function () {
				observer.disconnect();
				if (frame) window.cancelAnimationFrame(frame);
			};
		}, [props.height, props.onHeightChange, isEnhanced]);

		function handlePlainTextareaKeyDown(event) {
			if (editorRef.current || event.key !== 'Tab') return;
			if (event.nativeEvent && event.nativeEvent.revifyCcbTabHandled) return;
			if (event.nativeEvent) event.nativeEvent.revifyCcbTabHandled = true;

			event.preventDefault();
			event.stopPropagation();
			if (event.nativeEvent && typeof event.nativeEvent.stopImmediatePropagation === 'function') {
				event.nativeEvent.stopImmediatePropagation();
			}

			const input = event.currentTarget;
			const value = input.value;
			const start = input.selectionStart;
			const end = input.selectionEnd;
			let nextValue = value;
			let nextStart = start;
			let nextEnd = end;

			if (start !== end) {
				const lineStart = value.lastIndexOf('\n', start - 1) + 1;
				const selected = value.slice(lineStart, end);

				if (event.shiftKey) {
					let removed = 0;
					const outdented = selected.replace(/(^|\n)(\t| {1,4})/g, function (match, lineBreak, indent) {
						removed += indent.length;
						return lineBreak;
					});
					nextValue = value.slice(0, lineStart) + outdented + value.slice(end);
					nextStart = Math.max(lineStart, start - Math.min(start - lineStart, 1));
					nextEnd = Math.max(nextStart, end - removed);
				} else {
					const indented = selected.replace(/^/gm, '\t');
					const added = indented.length - selected.length;
					nextValue = value.slice(0, lineStart) + indented + value.slice(end);
					nextStart = start + 1;
					nextEnd = end + added;
				}
			} else if (event.shiftKey) {
				const lineStart = value.lastIndexOf('\n', start - 1) + 1;
				const beforeCursor = value.slice(lineStart, start);
				const match = beforeCursor.match(/(\t| {1,4})$/);
				if (match) {
					const removeLength = match[0].length;
					nextValue = value.slice(0, start - removeLength) + value.slice(start);
					nextStart = nextEnd = start - removeLength;
				}
			} else {
				nextValue = value.slice(0, start) + '\t' + value.slice(end);
				nextStart = nextEnd = start + 1;
			}

			if (nextValue !== value) {
				props.onChange(nextValue);
				window.requestAnimationFrame(function () {
					input.value = nextValue;
					input.selectionStart = nextStart;
					input.selectionEnd = nextEnd;
				});
			}
		}

		const canUseCodeMirror = !!cloneCodeEditorSettings();

		return el(
			'div',
			{ className: 'revify-ccb-field-shell' },
			el(
				'div',
				{ className: 'revify-ccb-editor-tools' },
				el(
					'span',
					{ className: 'revify-ccb-editor-mode' },
					isEnhanced ? '色分けエディター' : '軽量入力'
				),
				canUseCodeMirror && el(
					'button',
					{
						type: 'button',
						className: 'button button-small',
						onClick: function () { setIsEnhanced(!isEnhanced); }
					},
					isEnhanced ? '軽量入力に戻す' : '色分けエディターを使う'
				)
			),
			el(
				'div',
				{
					className: 'revify-ccb-code-editor-wrap' + (isEnhanced ? ' is-enhanced' : ' is-plain'),
					style: { height: Math.max(180, props.height || 320) + 'px' }
				},
				el('textarea', {
					ref: textareaRef,
					className: 'revify-ccb-code-field',
					defaultValue: props.value || '',
					placeholder: props.placeholder || '',
					spellCheck: false,
					onChange: function (event) {
						if (!editorRef.current) props.onChange(event.target.value);
					},
					onKeyDown: handlePlainTextareaKeyDown,
					onKeyDownCapture: handlePlainTextareaKeyDown
				})
			)
		);
	}

	function BlockHeader(props) {
		return el(
			'div',
			{ className: 'revify-ccb-header' },
			el('strong', null, props.title),
			el('span', null, props.description)
		);
	}

	function splitClasses(value) {
		return (value || '').trim().split(/\s+/).filter(Boolean);
	}

	function addClass(value, className) {
		const classes = splitClasses(value);
		if (classes.indexOf(className) === -1) classes.push(className);
		return classes.join(' ');
	}

	function removeClass(value, className) {
		return splitClasses(value).filter(function (item) {
			return item !== className;
		}).join(' ');
	}

	function scopeCss(css, scopeId) {
		if (!css || !scopeId) return css || '';
		const scopeSelector = '.revify-scope-' + scopeId.replace(/[^a-zA-Z0-9_-]/g, '');
		return css.replace(/(^|[^.#\w-])selector(?![\w-])/gi, function (match, prefix) {
			return prefix + scopeSelector;
		});
	}

	function buildEditorCss(attributes) {
		const base = scopeCss(attributes.base || attributes.desktop || '', attributes.scopeId || '');
		const pc = scopeCss(attributes.pc || '', attributes.scopeId || '');
		const tablet = scopeCss(attributes.tablet || '', attributes.scopeId || '');
		const mobile = scopeCss(attributes.mobile || '', attributes.scopeId || '');
		const parts = [];

		if (base.trim()) parts.push(base);
		if (pc.trim()) parts.push('@media (min-width: 960px) {\n' + pc + '\n}');
		if (tablet.trim()) parts.push('@media (max-width: 959px) {\n' + tablet + '\n}');
		if (mobile.trim()) parts.push('@media (max-width: 599px) {\n' + mobile + '\n}');

		return parts.join('\n');
	}

	function collectCustomCssBlocks(blocks, output) {
		(blocks || []).forEach(function (block) {
			if (block.name === 'revify/custom-css') {
				const css = buildEditorCss(block.attributes || {});
				if (css.trim()) output.push(css);
			}
			if (block.innerBlocks && block.innerBlocks.length) {
				collectCustomCssBlocks(block.innerBlocks, output);
			}
		});
	}

	function getEditorDocuments() {
		const documents = [document];
		document.querySelectorAll('iframe').forEach(function (iframe) {
			try {
				if (iframe.contentDocument) documents.push(iframe.contentDocument);
			} catch (error) {
				// Cross-origin iframeは対象外です。
			}
		});
		return documents.filter(function (doc, index, list) {
			return doc && doc.head && list.indexOf(doc) === index;
		});
	}

	function updateEditorPreviewCss() {
		const store = wp.data.select('core/block-editor');
		if (!store || !store.getBlocks) return;

		const cssItems = [];
		collectCustomCssBlocks(store.getBlocks(), cssItems);
		const globalVarsCss = window.revifyCcbGlobalVarsCss || '';
		const css = [globalVarsCss].concat(cssItems).filter(function (item) { return item && item.trim(); }).join('\n\n');

		getEditorDocuments().forEach(function (doc) {
			let style = doc.getElementById('revify-ccb-editor-preview-css');
			if (!style) {
				style = doc.createElement('style');
				style.id = 'revify-ccb-editor-preview-css';
			}

			// iframe版エディターでは、保存・更新・デバイスプレビュー切替のあとに
			// キャンバス側のdocumentやhead内のCSS順序が変わることがあります。
			// 既存のstyleでも毎回head末尾へ移動し、テーマ/ブロックCSSより後に効く状態を保ちます。
			if (style.parentNode !== doc.head || style !== doc.head.lastElementChild) {
				doc.head.appendChild(style);
			}

			if (style.textContent !== css) style.textContent = css;
		});
	}

	let previewIframeObserver = null;
	let observedPreviewIframes = [];

	function scheduleEditorPreviewCssUpdateBurst() {
		[0, 80, 300, 800].forEach(function (delay) {
			scheduleEditorPreviewCssUpdate(delay);
		});
	}

	function attachPreviewIframeLoadHandlers() {
		document.querySelectorAll('iframe').forEach(function (iframe) {
			if (observedPreviewIframes.indexOf(iframe) !== -1) return;
			observedPreviewIframes.push(iframe);

			iframe.addEventListener('load', function () {
				scheduleEditorPreviewCssUpdateBurst();
			});
		});
	}

	function startPreviewIframeObserver() {
		attachPreviewIframeLoadHandlers();

		if (previewIframeObserver || typeof window.MutationObserver !== 'function') return;

		previewIframeObserver = new window.MutationObserver(function () {
			attachPreviewIframeLoadHandlers();
			scheduleEditorPreviewCssUpdateBurst();
		});

		previewIframeObserver.observe(document.body, {
			childList: true,
			subtree: true
		});
	}

	let previewUpdateTimer = 0;
	function scheduleEditorPreviewCssUpdate(delay) {
		const wait = typeof delay === 'number' ? delay : 80;
		if (previewUpdateTimer) window.clearTimeout(previewUpdateTimer);
		previewUpdateTimer = window.setTimeout(function () {
			previewUpdateTimer = 0;
			window.requestAnimationFrame(updateEditorPreviewCss);
		}, wait);
	}

	window.setTimeout(function () {
		startPreviewIframeObserver();
		scheduleEditorPreviewCssUpdateBurst();
	}, 0);

	window.addEventListener('focus', function () {
		scheduleEditorPreviewCssUpdateBurst();
	});


	function sanitizeScopeId(value) {
		return (value || '').replace(/[^a-zA-Z0-9_-]/g, '');
	}

	function getAllCssText(attributes) {
		return [
			attributes.base || attributes.desktop || '',
			attributes.pc || '',
			attributes.tablet || '',
			attributes.mobile || ''
		].join('\n');
	}

	function usesSelector(attributes) {
		return /(^|[^.#\w-])selector(?![\w-])/i.test(getAllCssText(attributes || {}));
	}

	function getRevifyScopeClasses(className) {
		return splitClasses(className).filter(function (item) {
			return /^revify-scope-[a-zA-Z0-9_-]+$/.test(item);
		});
	}

	function stripCssForBraceCheck(css) {
		return (css || '')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/"(?:\\.|[^"\\])*"/g, '""')
			.replace(/'(?:\\.|[^'\\])*'/g, "''");
	}

	function getBraceBalance(attributes) {
		const css = stripCssForBraceCheck(getAllCssText(attributes || {}));
		let opens = 0;
		let closes = 0;
		for (let i = 0; i < css.length; i += 1) {
			if (css[i] === '{') opens += 1;
			if (css[i] === '}') closes += 1;
		}
		return { opens: opens, closes: closes, balanced: opens === closes };
	}


	function createFreshScopeId(usedScopeIds) {
		let candidate = '';
		do {
			if (window.crypto && typeof window.crypto.randomUUID === 'function') {
				candidate = 'r' + window.crypto.randomUUID().replace(/-/g, '').slice(0, 12).toLowerCase();
			} else {
				candidate = 'r' + Math.random().toString(36).slice(2, 14);
			}
		} while (!candidate || usedScopeIds.has(candidate));
		return candidate;
	}

	function collectScopedParents(blocks, parentBlock, output) {
		(blocks || []).forEach(function (block) {
			if (block.name === 'revify/custom-css' && parentBlock) {
				const scopeId = sanitizeScopeId((block.attributes || {}).scopeId || '');
				if (scopeId) {
					output.push({
						cssClientId: block.clientId,
						parentClientId: parentBlock.clientId,
						scopeId: scopeId
					});
				}
			}
			if (block.innerBlocks && block.innerBlocks.length) {
				collectScopedParents(block.innerBlocks, block, output);
			}
		});
	}

	function countDistinctParentsForScope(blocks, targetScopeId) {
		if (!targetScopeId) return 0;
		const usages = [];
		collectScopedParents(blocks || [], null, usages);
		const parents = new Set();
		usages.forEach(function (usage) {
			if (usage.scopeId === targetScopeId) parents.add(usage.parentClientId);
		});
		return parents.size;
	}

	let scopeDuplicateGuardReady = false;
	let scopeDuplicateGuardBusy = false;
	let knownScopedParentIds = new Set();

	function snapshotScopedParentIds() {
		const store = wp.data.select('core/block-editor');
		if (!store || !store.getBlocks) return new Set();
		const usages = [];
		collectScopedParents(store.getBlocks(), null, usages);
		return new Set(usages.map(function (usage) { return usage.parentClientId; }));
	}

	function repairNewDuplicateScopes() {
		if (!scopeDuplicateGuardReady || scopeDuplicateGuardBusy) return;

		const store = wp.data.select('core/block-editor');
		const editorStore = wp.data.select('core/editor');
		const dispatcher = wp.data.dispatch('core/block-editor');
		if (!store || !store.getBlocks || !dispatcher || !dispatcher.updateBlockAttributes) return;

		// 初期読み込み中・未編集時は現在の状態を基準として記録するだけにします。
		// これにより、既存ページを開いただけでスコープIDを書き換えません。
		if (editorStore && typeof editorStore.isEditedPostDirty === 'function' && !editorStore.isEditedPostDirty()) {
			knownScopedParentIds = snapshotScopedParentIds();
			return;
		}

		const usages = [];
		collectScopedParents(store.getBlocks(), null, usages);
		if (!usages.length) {
			knownScopedParentIds = new Set();
			return;
		}

		const usedScopeIds = new Set(usages.map(function (usage) { return usage.scopeId; }));
		const parentsByScope = new Map();
		usages.forEach(function (usage) {
			if (!parentsByScope.has(usage.scopeId)) parentsByScope.set(usage.scopeId, []);
			const parentIds = parentsByScope.get(usage.scopeId);
			if (parentIds.indexOf(usage.parentClientId) === -1) parentIds.push(usage.parentClientId);
		});

		const repairs = [];
		parentsByScope.forEach(function (parentIds, scopeId) {
			if (parentIds.length < 2) return;

			const existingParents = parentIds.filter(function (parentId) {
				return knownScopedParentIds.has(parentId);
			});
			const newParents = parentIds.filter(function (parentId) {
				return !knownScopedParentIds.has(parentId);
			});

			// 既存ページを開いただけでは変更しません。
			// 新しく追加された親だけを複製先候補として扱います。
			if (!newParents.length) return;

			// 同じ操作で新規親が複数追加された場合、既存親があれば新規親をすべて、
			// 既存親がなければ先頭以外を振り直します。
			const targets = existingParents.length ? newParents : newParents.slice(1);
			targets.forEach(function (parentId) {
				repairs.push({ parentClientId: parentId, oldScopeId: scopeId });
			});
		});

		if (!repairs.length) {
			knownScopedParentIds = new Set(usages.map(function (usage) { return usage.parentClientId; }));
			return;
		}

		scopeDuplicateGuardBusy = true;
		repairs.forEach(function (repair) {
			const parentBlock = store.getBlock(repair.parentClientId);
			if (!parentBlock || !parentBlock.attributes) return;

			const newScopeId = createFreshScopeId(usedScopeIds);
			usedScopeIds.add(newScopeId);
			const oldScopeClass = 'revify-scope-' + repair.oldScopeId;
			const newScopeClass = 'revify-scope-' + newScopeId;
			const currentClassName = parentBlock.attributes.className || '';
			const nextClassName = addClass(removeClass(currentClassName, oldScopeClass), newScopeClass);

			if (nextClassName !== currentClassName) {
				dispatcher.updateBlockAttributes(repair.parentClientId, { className: nextClassName });
			}

			usages.forEach(function (usage) {
				if (usage.parentClientId === repair.parentClientId && usage.scopeId === repair.oldScopeId) {
					dispatcher.updateBlockAttributes(usage.cssClientId, { scopeId: newScopeId });
				}
			});
		});

		window.setTimeout(function () {
			knownScopedParentIds = snapshotScopedParentIds();
			scopeDuplicateGuardBusy = false;
			scheduleEditorPreviewCssUpdateBurst();
		}, 0);
	}

	window.setTimeout(function () {
		knownScopedParentIds = snapshotScopedParentIds();
		scopeDuplicateGuardReady = true;
		wp.data.subscribe(repairNewDuplicateScopes);
	}, 0);

	function reassignScopeForParent(parentClientId, oldScopeId) {
		const store = wp.data.select('core/block-editor');
		const dispatcher = wp.data.dispatch('core/block-editor');
		if (!parentClientId || !oldScopeId || !store || !store.getBlocks || !dispatcher || !dispatcher.updateBlockAttributes) {
			return false;
		}

		const parentBlock = store.getBlock(parentClientId);
		if (!parentBlock || !parentBlock.attributes) return false;

		const usages = [];
		collectScopedParents(store.getBlocks(), null, usages);
		const usedScopeIds = new Set(usages.map(function (usage) { return usage.scopeId; }));
		const newScopeId = createFreshScopeId(usedScopeIds);
		const oldScopeClass = 'revify-scope-' + oldScopeId;
		const newScopeClass = 'revify-scope-' + newScopeId;
		const currentClassName = parentBlock.attributes.className || '';
		const nextClassName = addClass(removeClass(currentClassName, oldScopeClass), newScopeClass);

		if (nextClassName !== currentClassName) {
			dispatcher.updateBlockAttributes(parentClientId, { className: nextClassName });
		}

		usages.forEach(function (usage) {
			if (usage.parentClientId === parentClientId && usage.scopeId === oldScopeId) {
				dispatcher.updateBlockAttributes(usage.cssClientId, { scopeId: newScopeId });
			}
		});

		window.setTimeout(function () {
			knownScopedParentIds = snapshotScopedParentIds();
			scheduleEditorPreviewCssUpdateBurst();
		}, 0);

		return true;
	}

	function buildScopeDiagnostics(attributes, parentBlock, canScopeParent, duplicateParentCount) {
		const scopeId = sanitizeScopeId(attributes.scopeId || '');
		const scopeClass = scopeId ? 'revify-scope-' + scopeId : '';
		const parentClassName = parentBlock && parentBlock.attributes ? (parentBlock.attributes.className || '') : '';
		const parentScopeClasses = getRevifyScopeClasses(parentClassName);
		const selectorUsed = usesSelector(attributes || {});
		const braceBalance = getBraceBalance(attributes || {});
		const warnings = [];

		if (selectorUsed && (!parentBlock || !canScopeParent)) {
			warnings.push({
				key: 'no-parent',
				message: 'selector を使っていますが、対象となる親ブロックが見つかりません。ページ全体に効かせたいCSSの場合は selector を使わず、通常のCSSとして記述してください。'
			});
		}

		if (parentScopeClasses.length > 1) {
			warnings.push({
				key: 'multiple-scopes',
				message: 'この親ブロックに Revify のスコープクラスが複数あります。CSSが意図しない範囲に効く可能性があります。親ブロックの追加CSSクラスを確認してください。'
			});
		}

		if (selectorUsed && parentScopeClasses.length > 0 && scopeClass && parentScopeClasses.indexOf(scopeClass) === -1) {
			warnings.push({
				key: 'scope-mismatch',
				message: 'このCSSブロックの scopeId と、親ブロックの Revify スコープクラスが一致していません。selector を使ったCSSが反映されない可能性があります。'
			});
		}

		if (duplicateParentCount > 1) {
			warnings.push({
				key: 'duplicate-parent-scope',
				message: '異なる親ブロックで同じスコープIDが使用されています。CSSが互いに上書きされる可能性があります。'
			});
		}

		if (!braceBalance.balanced) {
			warnings.push({
				key: 'brace-balance',
				message: '{ と } の数が一致していない可能性があります。CSSはページ内でまとめて出力されるため、前後のCSSブロックにも影響することがあります。'
			});
		}

		return {
			scopeId: scopeId,
			scopeClass: scopeClass,
			selectorUsed: selectorUsed,
			parentBlockName: parentBlock ? parentBlock.name : '',
			parentClassName: parentClassName,
			parentScopeClasses: parentScopeClasses,
			braceBalance: braceBalance,
			warnings: warnings
		};
	}


	registerBlockType('revify/custom-css', {
		apiVersion: 3,
		title: __('カスタムCSS', 'revify-custom-css-block'),
		description: __('`selector`で、このカスタムCSSブロックを囲んでいる親ブロックを指定できます。', 'revify-custom-css-block'),
		category: 'design',
		icon: 'editor-code',
		keywords: ['CSS', 'style', 'selector', 'Revify'],
		attributes: {
			base: { type: 'string', default: '' },
			desktop: { type: 'string', default: '' },
			pc: { type: 'string', default: '' },
			tablet: { type: 'string', default: '' },
			mobile: { type: 'string', default: '' },
			scopeId: { type: 'string', default: '' },
			editorHeight: { type: 'number', default: 320 }
		},
		supports: {
			html: false,
			anchor: false,
			customClassName: false
		},
		edit: function (props) {
			const clientId = props.clientId;
			const scopeId = props.attributes.scopeId || ('r' + clientId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase());
			const scopeClass = 'revify-scope-' + scopeId;
			const previousParentRef = useRef('');
			const editor = useSelect(function (select) {
				const store = select('core/block-editor');
				const parentClientId = store.getBlockRootClientId(clientId);
				return {
					parentClientId: parentClientId,
					parentBlock: parentClientId ? store.getBlock(parentClientId) : null,
					duplicateParentCount: countDistinctParentsForScope(store.getBlocks(), scopeId)
				};
			}, [clientId, scopeId]);
			const dispatch = useDispatch('core/block-editor');
			const canScopeParent = !!(
				editor.parentBlock &&
				hasBlockSupport(editor.parentBlock.name, 'customClassName', true)
			);
			const diagnostics = buildScopeDiagnostics(props.attributes, editor.parentBlock, canScopeParent, editor.duplicateParentCount);

			useEffect(function () {
				if (!props.attributes.scopeId) {
					props.setAttributes({ scopeId: scopeId });
				}
			}, [scopeId]);

			useEffect(function () {
				scheduleEditorPreviewCssUpdate();
				return function () {
					window.setTimeout(scheduleEditorPreviewCssUpdate, 0);
				};
			}, [props.attributes.base, props.attributes.desktop, props.attributes.pc, props.attributes.tablet, props.attributes.mobile, props.attributes.scopeId, editor.parentClientId]);

			useEffect(function () {
				const oldParentId = previousParentRef.current;
				if (oldParentId && oldParentId !== editor.parentClientId) {
					const oldParent = wp.data.select('core/block-editor').getBlock(oldParentId);
					if (oldParent) {
						dispatch.updateBlockAttributes(oldParentId, {
							className: removeClass(oldParent.attributes.className, scopeClass)
						});
					}
				}

				if (canScopeParent) {
					const current = editor.parentBlock.attributes.className || '';
					const next = addClass(current, scopeClass);
					if (next !== current) {
						dispatch.updateBlockAttributes(editor.parentClientId, { className: next });
					}
				}
				previousParentRef.current = editor.parentClientId || '';
			}, [editor.parentClientId, canScopeParent, scopeClass]);

			const blockProps = useBlockProps({ className: 'revify-ccb-block' });
			const tabs = [
				{ name: 'base', title: __('基本（全幅）', 'revify-custom-css-block'), className: 'revify-ccb-tab' },
				{ name: 'pc', title: __('960px以上', 'revify-custom-css-block'), className: 'revify-ccb-tab' },
				{ name: 'tablet', title: __('959px以下', 'revify-custom-css-block'), className: 'revify-ccb-tab' },
				{ name: 'mobile', title: __('599px以下', 'revify-custom-css-block'), className: 'revify-ccb-tab' }
			];

			return el(
				'div',
				blockProps,
				el(BlockHeader, {
					title: __('カスタムCSS', 'revify-custom-css-block'),
					description: __('`selector` は、このカスタムCSSブロックを囲んでいる親ブロックを指定します。', 'revify-custom-css-block')
				}),
				diagnostics.warnings.map(function (warning) {
					const noticeContent = warning.key === 'duplicate-parent-scope'
						? el(
							'div',
							{ className: 'revify-ccb-scope-warning' },
							el('p', null, warning.message),
							el(
								Button,
								{
									variant: 'secondary',
									size: 'small',
									onClick: function () {
										reassignScopeForParent(editor.parentClientId, diagnostics.scopeId);
									}
								},
								__('このセクションのスコープIDを振り直す', 'revify-custom-css-block')
							)
						)
						: warning.message;

					return el(
						Notice,
						{ key: warning.key, status: warning.key === 'brace-balance' ? 'error' : 'warning', isDismissible: false },
						noticeContent
					);
				}),
				el(TabPanel, { className: 'revify-ccb-tabs', tabs: tabs }, function (tab) {
					const placeholders = {
						base: 'selector {\n\tpadding: 40px;\n}\n\nselector .title {\n\tmargin-bottom: 20px;\n}',
						pc: 'selector {\n\t/* 960px以上で上書き */\n}',
						tablet: 'selector {\n\t/* 959px以下で上書き */\n}',
						mobile: 'selector {\n\t/* 599px以下で上書き */\n}'
					};
					return el(CodeField, {
						value: tab.name === 'base' ? (props.attributes.base || props.attributes.desktop || '') : props.attributes[tab.name],
						placeholder: placeholders[tab.name],
						height: props.attributes.editorHeight || 320,
						onHeightChange: function (height) {
							if (height !== props.attributes.editorHeight) {
								props.setAttributes({ editorHeight: height });
							}
						},
						onChange: function (value) {
							const update = {};
							update[tab.name] = value;
							props.setAttributes(update);
						}
					});
				})
			);
		},
		save: function () { return null; }
	});

})(window.wp);
