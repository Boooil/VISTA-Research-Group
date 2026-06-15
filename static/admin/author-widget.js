/**
 * Decap CMS Custom Widget: author-list
 *
 * 解决 publication/post 编辑时作者只能从已有 Team 成员中选择的限制。
 * 提供带自动补全（下拉建议）的自由文本输入：
 *   1. 从下拉建议中选择团队成员（自动补全来自 GitHub API）
 *   2. 输入自定义作者姓名（无需加入 Team 列表）
 *
 * 数据格式：YAML 字符串数组，与现有模板完全兼容。
 *
 * 使用 Decap CMS 官方支持的 createClass / h API（无 React hooks 依赖）。
 */
(function () {
  "use strict";

  // 等待 CMS 全局就绪后注册
  var MAX_RETRIES = 100;
  var retries = 0;

  function register() {
    if (typeof CMS === 'undefined' || typeof createClass === 'undefined' || typeof h === 'undefined') {
      if (++retries < MAX_RETRIES) {
        setTimeout(register, 50);
      } else {
        console.error('[VISTA CMS] CMS/createClass/h not available after max retries');
      }
      return;
    }

    // GitHub API — 获取 content/authors/ 下的目录列表（即团队成员 pinyin）
    var GITHUB_API = 'https://api.github.com/repos/Boooil/VISTA-Research-Group/contents/content/authors';

    // =========================================================================
    // AuthorListControl — 自定义控件 (createClass)
    // =========================================================================
    var AuthorListControl = createClass({
      getInitialState: function () {
        return {
          inputValue: '',
          teamMembers: [],
          suggestions: [],
          showSuggestions: false,
          selectedIndex: -1,
          loaded: false,
          fetchError: false
        };
      },

      componentDidMount: function () {
        this._mounted = true;
        var self = this;

        // 从 GitHub API 获取团队成员列表
        fetch(GITHUB_API, {
          headers: { Accept: 'application/vnd.github.v3+json' }
        })
          .then(function (res) {
            if (!res.ok) throw new Error('GitHub API error: ' + res.status);
            return res.json();
          })
          .then(function (data) {
            if (!self._mounted) return;
            if (Array.isArray(data)) {
              var names = data
                .filter(function (item) { return item.type === 'dir'; })
                .map(function (item) { return item.name; });
              self.setState({ teamMembers: names, loaded: true });
            } else {
              self.setState({ loaded: true, fetchError: true });
            }
          })
          .catch(function (err) {
            if (!self._mounted) return;
            console.warn('[VISTA CMS] Failed to fetch team members:', err);
            self.setState({ loaded: true, fetchError: true });
          });
      },

      componentWillUnmount: function () {
        this._mounted = false;
      },

      // 获取当前值数组
      getItems: function () {
        var v = this.props.value;
        if (!v) return [];
        if (Array.isArray(v)) return v.slice();
        if (v.toArray) return v.toArray();
        return [];
      },

      // 更新建议列表
      updateSuggestions: function (text) {
        var trimmed = (text || '').trim();
        if (!trimmed) {
          this.setState({ suggestions: [], showSuggestions: false, selectedIndex: -1 });
          return;
        }
        var lower = trimmed.toLowerCase();
        var items = this.getItems();
        var filtered = this.state.teamMembers.filter(function (name) {
          return name.toLowerCase().indexOf(lower) !== -1 && items.indexOf(name) === -1;
        });
        this.setState({
          suggestions: filtered.slice(0, 8),
          showSuggestions: filtered.length > 0,
          selectedIndex: -1
        });
      },

      // 添加作者
      addAuthor: function (name) {
        var trimmed = name.trim();
        if (!trimmed) return;
        var items = this.getItems();
        if (items.indexOf(trimmed) !== -1) {
          // 已存在，清空输入
          this.setState({ inputValue: '', showSuggestions: false, selectedIndex: -1 });
          return;
        }
        var newItems = items.concat([trimmed]);
        this.props.onChange(newItems);
        this.setState({ inputValue: '', showSuggestions: false, selectedIndex: -1 });
      },

      // 删除作者
      removeAuthor: function (index) {
        var items = this.getItems();
        var newItems = items.filter(function (_, i) { return i !== index; });
        this.props.onChange(newItems.length > 0 ? newItems : []);
      },

      // 输入变更
      handleInputChange: function (e) {
        var text = e.target.value;
        this.setState({ inputValue: text });
        this.updateSuggestions(text);
      },

      // 键盘事件
      handleKeyDown: function (e) {
        var self = this;
        var inputValue = this.state.inputValue;
        var suggestions = this.state.suggestions;
        var selectedIndex = this.state.selectedIndex;
        var items = this.getItems();

        if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            this.addAuthor(suggestions[selectedIndex]);
          } else if (inputValue.trim()) {
            this.addAuthor(inputValue);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.setState({
            selectedIndex: Math.min(selectedIndex + 1, suggestions.length - 1)
          });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.setState({
            selectedIndex: Math.max(selectedIndex - 1, -1)
          });
        } else if (e.key === 'Escape') {
          this.setState({ showSuggestions: false, selectedIndex: -1 });
        } else if (e.key === 'Backspace' && inputValue === '' && items.length > 0) {
          this.removeAuthor(items.length - 1);
        }
      },

      // 焦点事件
      handleFocus: function () {
        if (this.state.teamMembers.length > 0) {
          this.updateSuggestions(this.state.inputValue);
        }
      },

      handleBlur: function () {
        var self = this;
        setTimeout(function () {
          if (self._mounted) {
            self.setState({ showSuggestions: false });
          }
        }, 200);
      },

      // === 渲染 ===
      render: function () {
        var self = this;
        var props = this.props;
        var state = this.state;
        var items = this.getItems();
        var field = props.field;
        var forID = props.forID;
        var min = field.get ? field.get('min') : undefined;

        // 匹配高亮
        function highlightMatch(name, query) {
          if (!query.trim()) return name;
          var lowerName = name.toLowerCase();
          var lowerQuery = query.toLowerCase();
          var idx = lowerName.indexOf(lowerQuery);
          if (idx === -1) return name;
          return [
            name.slice(0, idx),
            h('strong', { className: 'author-list-match' }, name.slice(idx, idx + query.length)),
            name.slice(idx + query.length)
          ];
        }

        return h('div', { className: 'author-list-widget', style: { position: 'relative' } },

          // ===== Chips =====
          items.length > 0 ? h('div', { className: 'author-list-chips' },
            items.map(function (name, i) {
              return h('span', { key: 'author-' + i, className: 'author-list-chip' },
                h('span', { className: 'author-list-chip-name' }, name),
                h('button', {
                  type: 'button',
                  className: 'author-list-chip-remove',
                  onClick: function () { self.removeAuthor(i); },
                  title: '移除 ' + name,
                  'aria-label': '移除 ' + name
                }, '×')
              );
            })
          ) : null,

          // ===== 输入框 =====
          h('div', { className: 'author-list-input-wrapper' },
            h('input', {
              id: forID,
              type: 'text',
              value: state.inputValue,
              placeholder: (state.loaded && !state.fetchError)
                ? '搜索团队成员或自由输入自定义作者...'
                : '输入作者姓名...',
              className: 'author-list-input',
              onChange: this.handleInputChange,
              onFocus: this.handleFocus,
              onBlur: this.handleBlur,
              onKeyDown: this.handleKeyDown,
              autoComplete: 'off',
              'aria-autocomplete': 'list',
              'aria-expanded': state.showSuggestions ? 'true' : 'false'
            }),

            // ===== 下拉建议 =====
            state.showSuggestions ? h('ul', {
              className: 'author-list-suggestions',
              role: 'listbox'
            },
              state.suggestions.map(function (name, i) {
                return h('li', {
                  key: name,
                  className: 'author-list-suggestion' + (i === state.selectedIndex ? ' author-list-suggestion--active' : ''),
                  role: 'option',
                  'aria-selected': i === state.selectedIndex ? 'true' : 'false',
                  onMouseDown: function (e) {
                    e.preventDefault();
                    self.addAuthor(name);
                  },
                  onMouseEnter: function () {
                    self.setState({ selectedIndex: i });
                  }
                }, highlightMatch(name, state.inputValue));
              })
            ) : null
          ),

          // ===== 底部状态 =====
          h('div', { className: 'author-list-footer' },
            // 加载状态
            !state.loaded && !state.fetchError ? h('span', { className: 'author-list-status' },
              h('span', { className: 'author-list-spinner' }),
              ' 加载团队成员列表中...'
            ) : null,
            state.fetchError ? h('span', {
              className: 'author-list-status author-list-status--warning'
            }, '⚠️ 团队成员列表加载失败，仍可自由输入') : null,
            h('span', { className: 'author-list-count' },
              items.length + ' 位作者' + (min ? ' (最少 ' + min + ' 位)' : '')
            )
          )
        );
      }
    });

    // =========================================================================
    // 注册
    // =========================================================================
    try {
      CMS.registerWidget('author-list', AuthorListControl);
      console.log('[VISTA CMS] author-list widget registered OK');
    } catch (e) {
      console.error('[VISTA CMS] Failed to register author-list widget:', e);
    }
  }

  // 启动轮询
  register();
})();
