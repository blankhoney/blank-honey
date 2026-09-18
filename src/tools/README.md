# 独立工具工作台

五个入口由 `src/config.ts` 的 `tools` 登记，源码目录分别为 `archive`、`image-crop`、`markdown`、`luck`、`fortune`。`scripts/build-lab.ts` 调用 Vite 多页构建，输出在 `lab-dist/tools/<slug>/`，不进入博客主站 `dist/`。实验室和原始 AI 实验仍走原有管线。

## 页面约定

- 每款工具包含 `index.html`、`main.ts`，可增加自己的 `style.css`、纯函数和 Worker。
- HTML 使用 `lang="zh-CN"`、viewport、完整标题；`body` 标注 `data-tool="<slug>"`。
- `main.ts` 导入 `../shared/style.css`；`shared/ui.ts` 提供 `downloadBlob(blob: Blob, filename: string): void` 和 `formatBytes(bytes: number): string`。不假定其他共享 API。
- 主要类名：`tool-shell`、`tool-header`、`tool-eyebrow`、`tool-title`、`tool-description`、`tool-mascot`、`workspace`、`panel`、`panel-header`、`drop-zone`、`form-grid`、`field`、`actions`、`button`、`button--secondary`、`button--danger`、`status`、`privacy-note`、`empty-state`、`result-card`、`tool-footer`。
- 返回链接写在 HTML：`<a class="back-link" href="__SITE_RETURN__">← 返回博客工具箱</a>`，由构建替换。不要把此占位符写入 JS，不硬编码生产域名。
- 表单控件有明确标签和键盘焦点，状态采用 `role="status"`，错误可用 `role="alert"`；拖入是文件输入的增强，不能成为唯一入口。
- 视觉采用奶油纸色、圆角描边、轻微纸片阴影与可辨识的原创小图标；主操作区在首屏可见，手机不横向溢出。禁止远程字体/图片/CDN、广告或账号。

## 功能边界

- 所有文件、文件名、姓名、生日和口令只在本机处理，不上传、不进 URL、console、localStorage。清空/离开时释放 Blob URL、Bitmap、Worker 和临时数据。
- 公平随机单独使用 Web Crypto 的拒绝采样；日签的确定性娱乐内容不能复用为骰子随机源。
- Markdown 默认不允许原始 HTML，解析后再净化；危险协议和远图不得自动执行/请求。
- 四柱按公历、固定北京时间 UTC+8 说明计算口径。未知时辰保持未知；传统历法与娱乐签文分区，不作科学预测。
- 图片导出验证实际 MIME/尺寸。压缩处理有资源预算、取消与错误反馈，不执行解压出的 HTML/JS，不递归解压嵌套包。

## 压缩引擎发布约定

`7z-wasm` 的引擎 JS/WASM 保持未经压缩重写的独立文件，构建复制到 `lab-dist/tools/vendor/7z/`，同时保留许可证与对应源码/构建来源说明。所有工具依赖已锁定在仓库 package-lock 中。

压缩页通过 `new URL('../vendor/7z/', document.baseURI).href` 得到引擎基址，并在任务初始化时传给本页专属 module Worker。Worker 对该同源基址使用动态 `import(/* @vite-ignore */ engineUrl)`，通过 `locateFile` 指向同目录的 `7zz.wasm`。Worker 自身仍以 `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` 交给 Vite 打包。不要给实验站增加 COOP/COEP 或导入 Node 专用 CLI。

开发与验收以真实 `lab-dist` 静态输出为准，特别核对 Worker、WASM、下载和回链。原始依赖许可与使用边界单独保留，不受本项目 MIT 标识覆盖。
