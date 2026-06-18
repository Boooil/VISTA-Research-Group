/**
 * Decap CMS Custom Widget: bibtex
 *
 * 为 publication 的 cite(BibTeX 引用)字段提供两种输入方式:
 *   1. 直接在文本框粘贴 BibTeX 内容
 *   2. 点"导入 .bib 文件"按钮,用 FileReader 读取本地 .bib 文件内容填进文本框
 *
 * 两种方式最终都存进 frontmatter 的 `cite` 字段(YAML 块标量 |)。
 * cite.bib 由 Hugo 构建时从该字段生成(layouts/publication/single.bib)。
 *
 * 复用 author-widget 同款 createClass / h API(无 React hooks 依赖)。
 */
(function () {
  "use strict";

  var MAX_RETRIES = 100;
  var retries = 0;

  function register() {
    if (typeof CMS === 'undefined' || typeof createClass === 'undefined' || typeof h === 'undefined') {
      if (++retries < MAX_RETRIES) { setTimeout(register, 50); }
      else { console.error('[VISTA CMS] CMS/createClass/h not available (bibtex)'); }
      return;
    }

    var BibtexControl = createClass({
      getInitialState: function () {
        return { importError: '', importedName: '' };
      },

      handleTextChange: function (e) {
        this.props.onChange(e.target.value);
      },

      handleFile: function (e) {
        var self = this;
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          self.props.onChange(String(reader.result || ''));
          self.setState({ importError: '', importedName: file.name });
        };
        reader.onerror = function () {
          self.setState({ importError: '读取文件失败,请重试或直接粘贴' });
        };
        reader.readAsText(file);
        // 允许重复选同一文件再次触发
        e.target.value = '';
      },

      render: function () {
        var props = this.props;
        var state = this.state;
        var value = props.value ? String(props.value) : '';
        var forID = props.forID;

        return h('div', { className: 'bibtex-widget' },
          h('textarea', {
            id: forID,
            value: value,
            onChange: this.handleTextChange,
            onFocus: props.setActiveStyle,
            onBlur: props.setInactiveStyle,
            className: props.classNameWrapper,
            rows: 10,
            placeholder: '在此粘贴 BibTeX 内容,或点下方按钮导入 .bib 文件\n\n@article{key,\n  title={...},\n  author={...},\n  year={2026}\n}',
            style: { fontFamily: 'monospace', fontSize: '13px', width: '100%', lineHeight: '1.5' },
            spellCheck: false
          }),
          h('div', { style: { marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
            h('label', {
              style: {
                display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                fontSize: '13px', color: '#3b82f6', border: '1px solid #3b82f6',
                borderRadius: '6px', padding: '4px 10px', background: '#fff'
              }
            },
              '📎 导入 .bib 文件',
              h('input', {
                type: 'file',
                accept: '.bib,text/plain,text/x-bibtex',
                onChange: this.handleFile,
                style: { display: 'none' }
              })
            ),
            state.importedName ? h('span', { style: { fontSize: '12px', color: '#16a34a' } }, '✓ 已导入 ' + state.importedName) : null,
            state.importError ? h('span', { style: { fontSize: '12px', color: '#e11d48' } }, state.importError) : null,
            h('span', { style: { fontSize: '12px', color: '#888' } }, '内容会随论文保存,无需单独的 cite.bib 文件')
          )
        );
      }
    });

    try {
      CMS.registerWidget('bibtex', BibtexControl);
      console.log('[VISTA CMS] bibtex widget registered OK');
    } catch (e) {
      console.error('[VISTA CMS] Failed to register bibtex widget:', e);
    }
  }

  register();
})();
