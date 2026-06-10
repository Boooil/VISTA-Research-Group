---
title: "VISTA Research Group"
type: landing

sections:
  # --- Hero ---
  - block: hero
    id: hero
    content:
      title: "VISTA Research Group"
      text: |
        维势研究组<br>
        *Visualization, Intelligence, Simulation & Tactical Analysis*<br><br>
        聚焦三维战场态势仿真、智能推演与作战辅助分析<br><br>
        **"洞察全域态势，推演未来行动"**
    design:
      no_padding: false
      background:
        gradient:
          start: "#1e3a8a"            
          end: "#0f172a"               
          direction: "135"             
        text_color_light: true

  # --- Research Highlights ---
  - block: features
    id: research-highlights
    content:
      title: "Research Highlights"
      subtitle: "研究方向"
      items:
        - title: "3D Battlefield Situation Visualization"
          subtitle: "三维战场态势可视化"
          description: "面向多尺度作战场景的三维态势表达与交互分析。通过多源数据融合、分层渲染和交互探索，实现从战略全局到战术细节的无缝感知。"
          icon: "viewfinder-circle"
        - title: "Simulation & Wargaming"
          subtitle: "仿真建模与推演分析"
          description: "基于多智能体技术的仿真推演框架。组件化实体建模、可配置行为规则、灵活想定编辑，支撑多粒度推演分析。"
          icon: "command-line"
        - title: "Decision Intelligence"
          subtitle: "智能评估与辅助决策"
          description: "面向复杂战场环境的方案智能评估方法。多维度指标体系、多目标优化排序、对抗推演验证与人机协同分析。"
          icon: "presentation-chart-bar"
    design:
      columns: "3"

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
      view: card
      columns: "2"

  # --- Latest Posts ---
  - block: collection
    id: posts
    content:
      title: "Latest Updates"
      subtitle: "动态"
      count: 4
      filters:
        folders:
          - post
      archive:
        enable: true
        text: "View All Posts →"
        url: "/post/"
    design:
      view: date-title-summary
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
      archive:
        enable: true
        text: "View All Publications →"
        url: "/publication/"
    design:
      view: citation
      columns: "2"

  # --- Team Preview ---
  - block: team-showcase
    id: team
    content:
      title: "Meet the Team"
      subtitle: "团队成员"
      user_groups:
        - 在读博士
        - 在读硕士
        - 研究员
    design:
      show_interests: true
      show_role: true
      show_social: true
      show_organizations: truexiufu
---
