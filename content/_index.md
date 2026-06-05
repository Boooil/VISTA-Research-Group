---
# =============================================================================
# Homepage — VISTA Research Group
# =============================================================================
title: "VISTA Research Group"
type: landing

# Hero section data (used by hero-vista block)
hero:
  headline: "VISTA Research Group"
  subheadline: "维势研究组"
  tagline: "Visualization, Intelligence, Simulation & Tactical Analysis"
  description: "聚焦三维战场态势仿真、智能推演与作战辅助分析"
  slogan: "洞察全域态势，推演未来行动"
  cta:
    - label: "Explore Research"
      url: "/research/"
      icon: "rocket"
    - label: "Latest Work"
      url: "/project/"
      icon: "flask"
    - label: "Contact Us"
      url: "/about/"
      icon: "envelope"

# Homepage Sections / Widgets
# HugoBlox block builder: each section maps to a widget in layouts/partials/blox/
sections:
  # --- Hero (custom) ---
  - block: hero-vista
    id: hero
    content:
      title: ""
      text: ""
    design:
      background:
        gradient_start: "#0a1628"
        gradient_end: "#1a3a5c"
      spacing:
        padding: ["0", "0", "0", "0"]

  # --- Research Highlights (custom) ---
  - block: research-highlights
    id: research-highlights
    content:
      title: "Research Highlights"
      subtitle: "研究方向"
      text: ""
    design:
      columns: "1"

  # --- Featured Projects ---
  - block: collection
    id: featured-projects
    content:
      title: "Featured Projects"
      subtitle: "重点成果"
      count: 6
      filters:
        folders:
          - project
        featured_only: true
      archive:
        enable: true
        text: "View All Projects →"
        url: "/project/"
    design:
      view: showcase
      columns: "2"

  # --- Latest Posts ---
  - block: collection
    id: posts
    content:
      title: "Latest Updates"
      subtitle: "成果动态"
      count: 4
      filters:
        folders:
          - post
        featured_only: false
      archive:
        enable: true
        text: "View All Posts →"
        url: "/post/"
    design:
      view: compact
      columns: "2"

  # --- Recent Publications ---
  - block: collection
    id: publications
    content:
      title: "Recent Publications"
      subtitle: "论文著作"
      count: 5
      filters:
        folders:
          - publication
        featured_only: false
      archive:
        enable: true
        text: "View All Publications →"
        url: "/publication/"
    design:
      view: citation
      columns: "2"

  # --- Team Preview ---
  - block: people
    id: team
    content:
      title: "Meet the Team"
      subtitle: "团队成员"
      user_groups:
        - Group Lead
        - Core Researchers
    design:
      show_interests: false
      show_role: true
      show_social: true
      columns: "1"
---
