# 内容重写交付记录

## 当前状态：八篇书评重新写作（2026-09-14）

用户否定已上线的八篇 reading-* 书评：前言或单一片段加封面不能代替书评。下方旧轮次的审读记录仅是历史，不代表用户接受质量。本轮以 `a2611dc2e245809cb1cc55e7f2456076b7bbacbd` 为本工作区基线，完全替换八篇正文、标题和摘要；日期、slug、category、tags保持不变，其余51篇无改动。

两位资料代理查真实读者长短评、书内例子和相关原研究，主笔独立写八篇，编辑通读后明确退回三篇薄弱稿，再逐项修正。书评允许评价好坏，不编造购买、读完时间、熬夜、疗愈或执行方法的经历；也不把评论原句换个主语搬来。小说结局限定网络版，朱莉收银工作核对时序，芯片工艺注明霍尼贡献，练琴与汽车例对照实际书内材料，汉森相关研究不被用来反推书遗漏条件。

六张既有书封及出处沿用，无新素材、样式或实验改动。稿件围绕人物/叙事、方法解释、读者争议展开，不保留前言摘记作为主体，也不为每篇都凑正反评价与推荐尾段。

本轮交付由“博客施工 (2)”集成发布，已同步用户要求。主施工正处理另两项实验，按最新main接入本轮独立提交，不以本工作区整树覆盖。最终上线结果待回执与八篇公网正文核对。

本轮本地验证：`npm run check` 为0 errors、0 warnings、2个已有XMLValidator弃用hints；最终 `npm run build` 成功（71页面，59篇搜索索引），八篇正文均渲染、六张封面产物存在。与本轮基线对照确认只改八篇，slug/date/category/tags逐项相同。无功能代码改动，未新增测试或启动浏览器/预览。独立编辑退回的问题已逐项处理；其将副标题“信念”误改为“信仰”的建议经书目反查后撤销，保留正确书名。项目写作规则补充书评与片段摘记的区别。

## 历史：第二轮

用户已否决上一轮稿件质量。本轮从 `4f06f2e3ab38788525f07307b0e9c28f982dc22f` 重新施工；旧稿和技术检查仅保留在 Git 历史，不继承完成状态。

## 本轮执行范围

1. 逐篇找出真正值得解释的问题，重查论文或官方资料，记录实际来源。
2. 重构标题、摘要和全文，用清楚的例子解释机制；保留原代码、有效链接和历史事实边界，slug/date/category等不动。
3. 作者逐段复核后交独立读者检查具体可读性、模板结构、机制遗漏和无依据经历，再按问题返修。
4. 按内容批次提交，仅文章、必要图与本记录；技术构建/链接/图片检查与用户质量认可分开报告。不发布。

本地已完整读取 `.agents/skills/humanizer/SKILL.md`，policy `allow_implicit_invocation:true`；应用项目工作方法与 ponytail full。两个独立作者负责24篇研究笔记，主编辑负责26篇项目记录与旧文；完成后交叉审查未参与创作的文章。5个外站来源仍待确认。

## 逐篇进度

| 文件 | 选定问题及结构缺陷 | 本轮来源/实质变化/图 | 独立审查与返修 | 状态 |
| --- | --- | --- | --- | --- |
| `ai-reader-2026-04-07-not-lack-of-information.md` | RSS 越订越多，我想先知道该读哪篇；旧稿术语与机制衔接不足 | https://miniflux.app/docs/api.html；从每天扫描 RSS 标题的困扰出发，确定 AI Reader 的第一步：复用 Miniflux 收集文章，用分维度评分帮助选择下一篇。；使用正文例子或表格，无新增图 | 2026编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `ai-reader-2026-04-19-technical-choices.md` | AI Reader 选型：一篇文章经过哪些服务；旧稿术语与机制衔接不足 | https://miniflux.app/docs/api.html；https://nextjs.org/docs/app/guides/backend-for-frontend；沿文章抓取、评分、展示和问答的路径，解释 Miniflux、Postgres、Next.js 与 Python worker 的分工，以及入口认证为何单独处理。；使用正文例子或表格，无新增图 | 2026编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `ai-reader-2026-05-11-vps-infra-start.md` | VPS 配置改了，容器为什么还在用旧值；旧稿术语与机制衔接不足 | https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/；https://caddyserver.com/docs/caddyfile/concepts#environment-variables；沿环境变量、配置模板和容器实际文件检查 AI Reader 的启动问题，区分写好的配置与服务已经加载的配置。；使用正文例子或表格，无新增图 | 2026编辑：补变量传递实例，区分.env/Compose/容器/Caddy | 独立审读与返修复核完成 |
| `ai-reader-2026-05-13-ai-reader-workbench.md` | 工作台空列表：一次请求究竟从哪里取数；旧稿术语与机制衔接不足 | https://nextjs.org/docs/app/guides/backend-for-frontend；https://miniflux.app/docs/api.html；三栏工作台接通后，沿公网自调用和用户状态读写排查空列表，再处理流式回答与实际部署路径。；使用正文例子或表格，无新增图 | 2026编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `ai-reader-2026-05-15-productization-and-cicd.md` | 回答已经生成，阅读为什么还不顺手；旧稿术语与机制衔接不足 | https://motion.dev/docs/react-animate-presence；https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments；从原样显示的 Markdown 和突兀收起的抽屉谈起，记录阅读页整理、交互复用以及镜像部署流程的接入。；使用正文例子或表格，无新增图 | 2026编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `ai-reader-2026-05-20-feed-quality-governance.md` | 隐藏一个订阅源，为什么不该丢掉已选文章；旧稿术语与机制衔接不足 | https://miniflux.app/docs/api.html；正文质量统计影响默认信息流，人工标记过的线索仍需保留；这篇沿隐藏、排序和补页三个实际行为解释实现。；使用正文例子或表格，无新增图 | 2026编辑：历史Git核实全局最多300后按源分组，补高频源样本偏差 | 独立审读与返修复核完成 |
| `ai-reader-2026-05-28-event-driven-scoring-service.md` | 文章到了就评分：把定时 Worker 接成内部服务；旧稿术语与机制衔接不足 | https://miniflux.app/docs/webhooks.html；https://docs.docker.com/compose/how-tos/networking/；沿新文章与单篇重评两条路径解释评分服务，再区分请求触发、服务存活和模型结果有效这几种状态。；使用正文例子或表格，无新增图 | 2026编辑：核Miniflux不重试，补原始body验签与项目实现边界 | 独立审读与返修复核完成 |
| `ai-reader-2026-06-02-from-rss-list-to-research-workbench.md` | 读完以后去哪找：整理 AI Reader 的候选与项目状态；旧稿术语与机制衔接不足 | https://miniflux.app/docs/api.html；把新到、候选和已立项映射到具体存储与阅读动作，并解释默认列表、隐藏源与专注页如何保留一篇文章的后续去向。；使用正文例子或表格，无新增图 | 2026编辑：历史Git核实300范围，保留标签与候选状态边界 | 独立审读与返修复核完成 |
| `medi-ac-2026-02-08-why-dual-track.md` | 一句话还没问清，为什么先生成了一整页报告；旧稿术语与机制衔接不足 | https://docs.langchain.com/oss/python/langgraph/graph-api；从问诊教学演示的第一轮交互出发，把短追问与阶段性证据报告分成 A/B 两条线，并限定各自的任务。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `medi-ac-2026-02-17-four-containers.md` | 四个容器都在运行，演示环境就准备好了吗；旧稿术语与机制衔接不足 | https://docs.pydantic.dev/latest/concepts/pydantic_settings/；M1 先建立启动和依赖检查顺序，说明 FastAPI、Postgres、Qdrant 与 Neo4j 的分工，以及环境变量怎样进入应用。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `medi-ac-2026-02-23-ingest-pipeline.md` | 检索查不到资料，先看资料怎样进入索引；旧稿术语与机制衔接不足 | https://docs.docker.com/compose/how-tos/networking/；https://qdrant.tech/documentation/concepts/collections/；将同一批 Markdown 片段送入 Qdrant 与 BM25，并单独导入 Neo4j 图数据；沿导入路径解释切块、向量维度和运行地址。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `medi-ac-2026-03-01-retrieval-hot-switch.md` | 同一个问题，分别交给 Hybrid 和 GraphRAG；旧稿术语与机制衔接不足 | https://docs.langchain.com/oss/python/langgraph/graph-api；以一次请求只选一条检索链的方式观察召回差异，通过 recall_bundle 统一上层输入，同时保留两条链的数据与机制差别。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `medi-ac-2026-03-05-adapters-layer.md` | 测试一次编排，为什么要连上所有外部服务；旧稿术语与机制衔接不足 | https://docs.pytest.org/en/stable/how-to/monkeypatch.html；用两个薄 adapter 集中模型和检索调用，让节点保留业务决定，并通过固定返回值单独检查状态与分支。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `medi-ac-2026-03-13-langgraph-dual-flow.md` | A/B 并行生成，为什么用户还要等较慢的报告；旧稿术语与机制衔接不足 | https://docs.langchain.com/oss/python/langgraph/graph-api；沿 /v1/dual 的状态传递走完一次请求：共享改写与召回，再分支生成并汇合；用这条路径解释 LangGraph 与 trace 的用途。；新增图 /content-diagrams/medi-dual-sync.svg | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `medi-ac-2026-03-17-b-line-judge-loop.md` | 报告写满了，证据还缺什么：B 线追加检索；旧稿术语与机制衔接不足 | https://docs.pytest.org/en/stable/how-to/monkeypatch.html；让 judge 对照草稿、问题与召回材料指出缺口，再控制追加检索及停止；说明这类检查能验证的流程边界。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `medi-ac-2026-03-26-minimal-frontend.md` | 把两段接口输出摆成一个能讲清楚的页面；旧稿术语与机制衔接不足 | https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage；用 Vite 与 React 展示追问、报告和会话状态，让双轨分工能从一次页面交互中看出来。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `medi-ac-2026-04-01-observability-and-tests.md` | 回答不对时，先查哪一步：Trace 与测试的分工；旧稿术语与机制衔接不足 | https://docs.langchain.com/langsmith/annotate-code；用调用追踪找具体输入输出，用固定测试检查结构和停止分支，再让 README 与 smoke eval 覆盖新环境的基本演示路径。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `medi-ac-2026-04-09-multiturn-and-streaming.md` | 补充一句话，为什么还要等整份报告；旧稿术语与机制衔接不足 | https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events；https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource；v1.1 为 A 线增加消息读取与 SSE 流式路径，解释历史上下文、逐段输出和同步双轨接口之间的关系。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `medi-ac-2026-04-16-async-ab-decouple.md` | 聊天继续，报告稍后更新：A/B 怎样异步协作；旧稿术语与机制衔接不足 | 原项目开发记录；本轮技术说明资料见正文；v1.2 用 ReportJob、ReportVersion 和 SessionIntake 区分任务、结果与已收集信息，让报告按独立节奏生成。；新增图 /content-diagrams/medi-report-async.svg | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `medi-ac-2026-04-28-bugs-and-teaching-ready.md` | 同一条回复出现两次：流式消息怎样交接给历史记录；旧稿术语与机制衔接不足 | https://react.dev/learn/state-as-a-snapshot；https://docs.langchain.com/langsmith/annotate-code；沿临时气泡与正式消息的交接定位重复显示，再补齐新聊天路径的追踪，并整理教学演示的检查顺序。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2025-06-04-plan-and-solve-prompting.md` | Plan-and-Solve：一道题怎样从变量走到答案；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2305.04091；https://github.com/AGI-Edgerunners/Plan-and-Solve-Prompting；用一道卖票题拆开计划、变量和中间计算，重新看 PS 与 PS+ 的两阶段提示，以及漏步减少后仍然存在的题意理解错误。；使用正文例子或表格，无新增图 | 2026编辑（前8篇）：明确两次调用和非独立验算 | 独立审读与返修复核完成 |
| `paper-2025-06-18-react-reasoning-acting.md` | ReAct：一次搜索怎样改变下一步行动；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2210.03629；https://arxiv.org/html/2210.03629v3#S3；沿一个两跳问答例子观察 Thought、Action 与 Observation 的交接，理解 ReAct 的反馈循环、任务差异和原论文中不占优的结果。；使用正文例子或表格，无新增图 | 2026编辑（前8篇）：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2025-07-09-reflexion-verbal-rl.md` | Reflexion：失败以后，下一次尝试多读了什么；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2303.11366；https://arxiv.org/html/2303.11366v4#S3；用一个边界条件写错的函数串起执行、评价、反思和重试，解释语言记忆怎样改变后续尝试，也说明 91% HumanEval 成绩包含哪些过程。；使用正文例子或表格，无新增图 | 2026编辑（前8篇）：91%与内部重试分开，核原始作者日志 | 独立审读与返修复核完成 |
| `paper-2025-07-23-cot-step-by-step-prompting.md` | CoT：示例里的中间步骤，怎样进入新题的答案；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2201.11903；https://arxiv.org/html/2201.11903v6#S3.SS3；从买东西找零的示例看 few-shot CoT，解释中间文本、生成顺序与消融实验，并把模型规模效应限定在原论文的测试范围。；使用正文例子或表格，无新增图 | 2026编辑（前8篇）：末段改落原样本错误分析 | 独立审读与返修复核完成 |
| `paper-2025-08-06-self-consistency-vote.md` | Self-Consistency：不同解法怎样汇成同一个答案；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2203.11171；https://arxiv.org/html/2203.11171v4#S2；用一组示意采样结果拆开路径生成、答案归一和多数聚合，再看 40 条路径的实验增益为何不能解释成正确率保证。；使用正文例子或表格，无新增图 | 2026编辑（前8篇）：修采样独立与错误相关性混淆，调整结尾节奏 | 独立审读与返修复核完成 |
| `paper-2025-08-20-tree-of-thoughts-search.md` | ToT：算到一半，怎样决定换一条路；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2305.10601；https://arxiv.org/html/2305.10601v2#S4.SS1；沿一道 24 点题展开候选状态、价值评估和分支保留，理解 Tree of Thoughts 为什么需要外部搜索，以及 74% 成功率背后的任务与预算。；新增图 /content-diagrams/paper2025-tot-states.svg | 2026编辑（前8篇）：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2025-09-03-toolformer-tool-use.md` | Toolformer：怎样从普通文本筛出有用的工具调用；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2302.04761；https://arxiv.org/html/2302.04761v1#S2；把一条计算器调用放进训练文本，逐步比较带结果、不带结果和不调用时的预测损失，理解 Toolformer 的自监督筛选与单次调用限制。；使用正文例子或表格，无新增图 | 2026编辑（前8篇）：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2025-09-17-rewoo-planner-worker-solver.md` | ReWOO：结果还没回来，计划怎样写下依赖；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2305.18323；https://arxiv.org/html/2305.18323v1#S2；用一段带 #E 占位符的查询计划说明 Planner、Worker 与 Solver 的交接，核对节省 token 的来源，并区分语义评分和精确匹配。；使用正文例子或表格，无新增图 | 2026编辑（前8篇）：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2025-10-01-hyde-hypothetical-document.md` | HyDE：为什么拿一段假想答案去找真文档；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2212.10496；https://arxiv.org/html/2212.10496v1#S3；跟着一个地震检索例子看假想文档生成、向量编码与真实语料召回，解释 HyDE 的无标注设置、实验指标及生成错误的去向。；新增图 /content-diagrams/paper2025-hyde-retrieval.svg | 主编辑（后7篇）：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2025-10-15-rag-survey-2023.md` | 读 RAG 综述：一个报销问题会在哪一步丢掉条件；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2312.10997；https://arxiv.org/html/2312.10997v5#S2；用一份自拟报销资料追踪切块、召回、重排和生成，再把 Naive、Advanced、Modular RAG 的分类还原成具体的信息流与评估问题。；使用正文例子或表格，无新增图 | 主编辑（后7篇）：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2025-10-29-graphrag-global-sensemaking.md` | GraphRAG：怎样从零散访谈里归纳共同问题；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2404.16130；https://arxiv.org/html/2404.16130v2#S3.SS1；沿一个公共交通访谈例子追踪实体图、社区报告和全局回答，区分覆盖更多主题与查对每个事实，并核对原论文的比较对象。；使用正文例子或表格，无新增图 | 主编辑（后7篇）：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2025-11-12-generative-agents-smallville.md` | Generative Agents：一场聚会怎样进入小镇居民的日程；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2304.03442；https://arxiv.org/html/2304.03442v2#S4.SS1；沿 Smallville 的聚会邀请追踪观察、记忆召回、反思与计划，解释角色为何能延续行为，以及知道活动却没有赴约的失败。；使用正文例子或表格，无新增图 | 主编辑（后7篇）：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2025-11-26-memorybank-long-term-memory.md` | MemoryBank：聊天过了十天，系统还会记得哪一句；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2305.10250；https://arxiv.org/html/2305.10250v3#S2.SS1；从一次周末计划的变化追踪对话记录、每日摘要、用户画像与遗忘分数，区分记忆召回成功和回答正确，并核对模拟实验规模。；使用正文例子或表格，无新增图 | 主编辑（后7篇）：调整末段为检索与回答指标对照，已复核 | 独立审读与返修复核完成 |
| `paper-2025-12-10-memgpt-os-memory.md` | MemGPT：旧消息离开窗口以后，怎样被找回来；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2310.08560；https://arxiv.org/html/2310.08560v2#S2；沿一次跨会话查询解释工作区、消息队列、历史存储和函数续跑，结合嵌套键值例子理解外部记忆的读写与控制流。；新增图 /content-diagrams/paper2025-memgpt-memory.svg | 主编辑（后7篇）：拆Accuracy与ROUGE-L独立列，主编辑已复核 | 独立审读与返修复核完成 |
| `paper-2025-12-24-voyager-skill-library.md` | Voyager：一段挖矿程序怎样变成下一次的技能；旧稿术语与机制衔接不足 | https://arxiv.org/abs/2305.16291；https://arxiv.org/html/2305.16291v2#S2.SS1；沿 Minecraft 中制作工具的流程，解释任务课程、代码执行反馈、技能检索与验证，再看新世界复用和探索成绩的实验边界。；使用正文例子或表格，无新增图 | 主编辑（后7篇）：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2026-01-07-llmcompiler-parallel-tools.md` | LLMCompiler：两个查询为什么要排队等？；旧稿术语与机制衔接不足 | https://arxiv.org/html/2312.04511v3；https://arxiv.org/html/2312.04511v3#S5.SS1；沿着一组查询和计算，拆开 LLMCompiler 的占位变量、依赖调度与流式规划，再看论文中的加速发生在哪些任务上。；新增图 /content-diagrams/paper2026-compiler-dependencies.svg | 2025编辑：串行限定为基线流程，SVG纵排重做 | 独立审读与返修复核完成 |
| `paper-2026-01-21-lats-search-agent.md` | LATS：一次失败怎样改变下一条搜索路径；旧稿术语与机制衔接不足 | https://arxiv.org/html/2310.04406v3；https://arxiv.org/html/2310.04406v3#S5.SS2；用找商品和修复一个小函数的例子，解释 LATS 的候选树、访问次数、环境反馈和反思，并拆开 HumanEval 的搜索预算。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2026-02-04-tau-bench-tool-agent-user.md` | τ-bench：换货成功一次，为什么还不够？；旧稿术语与机制衔接不足 | https://arxiv.org/html/2406.12045v1；https://arxiv.org/html/2406.12045v1#S3；从一张只能换货一次的订单出发，说明 τ-bench 怎样模拟用户、检查数据库，并用 Pass^k 量出重复交互中的不稳定。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2026-02-18-agent-memory-survey-2024.md` | Agent Memory Survey：助手到底该记住哪一句话？；旧稿术语与机制衔接不足 | https://arxiv.org/html/2404.13501v1；https://arxiv.org/html/2404.13501v1#S5；用一次会变更时间的行程贯穿记忆来源、文本与参数形式、写入管理读取，以及模块评估与任务评估的区别。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2026-03-04-mem0-production-memory.md` | Mem0：一句新消息怎样改掉旧记忆；旧稿术语与机制衔接不足 | https://arxiv.org/html/2504.19413v1；https://arxiv.org/html/2504.19413v1#S2.SS2；跟随搬家与住址更新的例子，走过 Mem0 的候选事实抽取、相似记忆比较和图关系失效，再读 LoCoMo 的质量与延迟结果。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2026-03-18-adas-meta-agent-search.md` | ADAS：模型能不能自己设计解题流程？；旧稿术语与机制衔接不足 | https://arxiv.org/html/2408.08435v1；https://arxiv.org/html/2408.08435v1#S4.SS1；把设计一次流程与运行一次流程分开，沿候选代码、档案和验证集走过 Meta Agent Search，并说明搜索结果如何接受测试。；使用正文例子或表格，无新增图 | 2025编辑：明确原文按测试成绩选迁移候选，区分评测原则 | 独立审读与返修复核完成 |
| `paper-2026-04-01-aflow-workflow-search.md` | AFlow：让工作流在做题之后再改自己；旧稿术语与机制衔接不足 | https://arxiv.org/html/2410.10762v4；https://arxiv.org/html/2410.10762v4#S4；以候选程序的检查和修订为例，解释 AFlow 怎样选择旧流程、修改代码、运行验证，并积累有方向的搜索经验。；新增图 /content-diagrams/paper2026-aflow-search.svg | 2025编辑：补验证子集高方差筛题与五次运行，SVG改手机尺寸 | 独立审读与返修复核完成 |
| `paper-2026-04-22-memory-survey-from-storage-to-experience.md` | From Storage to Experience：失败日志怎样变成可复用经验；旧稿术语与机制衔接不足 | https://www.preprints.org/manuscript/202601.0618/v1；用三次导入日期的失败和修复，区分保存轨迹、反思单次错误与跨任务归纳，并说明经验迁移为什么需要反例。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `paper-2026-05-06-heuristic-learning-beyond-gradients.md` | Heuristic Learning：打砖块卡住之后，代码怎样继续学？；旧稿术语与机制衔接不足 | https://github.com/Trinkle23897/learning-beyond-gradients/blob/main/learning-beyond-gradient.en.md；https://github.com/Trinkle23897/learning-beyond-gradients/commit/0581e0b0c1b8；围绕原作者 Breakout 的循环困局，拆开观测、几何控制、扰动与回归，说明 Learning Beyond Gradients 所说的软件学习。；使用正文例子或表格，无新增图 | 2025编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `教程-搭建简易博客.md` | 搭一个 Hexo 博客，先看懂文件怎样发布出去；旧稿术语与机制衔接不足 | https://hexo.io/docs/；https://hexo.io/docs/github-pages；把博客源码、生成的网页和托管平台分开看，再沿着这条路径完成仓库准备、主题配置、文章发布与图片检查。；新增图 /content-diagrams/legacy-hexo-publishing.svg | 2026编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |
| `教程（一）-github仓库的创建与同步.md` | 教程（一）：把本地文件交给 GitHub，再准备 Pages；旧稿术语与机制衔接不足 | https://docs.github.com/en/authentication/connecting-to-github-with-ssh；https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github；从第一次提交和推送理解 Git、GitHub 与 Pages 的分工，分清 SSH 身份认证、仓库命名和源码保存位置。；使用正文例子或表格，无新增图 | 2026编辑：补Git身份设置与Pages发布源区别 | 独立审读与返修复核完成 |
| `教程（三）-编写上传自己的博客文章.md` | 教程（三）：从一个 Markdown 文件发布第一篇 Hexo 文章；旧稿术语与机制衔接不足 | https://markdown.com.cn/basic-syntax/；http://markdownpad.com/download.html；分清文章元信息与正文，在 Hexo 中预览，再生成和部署；沿着一篇短文章的发布过程，理解源文件为何要一直保留。；使用正文例子或表格，无新增图 | 2026编辑：恢复图片语法与部署截图，调整图旁解释 | 独立审读与返修复核完成 |
| `教程（二）hexo框架的搭建及部署.md` | 教程（二）：让 Hexo 本地预览和 Pages 发布接起来；旧稿术语与机制衔接不足 | https://hexo.io/docs/；https://nodejs.org/en/download；安装后先观察 Hexo 的源码与生成目录，再配置部署目标。解释版本检查、默认主题、发布分支，以及推送成功后还要确认什么。；使用正文例子或表格，无新增图 | 2026编辑：补源码main与发布gh-pages边界、force push机制及发布源条件 | 独立审读与返修复核完成 |
| `教程（四）-解决博客文章中图片上传失败问题.md` | 教程（四）：Hexo 文章页有图，首页为什么会破图；旧稿术语与机制衔接不足 | https://hexo.io/docs/asset-folders；从浏览器如何解释相对地址入手，区分全站素材与文章资源目录，再选择 Hexo 标签或 Markdown 渲染器生成图片链接。；使用正文例子或表格，无新增图 | 2026编辑：恢复真实资源目录截图，检查首页相对路径例子 | 独立审读与返修复核完成 |
| `日常（一）-为什么要搭建个人博客.md` | 为什么我还想留一个个人博客；旧稿术语与机制衔接不足 | https://hexo.io/docs/；https://github.com/88250/solo；从保存一篇会继续修改的笔记出发，重新想想个人博客的用途：原稿放在哪里，旧文章怎样找回来，维护成本又由谁承担。；使用正文例子或表格，无新增图 | 2026编辑：全文审读；未列需改项的段落保留 | 独立审读与返修复核完成 |

## 验证记录

- 已检查50篇全部相对基线有改写；slug/date/category/tags等除title/description外逐字保留。
- 原有所有fenced code块按多重集合比对保留（教程三将预览移动到部署之前）。
- Markdown AST检查：50篇，22处图片，168处链接；原有链接和图片目标无丢失，本站链接均能对应slug，本地图片存在且有alt。
- 新增8张原创SVG，已按360px宽栅格化逐张目视：无文字溢出或裁切。Quick Look会生成方形裁切缩略图，因此未以它作为完整图证据。
- 最终 `npm run build` 退出0：Astro 62页、Pagefind 50篇、RSS 50项；目录227个片段锚点均有目标；生成页面22处图片存在。
- 50个标题与50个description均有实质更新；37个基线代码块逐字保留。最终AST/元数据/引用目标/SVG解析综合检查 errors=[]；`git diff --check`通过。
- 390×844浏览器抽看同步双轨图、Compiler正文/表格。图片实际加载，图宽342，document scrollWidth=390，无页面横向溢出；表头过长已缩短并重建，列的对应关系在表后明确说明。8张SVG另按360宽逐张目视，未代称全50篇真实手机逐页测试。
- 浏览器视口已还原、临时标签已关闭；本轮4473预览服务随交付停止。没有发布、推送或主工作树修改。
- 技术通过表示内容能生成与导航，不代表用户已认可本轮文风。

## 历史事实核查

- AI Reader质量采样：`/Users/blankhoney/workspace/project2026/my_rss` 的 `b733e6a8`，`apps/reader-web/src/lib/feeds/server.ts` 全局 `getEntries({status:'all',limit:300})`，`client.ts` 使用 `published_at desc`，`quality.ts` 按feedId分组。2026编辑独立读Git对象确认；截至6/2末 `b75f1a92acfdad0fc0ae611f33f55e064c9448b8` 三文件无变化。两篇已写明全库最多300，并非每源300。
- HL英文原文Git文件最早记录为5/8，当前文章date保留5/6；首次发表日仍无独立证据。正文版本注不宣称5/6首发，需主任务决定是否另行调整日期。
- 论文数值来自本轮重新打开的作者论文/原始日志，未执行复现实验；项目开发测试按历史记录表述，不充当本轮运行结果。
- 五个外站来源仍未获确认，本轮未新增对应文章。


## 独立审读覆盖与返修

- 主编辑写旧6、AI Reader8、Medi12；2026编辑独立读旧6与AI8，2025编辑独立读Medi12。
- 2025编辑写研究15；2026编辑读前8，主编辑读后7并重开7篇原文抽查。MemGPT指标分栏和MemoryBank结尾已返修。
- 2026编辑写研究9；2025编辑全部独立读并重开9份来源抽查，Compiler基线条件、AFlow筛题、ADAS按测试选择与两SVG手机布局均返修后回读确认。
- Reflexion最后新增原始作者日志由2026编辑核出、2025编辑写入；主编辑最终全文读回，保留反思条数与总调用预算的区别。
- Medi judge原稿只支持“五轮上限”，读者移除了“首次之外五次追加”的推断。项目历史事实未用本轮站点构建来验证。

## 图的取舍

新增8张均为原创机制示意，不是实验截图或论文原图：Hexo源到发布、ToT状态、HyDE输入与证据、MemGPT窗口内外、Compiler依赖、AFlow内外循环、Medi同步等待与异步任务。其余文章按例子、表格和过程说明处理，不为数量配图。

## 经验回报（供主任务判断，不写技能）

1. 数字需连同表头、样本、基线选择和内部重试预算核对；pass@1不自动等于只调用一次。
2. 将共享前处理、分支内部工作、接口等待和跨请求调度分开讲，避免把“并行”当成“用户不用等”。
3. Markdown引用检查用AST，避免把代码中的图片示例误识别成正文图片；完整SVG使用保持长宽比的渲染复核，Quick Look缩略图可能裁切。
4. 采样口径需绑定日期匹配的Git对象，不能从现在代码反推旧项目记录。

本任务遵守范围限制，没有更新AGENTS、skills、依赖或应用代码；用户未要求持久化记忆，因此也未写用户记忆。


## 本轮提交

本轮基线为 `4f06f2e3ab38788525f07307b0e9c28f982dc22f`，以下提交按顺序接续。此前旧轮提交不作为新轮交付。

- `cd1699d33448ac43a3e24ff459d40011177a0eff` Rewrite legacy blog guides around the publishing workflow
- `cbddeba9abb4b0e17bbca4faf5cd6e6c72646881` Rewrite AI Reader logs around data flow and reading decisions
- `6759112491799f50675c1007e03af33486646d8a` Rewrite MediAC logs with explicit flow and state transitions
- `666db06398ae66dcb7ef94cdcfc9132eddf74c10` Rebuild research notes with sourced mechanisms and worked examples


## 2026-09-14 新增八篇阅读笔记

用户追加八本书的短笔记，发布时间按要求分布在 2025 年底至 2026 年初。以 `2aa8a01406b25a7f33ad9de69065a10a41337813` 为基线；此前 50 篇未修改。新增内容均归入现有 `daily` 分类及“阅读笔记”标签。

正文约 412–462 字（不计链接、图片说明及空白），使用 Humanizer 全文审读。书籍事实来自作者页面、出版方提供的介绍和目录；感想原创，不搬用书评者的经历，不宣称已完整阅读或实践。例子明确为假设或作者联想。

| 日期 | 书籍 | 文件 | 篇末材料 |
| --- | --- | --- | --- |
| 2025-11-16 | 芯片简史 | [reading-2025-11-16-chip-history.md](src/content/blog/reading-2025-11-16-chip-history.md) | 书封 |
| 2025-11-29 | 死在火星上 | [reading-2025-11-29-die-on-mars.md](src/content/blog/reading-2025-11-29-die-on-mars.md) | 书封 |
| 2025-12-09 | 也许你该找个人聊聊 | [reading-2025-12-09-maybe-you-should-talk.md](src/content/blog/reading-2025-12-09-maybe-you-should-talk.md) | 短摘录 |
| 2025-12-21 | 认知觉醒 | [reading-2025-12-21-cognitive-awakening.md](src/content/blog/reading-2025-12-21-cognitive-awakening.md) | 书封 |
| 2026-01-04 | 饥饿的大脑 | [reading-2026-01-04-hungry-brain.md](src/content/blog/reading-2026-01-04-hungry-brain.md) | 书封 |
| 2026-01-17 | 圆圈正义 | [reading-2026-01-17-justice-in-circles.md](src/content/blog/reading-2026-01-17-justice-in-circles.md) | 短摘录 |
| 2026-02-01 | 学会提问 | [reading-2026-02-01-asking-right-questions.md](src/content/blog/reading-2026-02-01-asking-right-questions.md) | 书封 |
| 2026-02-14 | 大脑健身房 | [reading-2026-02-14-brain-exercise.md](src/content/blog/reading-2026-02-14-brain-exercise.md) | 书封 |

版本核对：

- 《圆圈正义》的副标题为“作为自由前提的信念”，已纠正用户书单中的“信仰”。
- 《死在火星上》使用青岛出版社 2022 年版书封；《学会提问》使用机械工业出版社 2023 年第 12 版；《大脑健身房》为安德斯·汉森关于运动与大脑的作品。各版出版时间均早于对应文章日期。
- 发布日期由本次用户要求安排，不是原稿写作时间或实际读完日期的证据。

材料与图片：

六张书封保存在 `src/assets/reading/`，已检查图像内容、格式和尺寸（330×495、336×455 或 500×500），正文保留来源链接与明确 alt。原图不作重绘，未声称开放授权；仅作为对应书籍评论的识别配图，版权归原权利人。两张豆瓣书封端点返回 HTTP 418 后未绕过，按用户“封面或者片段”的要求改用有来源的短摘录。《也许你该找个人聊聊》摘的是书中引用的鲍德温句子，明确署名；《圆圈正义》注明章节。未使用长篇摘录。

| 本地图片 | 原始图片地址 |
| --- | --- |
| `src/assets/reading/chip.jpg` | https://pic.arkread.com/cover/ebook/f/426248792.1681799641.jpg!cover_default.jpg |
| `src/assets/reading/awake.jpg` | https://pic.arkread.com/cover/ebook/f/424126699.1679988013.jpg!cover_default.jpg |
| `src/assets/reading/questions.jpg` | https://pic.arkread.com/cover/ebook/f/454005195.1706692276.jpg!cover_default.jpg |
| `src/assets/reading/exercise.jpg` | https://pic.arkread.com/cover/ebook/f/448537026.1700635058.jpg!cover_default.jpg |
| `src/assets/reading/mars.png` | https://www.chinawriter.com.cn/NMediaFile/2022/0325/MAIN202203250919000331951315276.PNG |
| `src/assets/reading/hungry.jpg` | https://xbsu.com/image/cache/img/50/31/9787203113713-31-500x500.jpg |

验证：

- `npm run build` 通过：70 个页面，Pagefind 收录 58 篇文章。
- Markdown AST 检查通过：新增 8 篇、6 张本地图片路径与 alt 均有效、2 处短摘录。
- 八条 `dist/blog/reading-*/index.html` 路由均生成；RSS 共 58 条，其中新笔记 8 条。
- 全文审读并检查 Humanizer 常见残留，未出现无来源亲历、破折号、模板式“不是……而是……”或加粗标签。
- 本轮为内容改动，未新增测试、修改应用代码或技能。未开展浏览器交互验收，未合并、推送或部署。
- 经验维护检查：现有内容来源与 Humanizer 规则足够覆盖本次工作，没有需要新增的长期经验。


## 2026-09-14 前一轮全站文章候选（用户否决，已被下轮替代）

用户明确要求重构博客全部文章，包括论文、项目日志、教程和阅读笔记；增加主体判断和自然叙述，补充有效引用、论文流程/结构原图及必要示例；整理重叠标签，检查纸色阅读页的代码块配色。当前候选共 59 篇，以 fb955cf 为编辑基线。原有冻结仅适用于前轮交付，本次全站编辑由用户新指令授权。

完成情况：

- 全部 59 篇正文、标题和摘要已重构：24 篇论文/研究笔记、8 篇阅读笔记、8 篇 AI Reader、12 篇 MediAC、6 篇旧博客/教程、1 篇实验区介绍。减少模板小节，从具体疑问、故障、选择和阅读反应组织叙述；保留必要技术条件、历史事实与实验限制。没有把网络他人的第一人称经历改成本站亲历。
- 标签从 33 个合并为 11 个：博客、阅读、AI Reader、MediAC、推理、工具调用、检索增强、智能体记忆、工作流、评测、生成实验。移除 Paper Notes、Engineering Log、Legacy 和宽泛 AI 等重复标签。每篇使用一个主标签，分类保留原值。
- 59 篇 slug、date、category 与 fb955cf 一致；旧教程全部代码块逐块保持一致，保留原截图。八篇书评日期继续分布在 2025 年 11 月至 2026 年 2 月。
- 24 篇研究笔记均有配图：22 张 arXiv 论文原图，1 张 Heuristic Learning 作者文章原图，1 张自行绘制的 Storage-to-Experience 分类图。原图附论文/图号链接和权属说明，自绘图明确非论文原图。Storage 原图端点 403，未绕过，改用解释性自绘 SVG。
- Heuristic Learning 保留归档日期与作者英文稿最早提交时间不一致的说明，没有用日期推断阅读经历；配图来自作者目前公开稿。实验区使用“首批 high”表述，未宣称主任务正在重跑的 max 已生成或上线。
- 代码高亮改用已安装的 Everforest 明暗主题，无新增依赖。Expressive Code 的代码、编辑器标题栏和终端标题栏均引用博客已有颜色变量，去掉独立纯黑终端底色。论文透明原图固定白色衬底，保证深色模式下标签可读。

验证与限制：

- `npm run check`：0 errors、0 warnings，2 个已有 XMLValidator 废弃提示。发现 caddyfile 不在高亮语言包后将该示例标为 text，后续构建无该警告。
- `npm test`：15/15 通过。
- `npm run build`：71 页面，Pagefind 收录 59 篇。最终生成 HTML 中 47 处图片均有 alt 且本地资源存在；论文/书封与自绘图经静态图像检查，SVG 无 script/foreignObject/远程 href。
- 59 篇元数据和旧教程代码保持检查通过，正文均发生重写。代码实际生成的语法色对纸色背景最低对比度：浅色约 4.52，深色约 6.01。未将它作为整站所有主题、控件状态的完整无障碍验收。
- 遵循用户机器负载约束，没有启动浏览器、开发服务或 3D 预览；未作桌面/手机的交互视觉验收。没有推送、合并、部署。
- 经验维护复核：现有内容来源、Humanizer 和分层验收要求覆盖本轮，没有新增长期规则。

新增原图来源（源文件在 `src/assets/papers/`，原始版权归原作者；此表为素材追溯记录）：

| 文件 | 论文及对应原图 |
| --- | --- |
| `paper-2025-06-18-react-reasoning-acting.svg` | https://arxiv.org/html/2210.03629v3#S1.F1 |
| `paper-2025-07-09-reflexion-verbal-rl.svg` | https://arxiv.org/html/2303.11366v4#S1.F1 |
| `paper-2025-07-23-cot-step-by-step-prompting.png` | https://arxiv.org/html/2201.11903v6#S0.F1 |
| `paper-2025-08-06-self-consistency-vote.svg` | https://arxiv.org/html/2203.11171v4#S1.F1 |
| `paper-2025-08-20-tree-of-thoughts-search.svg` | https://arxiv.org/html/2305.10601v2#S1.F1 |
| `paper-2025-09-03-toolformer-tool-use.svg` | https://arxiv.org/html/2302.04761v1#S1.F2 |
| `paper-2025-09-17-rewoo-planner-worker-solver.png` | https://arxiv.org/html/2305.18323v1#S1.F1 |
| `paper-2025-10-01-hyde-hypothetical-document.svg` | https://arxiv.org/html/2212.10496v1#S1.F1 |
| `paper-2025-10-15-rag-survey-2023.png` | https://arxiv.org/html/2312.10997v5#S2.F3 |
| `paper-2025-10-29-graphrag-global-sensemaking.jpg` | https://arxiv.org/html/2404.16130v2#A2.F4 |
| `paper-2025-11-12-generative-agents-smallville.png` | https://arxiv.org/html/2304.03442v2#S0.F1 |
| `paper-2025-11-26-memorybank-long-term-memory.png` | https://arxiv.org/html/2305.10250v3#S2.F1 |
| `paper-2025-12-10-memgpt-os-memory.svg` | https://arxiv.org/html/2310.08560v2#S1.F3 |
| `paper-2025-12-24-voyager-skill-library.png` | https://arxiv.org/html/2305.16291v2#S1.F2 |
| `paper-2026-01-07-llmcompiler-parallel-tools.png` | https://arxiv.org/html/2312.04511v3#S2.F2 |
| `paper-2026-01-21-lats-search-agent.png` | https://arxiv.org/html/2310.04406v3#S1.F1 |
| `paper-2026-02-04-tau-bench-tool-agent-user.svg` | https://arxiv.org/html/2406.12045v1#S1.F1 |
| `paper-2026-02-18-agent-memory-survey-2024.png` | https://arxiv.org/html/2404.13501v1#S5.F4 |
| `paper-2026-03-04-mem0-production-memory.png` | https://arxiv.org/html/2504.19413v1#S2.F2 |
| `paper-2026-03-18-adas-meta-agent-search.png` | https://arxiv.org/html/2408.08435v1#S1.F1 |
| `paper-2026-04-01-aflow-workflow-search.png` | https://arxiv.org/html/2410.10762v4#S3.F3 |
| `paper-2025-06-04-plan-and-solve-prompting.jpg` | https://arxiv.org/html/2305.04091v3#S1.F2 |

Heuristic Learning 作者图： https://raw.githubusercontent.com/Trinkle23897/learning-beyond-gradients/main/ig_0c2dd0d2f07176560169fbc256930481969d3c6ba3316d5486.png 。自绘分类图依据 https://www.preprints.org/manuscript/202601.0618/v1 ，没有声称为原图。


## 2026-09-14 逐篇重构定稿与早期手稿恢复

用户否决 0b01408 的整体文风与结构，要求排除早期手写稿、其余全部细改，并由主施工上线。本节替代前轮“全部完成”判断，前轮候选不得单独发布。

范围与过程：

- 53 篇较新文章全部由本任务主编重新组织正文、标题、摘要：24 篇研究笔记、8 篇书评、8 篇 AI Reader、12 篇 MediAC、1 篇实验区导读。研究代理只查论文/图片/历史源码，独立编辑分批通读全部新稿，主编逐项修改，没有多写手批量改稿。
- 6 篇 2022 手写旧文恢复自旧仓库 `d359e8ddf7fdd8c27c2c25a3b800074cda03e241` 的 `apps/web/content/posts/*.zh.md`。这是找到的最早导入文本，不声称是原始 2022 Markdown 文件。正文只迁移旧图片与站内文章地址，独立审稿及脚本确认六篇逐字匹配该映射后的来源；标题也恢复，摘要说明旧文背景。保留原图、原代码和两处原本为空的图片 alt。
- 新稿保留现有 slug/date/category。八篇书评继续按用户要求排在 2025 年 11 月至 2026 年 2 月，不将安排日期声称为实际读完时间。既有 11 个主标签继续使用。
- 每篇围绕具体材料展开：PS 的 Plan 与 Solution、ReAct 的检索轨迹、ADAS 未使用的 verdict、AFlow 未复测的返回、RAG 条款丢失、AI Reader 的长度兜底分、MediAC 的追加证据截断。自拟示例明确标识，删除虚构亲历、笼统评语和跨篇重复的同期改动。
- 根据实际来源纠正 CoT 错误样例解释、τ-bench 独立重复定义、37 分计算与五月十四日事件服务时序、来源隐藏视图和默认排序、MediAC 切片/judge输入/测试覆盖/报告取数与前端等待。MediAC 无同期 Git，现存源码观察标为九月整理，不伪称历史修复或测试通过。
- HL 为后续修订稿，5 月 6 日仅保留归档；主要来源固定 `01505855120ba5fe801fc0f701b42b7c4594ff81`（5 月 11 日），与已核对原文一致。没有改日期掩盖先后冲突。
- 实验区导读按主施工当前发布确认更新：九项 Sol/max、Astra/max、Astra/high 并列；high 原稿不变，Astra/max 黑洞仅补预览/观察；Sol 原始 dist 在线、离线错误文件保留，两个 ZIP 由集成打包。不会覆盖实验数据或场景文件。
- 新增 MemGPT Figure 8 原始 SVG `src/assets/papers/paper-memgpt-nested-kv.svg`，直接配 UUID 连续查询段；来源 https://arxiv.org/html/2310.08560v2/memgpt_nested_kv_example.svg ，图页 https://arxiv.org/html/2310.08560v2#S3.F8 。现有 24 篇研究笔记共 25 张对应素材（23 张 arXiv 原图、1 张作者博客原图、1 张自绘分类图）。更新报告自绘图，移除前端聊天已解除等待的保证。
- 沿用前轮 Everforest 配色与纸色代码框修复；没有新增依赖、打开浏览器或启动预览服务。

本工作区验证：

- `npm run check`：0 errors、0 warnings，2 个已有 XMLValidator 弃用 hints。
- `npm test`：15/15 通过。
- `npm run build`：71 页面、Pagefind 59 篇；本工作区未包含主施工的新实验目录，主施工合并后仍须对最终候选构建。
- 元数据与正文检查：59 篇正文相对被否决候选均变化，其中 53 篇重构、6 篇恢复；slug/date/category/tags 无变化，六篇原稿比对通过。
- 渲染 HTML 检查：46 处正文图片资源全部存在；两处旧手稿空 alt 原样保留，其余均有 alt。1007 处本地链接目标与页内锚点无缺失。论文 SVG 无脚本、foreignObject 或外部 href；新增 MemGPT 图已静态查看。没有浏览器视觉或新版生产证明。
- 独立编辑完成全部 53 篇逐篇审稿及六篇旧稿比对；最后反馈均已落实。图片/链接/构建检查不作为文风的替代证明。

交付范围：全部 `src/content/blog/*.md`；实际引用的 `src/assets/papers/` 与 `src/assets/reading/`；两张 `public/content-diagrams/medi-*.svg`；代码框主题改动；本状态与项目 skill 的内容重构经验。不要用此分支整树覆盖主施工，尤其不覆盖实验数据、场景、STATE.md 或其他交互实现。主施工可按文件清单从定稿提取，样式按 7dd0a69 的对应改动合入。

上线尚待主施工完成：用户已明确授权发布，不再等待内容确认；需要收到最终 main/发布 commit、CI 与 Deploy 以及公网文章核对，再报告完成。任务材料与审稿记录在忽略的 `.private/`，不进入发布。

经验维护：补充“每篇具体对象、跨篇审读、真实旧稿恢复”的规则，明确机械去词与统一谨慎语气不能证明重构质量。

发布前链接补查：AI Reader 源码仓库及固定 blob 对匿名 HTTP 返回 404，本机 Git 历史核验仍有效。七篇涉及的链接已换成文件名与短版本说明，并保留相关代码片段和可公开访问的官方文档入口；没有更改仓库权限或公开完整源码。旧私有研究回执中的 GitHub 地址仅作历史 remote 定位，不作为公众可访问来源。
