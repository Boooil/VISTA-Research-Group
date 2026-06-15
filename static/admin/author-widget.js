/**
 * Decap CMS Custom Widget: author-list
 *
 * 解决 publication/post 编辑时作者只能从已有团队成员中选择的限制。
 * 提供带自动补全（下拉建议）的自由文本输入，同时支持：
 *   1. 从下拉框中选择已有团队成员（自动补全来自 GitHub API）
 *   2. 输入自定义作者姓名（无需加入 Team 列表）
 *
 * 数据格式：存储为 YAML 字符串数组，与现有模板完全兼容。
 */

(function () {
  "use strict";

  // 等待 CMS 和 React 就绪
  var MAX_RETRIES = 50;
  var retries = 0;

  function init() {
    if (typeof CMS === 'undefined' || typeof React === 'undefined') {
      if (++retries < MAX_RETRIES) {
        setTimeout(init, 100);
      }
      return;
    }

    var R = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useRef = React.useRef;
    var useCallback = React.useCallback;
    var useMemo = React.useMemo;

    // GitHub API 配置
    var GITHUB_API = 'https://api.github.com/repos/Boooil/VISTA-Research-Group/contents/content/authors';

    // =========================================================================
    // AuthorListControl — 自定义控件
    // =========================================================================
    function AuthorListControl(props) {
      var value = props.value;
      var onChange = props.onChange;
      var forID = props.forID;
      var field = props.field;

      // 将 Immutable.List 或 JS Array 转为 JS Array
      var items = useMemo(function () {
        if (!value) return [];
        if (Array.isArray(value)) return value.slice();
        if (value.toArray) return value.toArray();
        return [];
      }, [value]);

      var _a = useState(''), inputValue = _a[0], setInputValue = _a[1];
      var _b = useState([]), teamMembers = _b[0], setTeamMembers = _b[1];
      var _c = useState([]), suggestions = _c[0], setSuggestions = _c[1];
      var _d = useState(false), showSuggestions = _d[0], setShowSuggestions = _d[1];
      var _e = useState(-1), selectedIndex = _e[0], setSelectedIndex = _e[1];
      var _f = useState(false), loaded = _f[0], setLoaded = _f[1];
      var _g = useState(false), error = _g[0], setError = _g[1];

      var inputRef = useRef(null);
      var listRef = useRef(null);

      // 组件挂载时从 GitHub API 获取团队成员列表
      useEffect(function () {
        var cancelled = false;
        fetch(GITHUB_API, {
          headers: { Accept: 'application/vnd.github.v3+json' }
        })
          .then(function (res) {
            if (!res.ok) throw new Error('GitHub API error: ' + res.status);
            return res.json();
          })
          .then(function (data) {
            if (cancelled) return;
            if (Array.isArray(data)) {
              var names = data
                .filter(function (item) { return item.type === 'dir'; })
                .map(function (item) { return item.name; });
              setTeamMembers(names);
            }
            setLoaded(true);
          })
          .catch(function () {
            if (!cancelled) {
              setError(true);
              setLoaded(true);
            }
          });
        return function () { cancelled = true; };
      }, []);

      // 根据输入过滤建议
      var updateSuggestions = useCallback(function (text) {
        var trimmed = text.trim();
        if (!trimmed) {
          setSuggestions([]);
          setShowSuggestions(false);
          setSelectedIndex(-1);
          return;
        }
        var lower = trimmed.toLowerCase();
        var filtered = teamMembers.filter(function (name) {
          return name.toLowerCase().indexOf(lower) !== -1;
        });
        // 同时过滤掉已添加的作者
        filtered = filtered.filter(function (name) {
          return items.indexOf(name) === -1;
        });
        setSuggestions(filtered.slice(0, 8));
        setShowSuggestions(filtered.length > 0);
        setSelectedIndex(-1);
      }, [teamMembers, items]);

      // 添加作者
      var addAuthor = useCallback(function (name) {
        var trimmed = name.trim();
        if (!trimmed) return;
        if (items.indexOf(trimmed) !== -1) {
          // 已存在，清空输入
          setInputValue('');
          setShowSuggestions(false);
          setSelectedIndex(-1);
          return;
        }
        var newItems = items.concat([trimmed]);
        onChange(newItems);
        setInputValue('');
        setShowSuggestions(false);
        setSelectedIndex(-1);
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, [items, onChange]);

      // 删除作者
      var removeAuthor = useCallback(function (index) {
        var newItems = items.filter(function (_, i) { return i !== index; });
        onChange(newItems.length > 0 ? newItems : []);
      }, [items, onChange]);

      // 键盘事件处理
      var handleKeyDown = useCallback(function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            addAuthor(suggestions[selectedIndex]);
          } else if (inputValue.trim()) {
            addAuthor(inputValue);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(function (prev) {
            return Math.min(prev + 1, suggestions.length - 1);
          });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(function (prev) { return Math.max(prev - 1, -1); });
        } else if (e.key === 'Escape') {
          setShowSuggestions(false);
          setSelectedIndex(-1);
        } else if (e.key === 'Backspace' && inputValue === '' && items.length > 0) {
          // 输入为空时按退格键删除最后一个作者
          removeAuthor(items.length - 1);
        }
      }, [inputValue, suggestions, selectedIndex, items, addAuthor, removeAuthor]);

      // 输入变更
      var handleInputChange = useCallback(function (e) {
        var text = e.target.value;
        setInputValue(text);
        updateSuggestions(text);
      }, [updateSuggestions]);

      // 获得焦点时显示建议
      var handleFocus = useCallback(function () {
        if (teamMembers.length > 0) {
          updateSuggestions(inputValue);
        }
      }, [teamMembers, inputValue, updateSuggestions]);

      // 失去焦点时延迟隐藏建议（让 mousedown 有机会触发）
      var handleBlur = useCallback(function () {
        setTimeout(function () { setShowSuggestions(false); }, 200);
      }, []);

      // min/max 提示
      var min = field.get('min');
      var max = field.get('max');
      var hint = field.get('hint');

      return R('div', { className: 'author-list-widget', style: { position: 'relative' } },

        // ===== 已添加的作者 Chips =====
        items.length > 0 && R('div', { className: 'author-list-chips' },
          items.map(function (name, i) {
            return R('span', {
              key: 'author-' + i,
              className: 'author-list-chip'
            },
              R('span', { className: 'author-list-chip-name' }, name),
              R('button', {
                type: 'button',
                className: 'author-list-chip-remove',
                onClick: function () { removeAuthor(i); },
                title: '移除 ' + name,
                'aria-label': '移除 ' + name
              }, '×')
            );
          })
        ),

        // ===== 输入区域 =====
        R('div', { className: 'author-list-input-wrapper', ref: listRef },
          R('input', {
            ref: inputRef,
            id: forID,
            type: 'text',
            value: inputValue,
            placeholder: (loaded && !error)
              ? '输入作者姓名（可从团队成员中选择，也可自由输入）...'
              : '输入作者姓名...',
            className: 'author-list-input',
            onChange: handleInputChange,
            onFocus: handleFocus,
            onBlur: handleBlur,
            onKeyDown: handleKeyDown,
            autoComplete: 'off',
            'aria-autocomplete': 'list',
            'aria-expanded': showSuggestions ? 'true' : 'false'
          }),

          // ===== 下拉建议列表 =====
          showSuggestions && R('ul', {
            className: 'author-list-suggestions',
            role: 'listbox'
          },
            suggestions.map(function (name, i) {
              return R('li', {
                key: name,
                className: 'author-list-suggestion' + (i === selectedIndex ? ' author-list-suggestion--active' : ''),
                role: 'option',
                'aria-selected': i === selectedIndex ? 'true' : 'false',
                onMouseDown: function (e) {
                  e.preventDefault();
                  addAuthor(name);
                },
                onMouseEnter: function () { setSelectedIndex(i); }
              },
                // 高亮匹配的文本
                (function () {
                  var lowerInput = inputValue.toLowerCase();
                  var lowerName = name.toLowerCase();
                  var idx = lowerName.indexOf(lowerInput);
                  if (idx === -1 || !inputValue.trim()) return name;
                  var before = name.slice(0, idx);
                  var match = name.slice(idx, idx + inputValue.length);
                  var after = name.slice(idx + inputValue.length);
                  return R('span', null,
                    before,
                    R('strong', { className: 'author-list-match' }, match),
                    after
                  );
                })()
              );
            })
          )
        ),

        // ===== 加载状态 / 错误提示 / 计数提示 =====
        R('div', { className: 'author-list-footer' },
          !loaded && !error && R('span', { className: 'author-list-status' },
            R('span', { className: 'author-list-spinner' }),
            ' 正在加载团队成员列表...'
          ),
          error && R('span', { className: 'author-list-status author-list-status--warning' },
            '⚠️ 团队成员列表加载失败，仍可自由输入自定义作者'
          ),
          R('span', { className: 'author-list-count' },
            items.length, ' 位作者',
            min ? ' (最少 ' + min + ' 位)' : ''
          )
        ),

        // ===== 原始 hint（如配置了） =====
        hint && R('p', { className: 'author-list-hint' }, '💡 ' + hint)
      );
    }

    // =========================================================================
    // 注册自定义 Widget
    // =========================================================================
    CMS.registerWidget('author-list', AuthorListControl);

    console.log('[VISTA CMS] author-list custom widget registered');
  }

  // 启动初始化
  init();
})();
