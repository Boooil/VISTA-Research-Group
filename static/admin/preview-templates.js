/**
 * Decap CMS Preview Templates — VISTA Research Group
 * Phase 4: 编辑器内实时预览，无需 JSX 构建，直接使用 React.createElement
 */

(function init() {
  "use strict";

  // Decap CMS 3.x 可能不全局暴露 React，从 window 获取或等待
  if (typeof React === 'undefined') { React = window.React || (window.CMS && window.CMS.React); }
  if (typeof React === 'undefined' || typeof CMS === 'undefined') {
    setTimeout(init, 200);
    return;
  }

  var R = React.createElement;
  var F = React.Fragment;

  // =========================================================================
  // Helper: 安全获取字段值
  // =========================================================================
  function get(entry, path, fallback) {
    var v = entry.getIn(["data"].concat(path.split(".")));
    return v === undefined || v === null ? (fallback || "") : v;
  }

  // =========================================================================
  // Helper: 渲染 markdown widget
  // =========================================================================
  function body(widgetFor) {
    return widgetFor("body");
  }

  // =========================================================================
  // Shell — 预览容器（模拟网站页面外观）
  // =========================================================================
  function Shell(props) {
    return R("div", { className: "preview-shell" },
      R("div", { className: "preview-shell-header" },
        R("span", { className: "preview-shell-dot", style: { backgroundColor: "#ef4444" } }),
        R("span", { className: "preview-shell-dot", style: { backgroundColor: "#f59e0b" } }),
        R("span", { className: "preview-shell-dot", style: { backgroundColor: "#22c55e" } }),
        R("span", { className: "preview-shell-label" }, "内容预览")
      ),
      R("div", { className: "preview-shell-body" }, props.children)
    );
  }

  // =========================================================================
  // 1. Post 预览 — 成果动态
  // =========================================================================
  function PostPreview(_a) {
    var entry = _a.entry, widgetFor = _a.widgetFor, getAsset = _a.getAsset;
    var title = get(entry, "title") || "（未命名）";
    var date = get(entry, "date");
    var summary = get(entry, "summary");
    var tags = get(entry, "tags");
    var image = get(entry, "image");
    var featured = get(entry, "featured");

    // 格式化日期
    var displayDate = date
      ? new Date(date).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
      : "";

    return R(Shell, null,
      // 封面图
      image && image.filename &&
        R("div", { className: "preview-featured-image", style: { background: "linear-gradient(135deg, #1e3a8a, #0f172a)", height: "180px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px 8px 0 0", color: "#fff", fontSize: "14px" } },
          "🖼️ " + image.filename + (image.caption ? " — " + image.caption : "")
        ),

      R("article", { className: "preview-post" },
        // 精选标记
        featured &&
          R("div", { className: "preview-badge" }, "⭐ 精选文章"),

        // 标题
        R("h1", { className: "preview-post-title" }, title),

        // 日期
        displayDate &&
          R("time", { className: "preview-post-date" }, displayDate),

        // 摘要
        summary &&
          R("p", { className: "preview-post-summary" }, summary),

        // 标签
        tags && tags.length > 0 &&
          R("div", { className: "preview-tags" },
            tags.map(function (t) {
              return R("span", { className: "preview-tag", key: t }, t);
            })
          ),

        R("hr", { className: "preview-divider" }),

        // Markdown 正文
        R("div", { className: "preview-markdown" }, body(widgetFor))
      )
    );
  }

  // =========================================================================
  // 2. Project 预览 — 科研项目
  // =========================================================================
  function ProjectPreview(_a) {
    var entry = _a.entry, widgetFor = _a.widgetFor;
    var title = get(entry, "title") || "（未命名项目）";
    var subtitle = get(entry, "subtitle");
    var summary = get(entry, "summary");
    var links = get(entry, "links");
    var tags = get(entry, "tags");
    var image = get(entry, "image");

    return R(Shell, null,
      image && image.filename &&
        R("div", { className: "preview-featured-image", style: { background: "linear-gradient(135deg, #1e3a8a, #0f172a)", height: "140px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px 8px 0 0", color: "#fff", fontSize: "14px" } },
          "🖼️ " + image.filename
        ),

      R("article", { className: "preview-project" },
        R("h1", { className: "preview-project-title" }, title),
        subtitle &&
          R("p", { className: "preview-project-subtitle" }, subtitle),
        summary &&
          R("p", { className: "preview-project-summary" }, summary),

        tags && tags.length > 0 &&
          R("div", { className: "preview-tags" },
            tags.map(function (t) {
              return R("span", { className: "preview-tag", key: t }, t);
            })
          ),

        links && links.length > 0 &&
          R("div", { className: "preview-links" },
            R("h3", { className: "preview-section-title" }, "🔗 外部链接"),
            links.map(function (link, i) {
              return R("a", { className: "preview-link-item", key: i, href: link.url || "#", style: { display: "block", padding: "6px 0", color: "#2563eb" } },
                (link.icon ? "[" + link.icon + "] " : "") + (link.name || "链接") + (link.url ? " → " + link.url : "")
              );
            })
          ),

        R("hr", { className: "preview-divider" }),
        R("div", { className: "preview-markdown" }, body(widgetFor))
      )
    );
  }

  // =========================================================================
  // 3. Publication 预览 — 论文著作
  // =========================================================================
  function PublicationPreview(_a) {
    var entry = _a.entry, widgetFor = _a.widgetFor;
    var title = get(entry, "title") || "（未命名论文）";
    var authors = get(entry, "authors");
    var date = get(entry, "date");
    var types = get(entry, "publication_types");
    var pub = get(entry, "publication");
    var abstract = get(entry, "abstract");
    var links = get(entry, "links");
    var featured = get(entry, "featured");
    var tags = get(entry, "tags");

    var displayDate = date
      ? new Date(date).getFullYear().toString()
      : "";

    // 类型标签映射
    var typeLabels = {
      "paper-conference": "会议论文",
      "article-journal": "期刊论文",
      "patent": "专利",
      "software": "软件著作权",
      "report": "技术报告",
      "standard": "标准规范",
      "book": "专著",
      "thesis": "学位论文"
    };

    return R(Shell, null,
      R("article", { className: "preview-publication" },
        featured &&
          R("div", { className: "preview-badge" }, "⭐ 精选论文"),

        R("h1", { className: "preview-publication-title" }, title),

        // 作者行
        authors && authors.length > 0 &&
          R("p", { className: "preview-publication-authors" },
            authors.map(function (a, i) {
              return R(F, { key: a },
                i > 0 && ", ",
                R("strong", null, a)
              );
            })
          ),

        // 发表信息
        R("p", { className: "preview-publication-venue" },
          (types && types.length > 0
            ? types.map(function (t) { return typeLabels[t] || t; }).join(" / ")
            : "") +
          (pub ? " — " + pub : "") +
          (displayDate ? ", " + displayDate : "")
        ),

        // 摘要
        abstract &&
          R("div", { className: "preview-abstract" },
            R("h3", { className: "preview-section-title" }, "摘要"),
            R("p", null, abstract)
          ),

        tags && tags.length > 0 &&
          R("div", { className: "preview-tags" },
            tags.map(function (t) {
              return R("span", { className: "preview-tag", key: t }, t);
            })
          ),

        links && links.length > 0 &&
          R("div", { className: "preview-links" },
            R("h3", { className: "preview-section-title" }, "🔗 链接"),
            links.map(function (link, i) {
              return R("a", { className: "preview-link-item", key: i, href: link.url || "#", style: { display: "block", padding: "4px 0", color: "#2563eb" } },
                (link.name || "链接") + (link.url ? " → " + link.url : "")
              );
            })
          ),

        R("hr", { className: "preview-divider" }),
        R("div", { className: "preview-markdown" }, body(widgetFor))
      )
    );
  }

  // =========================================================================
  // 4. Author 预览 — 团队成员卡片
  // =========================================================================
  function AuthorPreview(_a) {
    var entry = _a.entry, widgetFor = _a.widgetFor, getAsset = _a.getAsset;
    var title = get(entry, "title") || "（未命名）";
    var role = get(entry, "role");
    var pinyin = get(entry, "pinyin");
    var bio = get(entry, "bio");
    var interests = get(entry, "interests");
    var social = get(entry, "social");
    var orgs = get(entry, "organizations");
    var email = get(entry, "email");
    var groups = get(entry, "user_groups");
    var avatar = get(entry, "avatar_filename");

    // 角色颜色映射
    var roleColors = {
      "Group Lead": "#1e40af",
      "Core Researcher": "#0369a1",
      "在读博士": "#15803d",
      "在读硕士": "#a16207",
      "研究员": "#7c3aed"
    };

    return R(Shell, null,
      R("div", { className: "preview-author-card" },
        // 头像区域
        R("div", { className: "preview-author-header" },
          R("div", { className: "preview-author-avatar", style: { backgroundColor: "#1e3a8a", color: "#fff" } },
            avatar
              ? "🖼️"
              : title.charAt(0)
          ),
          R("div", { className: "preview-author-info" },
            R("h2", { className: "preview-author-name" }, title),
            pinyin &&
              R("p", { className: "preview-author-pinyin" }, pinyin),
            role &&
              R("span", { className: "preview-author-role", style: { backgroundColor: roleColors[role] || "#64748b" } }, role),
            groups && groups.length > 0 &&
              R("div", { className: "preview-author-groups", style: { marginTop: "6px" } },
                groups.map(function (g) {
                  return R("span", { className: "preview-tag", key: g, style: { fontSize: "11px" } }, g);
                })
              )
          )
        ),

        bio &&
          R("p", { className: "preview-author-bio" }, bio),

        email &&
          R("p", { className: "preview-author-email" }, "✉️ " + email),

        orgs && orgs.length > 0 &&
          R("div", { className: "preview-author-orgs" },
            orgs.map(function (org, i) {
              return R("a", {
                key: i,
                className: "preview-link-item",
                href: org.url || "#",
                style: { display: "inline-block", marginRight: "8px", color: "#2563eb", fontSize: "13px" }
              }, org.name);
            })
          ),

        interests && interests.length > 0 &&
          R("div", { className: "preview-interests" },
            R("h4", { className: "preview-section-title" }, "研究方向"),
            interests.map(function (item) {
              return R("span", { className: "preview-interest-item", key: item }, item);
            })
          ),

        social && social.length > 0 &&
          R("div", { className: "preview-social-links" },
            R("h4", { className: "preview-section-title" }, "社交链接"),
            social.map(function (s, i) {
              return R("a", {
                key: i,
                className: "preview-social-item",
                href: s.link || "#",
                style: { display: "inline-block", marginRight: "10px", padding: "4px 8px", background: "#f1f5f9", borderRadius: "4px", fontSize: "12px", color: "#334155", textDecoration: "none" }
              }, (s.icon ? "[" + s.icon + "] " : "") + (s.link || ""));
            })
          ),

        R("hr", { className: "preview-divider" }),
        R("div", { className: "preview-markdown" }, body(widgetFor))
      )
    );
  }

  // =========================================================================
  // 5. Pages 预览 — Research / Resources / About
  // =========================================================================
  function PagePreview(_a) {
    var entry = _a.entry, widgetFor = _a.widgetFor;
    var title = get(entry, "title") || "（未命名页面）";
    var subtitle = get(entry, "subtitle");
    var summary = get(entry, "summary");

    return R(Shell, null,
      R("article", { className: "preview-page" },
        R("h1", { className: "preview-page-title" }, title),
        subtitle &&
          R("p", { className: "preview-page-subtitle" }, subtitle),
        summary &&
          R("p", { className: "preview-page-summary" }, summary),
        R("hr", { className: "preview-divider" }),
        R("div", { className: "preview-markdown" }, body(widgetFor))
      )
    );
  }

  // =========================================================================
  // 6. Homepage 预览 — 首页（仅 title）
  // =========================================================================
  function HomepagePreview(_a) {
    var entry = _a.entry;
    var title = get(entry, "title") || "VISTA Research Group";

    return R(Shell, null,
      R("div", { className: "preview-homepage" },
        R("div", { className: "preview-homepage-hero", style: { background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)", padding: "60px 30px", textAlign: "center", borderRadius: "8px", color: "#fff" } },
          R("h1", { style: { fontSize: "28px", fontWeight: "700", margin: "0 0 10px" } }, title),
          R("p", { style: { opacity: "0.7", fontSize: "13px", margin: "0" } }, "维势研究组 · Visualization, Intelligence, Simulation & Tactical Analysis")
        ),
        R("div", { style: { padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "13px" } },
          "⚠️ 首页的 sections 区块配置（Hero / Features / Collections / Team）",
          R("br"),
          "请通过代码编辑 content/_index.md"
        )
      )
    );
  }

  // =========================================================================
  // 注册所有预览模板
  // =========================================================================
  CMS.registerPreviewTemplate("post", PostPreview);
  CMS.registerPreviewTemplate("project", ProjectPreview);
  CMS.registerPreviewTemplate("publication", PublicationPreview);
  CMS.registerPreviewTemplate("authors", AuthorPreview);
  CMS.registerPreviewTemplate("pages", PagePreview);
  CMS.registerPreviewTemplate("homepage", HomepagePreview);

})();
