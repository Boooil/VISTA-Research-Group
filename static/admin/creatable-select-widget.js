/**
 * Decap CMS Custom Widget: creatable-select
 *
 * Provides a searchable suggestion list while still accepting new values.
 * Use multiple: true for a tag-style string array.
 */
(function () {
  "use strict";

  var MAX_RETRIES = 100;
  var retries = 0;
  var REPO = "Boooil/VISTA-Research-Group";
  var authorValuesPromise = null;

  function cleanValue(value) {
    var text = String(value == null ? "" : value).trim();
    if ((text[0] === '"' && text[text.length - 1] === '"') ||
        (text[0] === "'" && text[text.length - 1] === "'")) {
      text = text.slice(1, -1).trim();
    }
    return text === "null" ? "" : text;
  }

  function unique(values) {
    var seen = Object.create(null);
    return values.filter(function (value) {
      var cleaned = cleanValue(value);
      if (!cleaned || seen[cleaned]) return false;
      seen[cleaned] = true;
      return true;
    }).map(cleanValue);
  }

  function extractAuthorValues(markdown) {
    var result = { role: [], user_groups: [] };
    var lines = String(markdown || "").split(/\r?\n/);

    for (var i = 0; i < lines.length; i++) {
      var roleMatch = lines[i].match(/^role:\s*(.*?)\s*$/);
      if (roleMatch) {
        var role = cleanValue(roleMatch[1]);
        if (role) result.role.push(role);
      }

      var groupsMatch = lines[i].match(/^user_groups:\s*(.*?)\s*$/);
      if (!groupsMatch) continue;

      var inline = cleanValue(groupsMatch[1]);
      if (inline && inline[0] === "[" && inline[inline.length - 1] === "]") {
        inline.slice(1, -1).split(",").forEach(function (value) {
          value = cleanValue(value);
          if (value) result.user_groups.push(value);
        });
      }

      for (var j = i + 1; j < lines.length; j++) {
        if (!/^\s+/.test(lines[j]) && lines[j].trim()) break;
        var itemMatch = lines[j].match(/^\s+-\s*(.*?)\s*$/);
        if (itemMatch) {
          var group = cleanValue(itemMatch[1]);
          if (group) result.user_groups.push(group);
        }
      }
    }

    result.role = unique(result.role);
    result.user_groups = unique(result.user_groups);
    return result;
  }

  function loadAuthorValues() {
    if (authorValuesPromise) return authorValuesPromise;

    authorValuesPromise = fetch("https://api.github.com/repos/" + REPO + "/contents/content/authors?ref=main", {
      headers: { Accept: "application/vnd.github.v3+json" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("GitHub API " + response.status);
        return response.json();
      })
      .then(function (entries) {
        if (!Array.isArray(entries)) return [];
        return Promise.all(entries
          .filter(function (entry) { return entry.type === "dir"; })
          .map(function (entry) {
            var url = "https://raw.githubusercontent.com/" + REPO + "/main/content/authors/" +
              encodeURIComponent(entry.name) + "/_index.md";
            return fetch(url).then(function (response) {
              if (!response.ok) throw new Error("GitHub Raw " + response.status);
              return response.text();
            }).catch(function () { return ""; });
          }));
      })
      .then(function (documents) {
        return documents.reduce(function (all, markdown) {
          var values = extractAuthorValues(markdown);
          all.role = all.role.concat(values.role);
          all.user_groups = all.user_groups.concat(values.user_groups);
          return all;
        }, { role: [], user_groups: [] });
      })
      .then(function (values) {
        values.role = unique(values.role);
        values.user_groups = unique(values.user_groups);
        return values;
      });

    return authorValuesPromise;
  }

  function toArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.slice();
    if (typeof value.toJS === "function") return value.toJS();
    if (typeof value.toArray === "function") return value.toArray();
    return [];
  }

  function fieldValue(field, key, fallback) {
    if (!field) return fallback;
    if (typeof field.get === "function") {
      var value = field.get(key);
      return value === undefined ? fallback : value;
    }
    return field[key] === undefined ? fallback : field[key];
  }

  function optionValue(option) {
    if (typeof option === "string") return option;
    if (option && typeof option.get === "function") {
      return option.get("value") || option.get("label") || "";
    }
    if (option && typeof option === "object") {
      return option.value || option.label || "";
    }
    return "";
  }

  function register() {
    if (typeof CMS === "undefined" || typeof createClass === "undefined" || typeof h === "undefined") {
      if (++retries < MAX_RETRIES) setTimeout(register, 50);
      else console.error("[VISTA CMS] CMS/createClass/h not available (creatable-select)");
      return;
    }

    var CreatableSelectControl = createClass({
      getInitialState: function () {
        return {
          inputValue: "",
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
        var fieldName = fieldValue(this.props.field, "name", "");
        var configured = this.getConfiguredOptions();

        // Presets should be usable immediately; remote values only enrich suggestions.
        this.setState({ suggestions: configured });

        loadAuthorValues().then(function (values) {
          if (!self._mounted) return;
          var discovered = values[fieldName] || [];
          self.setState({ suggestions: unique(configured.concat(discovered)), loaded: true });
        }).catch(function (error) {
          if (!self._mounted) return;
          console.warn("[VISTA CMS] creatable-select suggestions unavailable:", error);
          self.setState({ suggestions: configured, loaded: true, fetchError: true });
        });
      },

      componentWillUnmount: function () {
        this._mounted = false;
      },

      isMultiple: function () {
        return fieldValue(this.props.field, "multiple", false) === true;
      },

      getConfiguredOptions: function () {
        return unique(toArray(fieldValue(this.props.field, "options", [])).map(optionValue));
      },

      getItems: function () {
        return toArray(this.props.value).map(cleanValue).filter(Boolean);
      },

      getFilteredSuggestions: function () {
        var query = this.isMultiple() ? this.state.inputValue : this._searchValue || "";
        var lower = query.trim().toLowerCase();
        var selected = this.getItems();
        return this.state.suggestions.filter(function (value) {
          return selected.indexOf(value) === -1 && (!lower || value.toLowerCase().indexOf(lower) !== -1);
        }).slice(0, 10);
      },

      showAvailableSuggestions: function (query) {
        this._searchValue = query || "";
        var lower = this._searchValue.trim().toLowerCase();
        var selected = this.getItems();
        var available = this.state.suggestions.filter(function (value) {
          return selected.indexOf(value) === -1 && (!lower || value.toLowerCase().indexOf(lower) !== -1);
        });
        this.setState({ showSuggestions: available.length > 0, selectedIndex: -1 });
      },

      selectSingle: function (value) {
        this.props.onChange(cleanValue(value));
        this._searchValue = "";
        this.setState({ showSuggestions: false, selectedIndex: -1 });
      },

      addItem: function (value) {
        var cleaned = cleanValue(value);
        if (!cleaned) return;
        var items = this.getItems();
        if (items.indexOf(cleaned) === -1) this.props.onChange(items.concat([cleaned]));
        this._searchValue = "";
        this.setState({ inputValue: "", showSuggestions: false, selectedIndex: -1 });
      },

      removeItem: function (index) {
        var items = this.getItems().filter(function (_, itemIndex) { return itemIndex !== index; });
        this.props.onChange(items);
      },

      handleSingleChange: function (event) {
        var value = event.target.value;
        this.props.onChange(value);
        this.showAvailableSuggestions(value);
      },

      handleMultipleChange: function (event) {
        var value = event.target.value;
        this.setState({ inputValue: value }, function () {
          this.showAvailableSuggestions(value);
        });
      },

      handleKeyDown: function (event) {
        var suggestions = this.getFilteredSuggestions();
        var selectedIndex = this.state.selectedIndex;
        var inputValue = this.isMultiple() ? this.state.inputValue : String(this.props.value || "");

        if (event.key === "Enter") {
          event.preventDefault();
          var value = selectedIndex >= 0 && suggestions[selectedIndex] ? suggestions[selectedIndex] : inputValue;
          if (this.isMultiple()) this.addItem(value);
          else this.selectSingle(value);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          this.setState({ selectedIndex: Math.min(selectedIndex + 1, suggestions.length - 1) });
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          this.setState({ selectedIndex: Math.max(selectedIndex - 1, -1) });
        } else if (event.key === "Escape") {
          this.setState({ showSuggestions: false, selectedIndex: -1 });
        } else if (event.key === "Backspace" && this.isMultiple() && !inputValue && this.getItems().length) {
          this.removeItem(this.getItems().length - 1);
        }
      },

      handleFocus: function () {
        this.showAvailableSuggestions("");
        if (this.props.setActiveStyle) this.props.setActiveStyle();
      },

      handleBlur: function () {
        var self = this;
        if (this.isMultiple() && this.state.inputValue.trim()) this.addItem(this.state.inputValue);
        setTimeout(function () {
          if (self._mounted) self.setState({ showSuggestions: false, selectedIndex: -1 });
        }, 150);
        if (this.props.setInactiveStyle) this.props.setInactiveStyle();
      },

      render: function () {
        var self = this;
        var multiple = this.isMultiple();
        var items = this.getItems();
        var suggestions = this.getFilteredSuggestions();
        var value = multiple ? this.state.inputValue : String(this.props.value || "");
        var placeholder = fieldValue(this.props.field, "placeholder",
          multiple ? "选择已有分组，或输入新分组后按 Enter" : "选择已有身份，或直接输入新身份");

        return h("div", { className: "creatable-select-widget", style: { position: "relative" } },
          multiple && items.length ? h("div", {
            style: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }
          }, items.map(function (item, index) {
            return h("span", {
              key: item + "-" + index,
              style: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 8px", borderRadius: "4px", background: "#e0f2fe", color: "#075985", fontSize: "13px" }
            }, item, h("button", {
              type: "button",
              onClick: function () { self.removeItem(index); },
              title: "移除 " + item,
              "aria-label": "移除 " + item,
              style: { border: 0, padding: 0, background: "transparent", color: "inherit", cursor: "pointer", fontSize: "16px", lineHeight: "1" }
            }, "×"));
          })) : null,

          h("input", {
            id: this.props.forID,
            type: "text",
            value: value,
            placeholder: placeholder,
            autoComplete: "off",
            onChange: multiple ? this.handleMultipleChange : this.handleSingleChange,
            onKeyDown: this.handleKeyDown,
            onFocus: this.handleFocus,
            onBlur: this.handleBlur,
            "aria-autocomplete": "list",
            "aria-expanded": this.state.showSuggestions ? "true" : "false",
            style: { width: "100%", boxSizing: "border-box", padding: "12px", border: "1px solid #b3b3b3", borderRadius: "2px", font: "inherit" }
          }),

          this.state.showSuggestions && suggestions.length ? h("ul", {
            role: "listbox",
            style: { position: "absolute", zIndex: 20, left: 0, right: 0, margin: "4px 0 0", padding: "4px 0", maxHeight: "220px", overflowY: "auto", listStyle: "none", background: "white", border: "1px solid #d1d5db", borderRadius: "4px", boxShadow: "0 8px 20px rgba(0,0,0,.14)" }
          }, suggestions.map(function (suggestion, index) {
            return h("li", {
              key: suggestion,
              role: "option",
              "aria-selected": index === self.state.selectedIndex ? "true" : "false",
              onMouseEnter: function () { self.setState({ selectedIndex: index }); },
              onMouseDown: function (event) {
                event.preventDefault();
                if (multiple) self.addItem(suggestion);
                else self.selectSingle(suggestion);
              },
              style: { padding: "9px 12px", cursor: "pointer", background: index === self.state.selectedIndex ? "#f0f9ff" : "white", color: "#111827" }
            }, suggestion);
          })) : null,

          h("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px", marginTop: "5px", fontSize: "12px", color: "#64748b" } },
            h("span", null, multiple ? "可多选；输入新分组后按 Enter 创建" : "可选择建议，也可直接输入新的身份/职称"),
            !this.state.loaded ? h("span", null, "加载已有值中...") : null,
            this.state.fetchError ? h("span", { style: { color: "#b45309" } }, "已有值加载失败，仍可自由输入") : null
          )
        );
      }
    });

    try {
      CMS.registerWidget("creatable-select", CreatableSelectControl);
      console.log("[VISTA CMS] creatable-select widget registered OK");
    } catch (error) {
      console.error("[VISTA CMS] Failed to register creatable-select widget:", error);
    }
  }

  register();
})();
