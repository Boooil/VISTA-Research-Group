/**
 * urlize 一致性验证 —— 核验 Worker 端 urlizeTitle 能否复刻 Hugo 的 slug
 *
 * Hugo 规则(从现有 slug-manifest 逆向):
 *   1. 转小写
 *   2. 去除非 [字母数字/CJK/空格/-] 的字符(标点 : ， 、 等直接删除)
 *   3. 连续空白 → 单个 -
 *   4. 合并多个 -,去首尾 -
 *   5. CJK 字符原样保留
 */

// 候选实现
function urlizeTitle(title) {
  if (!title) return '';
  let s = String(title).toLowerCase();
  // 删除标点/符号:保留 字母 数字 空白 连字符 以及非 ASCII(CJK)
  // 一-鿿 CJK 统一表意；其余 ASCII 标点删除
  s = s.replace(/[^\p{L}\p{N}\s-]/gu, '');   // 删除所有非字母/数字/空白/连字符的符号(含 : ， 、 。 等)
  s = s.replace(/\s+/g, '-');                 // 空白 → -
  s = s.replace(/-+/g, '-');                  // 合并连续 -
  s = s.replace(/^-+|-+$/g, '');              // 去首尾 -
  return s;
}

// title ↔ 期望 slug(来自线上 manifest 实测)
const CASES = [
  ['Behavior Generation for Heterogeneous Agents in Urban Simulation Deduction: A Multi-Stage Approach Based on Large Language Models',
   'behavior-generation-for-heterogeneous-agents-in-urban-simulation-deduction-a-multi-stage-approach-based-on-large-language-models'],
  ['DDE-Net: Dynamic Density-Driven Estimation for Arbitrary-Oriented Object Detection',
   'dde-net-dynamic-density-driven-estimation-for-arbitrary-oriented-object-detection'],
  ['基于大语言模型的行为树自动生成方法、装置及电子设备',
   '基于大语言模型的行为树自动生成方法装置及电子设备'],
  ['TRVP: Transformer-VAE Framework for 3D Point Cloud Instance Segmentation',
   'trvp-transformer-vae-framework-for-3d-point-cloud-instance-segmentation'],
  ['UrbanMUDA: an LLM Agent-based Site Selection Approach for Urban Military Unit Deployment',
   'urbanmuda-an-llm-agent-based-site-selection-approach-for-urban-military-unit-deployment'],
  ['一种基于密度掩膜的遥感图像检测处理方法和系统',
   '一种基于密度掩膜的遥感图像检测处理方法和系统'],
  ['战场目标三维模型自动对齐方法、系统及电子设备',
   '战场目标三维模型自动对齐方法系统及电子设备'],
  // post 类型:中英混排 + 全角冒号(无空格 → 不产生 -)
  ['3D Battlefield Local Update Benchmark',
   '3d-battlefield-local-update-benchmark'],
  ['Claude Fable 5：Anthropic 迈向 Mythos 级智能的里程碑',
   'claude-fable-5anthropic-迈向-mythos-级智能的里程碑'],
  ['CMS后台编辑更改测试',
   'cms后台编辑更改测试'],
  ['用 Agent Skill 重构网页应用测试',
   '用-agent-skill-重构网页应用测试'],
  ['VISTA网站更新日志',
   'vista网站更新日志'],
];

let failed = 0;
for (const [title, expected] of CASES) {
  const got = urlizeTitle(title);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(ok ? '  ✓' : '  ✗', title.slice(0, 40));
  if (!ok) {
    console.log('      expected:', expected);
    console.log('      got     :', got);
  }
}
console.log(failed === 0 ? '\nALL MATCH — urlizeTitle 可复刻 Hugo' : `\n${failed} MISMATCH — 需调整规则`);
if (failed > 0) process.exit(1);
