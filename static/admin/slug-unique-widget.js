/**
 * Decap CMS Custom Widget: unique-slug
 *
 * 解决 page bundle (path: {{slug}}/index) 下 slug 撞名的问题:
 * Decap 对重复 slug 不报错也不覆盖,而是生成 index-1.md(破坏 Hugo page bundle,
 * 网站不显示、CMS 却列出幽灵 entry)。这是 Decap 已知缺陷(issue #7606/#3242)。
 *
 * 本 widget 在新建时实时查 GitHub API 列出 content/<type>/ 现有文件夹,
 * 若输入的 slug 已被占用 → 标红 + isValid 返回错误阻止保存。
 *
 * 行为约束:
 *   - 仅对"新建"拦截;编辑现有 entry 时该 slug 本就是自己,不拦(用初始值豁免)。
 *   - GitHub API 失败(限流/网络)→ 降级为不阻止(交给 CI 残留巡检兜底),不卡死编辑。
 *   - 同时保留格式校验(小写字母数字连字符)。
 *
 * 复用 author-widget 同款 createClass / h API。
 */
(function () {
  "use strict";

  var MAX_RETRIES = 100;
  var retries = 0;

  var REPO = 'Boooil/VISTA-Research-Group';
  var PATTERN = /^[a-z0-9][a-z0-9-]*$/;

  function register() {
    if (typeof CMS === 'undefined' || typeof createClass === 'undefined' || typeof h === 'undefined') {
      if (++retries < MAX_RETRIES) { setTimeout(register, 50); }
      else { console.error('[VISTA CMS] CMS/createClass/h not available (unique-slug)'); }
      return;
    }

    // 从 collection 推导内容类型目录:publication/post/project → content/<name>
    function contentDirFor(props) {
      try {
        var coll = props.collection;
        var name = coll && coll.get ? coll.get('name') : null;
        if (name === 'publication' || name === 'post' || name === 'project') {
          return 'content/' + name;
        }
        // 兜底:从 collection 的 folder 字段取
        var folder = coll && coll.get ? coll.get('folder') : null;
        return folder || null;
      } catch (e) { return null; }
    }

    var UniqueSlugControl = createClass({
      getInitialState: function () {
        return {
          existing: [],        // 现有文件夹名(小写)
          loaded: false,
          fetchError: false,
          initialValue: null   // 进入编辑时的初始 slug → 豁免自身
        };
      },

      componentDidMount: function () {
        this._mounted = true;
        var self = this;

        // 记录初始值(编辑现有 entry 时,它就是自己,不应被判重)
        var v = this.props.value;
        this.setState({ initialValue: v ? String(v) : null });

        var dir = contentDirFor(this.props);
        if (!dir) { this.setState({ loaded: true, fetchError: true }); return; }

        fetch('https://api.github.com/repos/' + REPO + '/contents/' + dir + '?ref=main', {
          headers: { Accept: 'application/vnd.github.v3+json' }
        })
          .then(function (res) {
            if (!res.ok) throw new Error('GitHub API ' + res.status);
            return res.json();
          })
          .then(function (data) {
            if (!self._mounted) return;
            if (Array.isArray(data)) {
              var names = data
                .filter(function (it) { return it.type === 'dir'; })
                .map(function (it) { return String(it.name).toLowerCase(); });
              self.setState({ existing: names, loaded: true });
            } else {
              self.setState({ loaded: true, fetchError: true });
            }
          })
          .catch(function (err) {
            if (!self._mounted) return;
            console.warn('[VISTA CMS] unique-slug fetch failed:', err);
            self.setState({ loaded: true, fetchError: true });
          });
      },

      componentWillUnmount: function () { this._mounted = false; },

      // 当前值是否与已有文件夹撞名(排除自身初始值)
      isDuplicate: function () {
        var v = this.props.value ? String(this.props.value).toLowerCase().trim() : '';
        if (!v) return false;
        if (this.state.initialValue && String(this.state.initialValue).toLowerCase().trim() === v) {
          return false; // 编辑自身,豁免
        }
        return this.state.existing.indexOf(v) !== -1;
      },

      // Decap 校验入口:格式错误或撞名 → 阻止保存
      isValid: function () {
        var v = this.props.value ? String(this.props.value).trim() : '';
        if (!v) return true; // 空值交给 required 校验
        if (!PATTERN.test(v)) {
          return { error: { message: 'URL 标识只能用小写字母、数字、连字符,且不能以连字符开头' } };
        }
        if (this.isDuplicate()) {
          return { error: { message: '该 URL 标识「' + v + '」已被占用,请换一个(撞名会导致文章无法正常显示)' } };
        }
        return true;
      },

      handleChange: function (e) {
        this.props.onChange(e.target.value);
      },

      render: function () {
        var props = this.props;
        var state = this.state;
        var dup = this.isDuplicate();
        var v = props.value ? String(props.value) : '';
        var badFormat = v && !PATTERN.test(v.trim());

        return h('div', { className: 'unique-slug-widget', style: { position: 'relative' } },
          h('input', {
            id: props.forID,
            type: 'text',
            value: v,
            className: (props.classNameWrapper || '') + (dup || badFormat ? ' unique-slug-invalid' : ''),
            style: (dup || badFormat) ? { borderColor: '#e11d48', boxShadow: '0 0 0 1px #e11d48' } : null,
            placeholder: '英文小写短名,如 my-paper(全站唯一)',
            onChange: this.handleChange,
            onFocus: props.setActiveStyle,
            onBlur: props.setInactiveStyle,
            autoComplete: 'off'
          }),
          h('div', { style: { fontSize: '12px', marginTop: '4px' } },
            !state.loaded ? h('span', { style: { color: '#888' } }, '检查 URL 标识可用性中...') : null,
            state.fetchError ? h('span', { style: { color: '#b45309' } }, '⚠️ 无法校验唯一性(将由构建巡检兜底),请确保填写未用过的标识') : null,
            (state.loaded && !state.fetchError && dup)
              ? h('span', { style: { color: '#e11d48', fontWeight: 'bold' } }, '✗ 「' + v + '」已被占用,换一个')
              : null,
            (state.loaded && !state.fetchError && !dup && !badFormat && v)
              ? h('span', { style: { color: '#16a34a' } }, '✓ 可用')
              : null,
            badFormat
              ? h('span', { style: { color: '#e11d48' } }, '✗ 只能小写字母/数字/连字符,不能以连字符开头')
              : null
          )
        );
      }
    });

    try {
      CMS.registerWidget('unique-slug', UniqueSlugControl);
      console.log('[VISTA CMS] unique-slug widget registered OK');
    } catch (e) {
      console.error('[VISTA CMS] Failed to register unique-slug widget:', e);
    }
  }

  register();
})();
