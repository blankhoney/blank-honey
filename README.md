# Your Name

这是空白个人博客模板，保留 Astro 静态页面、Pagefind 搜索、独立工具站和只读探针架构。
文章、照片、地点、关系、电台、主机清单和原站部署记录均已移除。模板不代表你的环境已通过验收。

## 开始使用

使用 Node.js 24 LTS 和 Docker，运行以下命令：

```sh
npm ci
cp .env.example .env
npm run check
npm test
npm run build
npm run docker:up
```

主站为 http://localhost:8080，工具站为 http://localhost:8081。
Docker 默认读取 .env.example；使用自己的构建配置时运行 `BUILD_ENV_FILE=.env docker compose up -d --build`。
运行 `npm run docker:down` 停止服务。

## 配置内容

- 在 `src/config.ts` 设置名称、介绍、GitHub 链接、分类、工具和实验。
- 创建 `src/content/blog/*.md`，Frontmatter 包含 title、description、date、category，可选 slug、tags、draft、places。
- 文章图片放在 `src/assets/`，地点和明确的文章关系配置在 `src/data/`。
- 在 .env 配置真实域名、电台、Giscus 和外部工具；不得提交密钥。
- 工具或实验记录的 html 指向本地 HTML，资源使用相对路径；修改后重新构建。

CI 保留安装、检查、测试和构建步骤。模板没有生产自动部署工作流，生产配置与验收由使用者完成。
操作说明见 [docs/operations.md](docs/operations.md) 和 [deploy/README.md](deploy/README.md)。
代码使用 MIT；自行添加的文章、照片和第三方资源版权另行管理。
