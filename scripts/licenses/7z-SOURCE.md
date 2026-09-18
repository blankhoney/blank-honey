# 7-Zip WASM：版本、对应源码与替换方式

本工具使用 `7z-wasm@1.2.0`。发布时从锁定的 npm 安装目录逐字节复制 `7zz.es6.js` 与 `7zz.wasm`，不重新编译，不将其压缩合并进业务 JavaScript。引擎仅由压缩页的 Worker 按需加载。

## 许可

引擎遵循 GNU LGPL 2.1 或更新版本，并附 unRAR 限制，不是 MIT。

- [包内许可说明](./License.txt)
- [完整 LGPL 2.1](./LGPL-2.1.txt)
- [unRAR 许可与限制](./unRarLicense.txt)
- [上游随包 README（未改写）](./README.md)

完整 LGPL 文本取自 7-Zip 24.09 对应源码的 `DOC/copying.txt`。unRAR 相关代码不得用于重建专有的 RAR 压缩算法；完整限制以上述原文为准。自有代码的许可声明不覆盖这些第三方文件。

## 随站点提供的对应源码

以下两份原始归档随引擎一起提供，无需从别的站点找回：

1. [7-Zip 24.09 源码，原始 7z 归档](./7z2409-src.7z)
2. [7z-wasm v1.2.0 对应仓库归档](./7z-wasm-1.2.0-source.tar.gz)：包含构建脚本、Dockerfile、构建环境参数和 `7zz-emcc.patch`；补丁内提供 `makefile.emcc`、`pre.js` 与 `post.js` 等构建文件。

可追溯的上游位置：

- npm 包：<https://registry.npmjs.org/7z-wasm/-/7z-wasm-1.2.0.tgz>，完整性由项目的 `package-lock.json` 记录。
- 7z-wasm 标签 `v1.2.0` 对应提交 `521d2cf93f5964f4e77b01049e19f1b29305c454`：<https://github.com/use-strict/7z-wasm/tree/521d2cf93f5964f4e77b01049e19f1b29305c454>。
- 仓库归档来源：<https://codeload.github.com/use-strict/7z-wasm/tar.gz/521d2cf93f5964f4e77b01049e19f1b29305c454>。
- 7-Zip 24.09 源码归档来源：<https://github.com/ip7z/7zip/releases/download/24.09/7z2409-src.7z>；对应上游标签提交 `e5431fa6f5505e385c6f9367260717e9c47dc2ee`。

上游 Dockerfile 原来使用的 `https://www.7-zip.org/a/7z2409-src.7z` 在本轮核验时返回 404；重建时可使用这里随附的同版本源码归档或上述官方 GitHub release 地址。随附的上游脚本保持原样，没有暗中修改该 URL。

## 构建与替换

上游 `build_in_docker.sh` 对 7-Zip 24.09 应用补丁，并在 `CPP/7zip/Bundles/Alone2` 使用 `makefile.emcc` 构建。ES 模块参数包含 `MODULARIZE=1`、`EXPORT_ES6=1`、`EXPORT_NAME=SevenZip`、NODEFS/WORKERFS，以及 `pre.js`/`post.js`。Dockerfile 检出 emsdk 4.0.10，再使用该版本仓库的 `latest` 别名安装编译器；这不是本项目重新构建或字节可复现的承诺。

构建自己的兼容版本后，可同时替换本目录下的 `7zz.es6.js` 与 `7zz.wasm`。页面动态导入前者，默认导出为 Emscripten 模块工厂，通过 `locateFile` 读取同目录 WASM，并使用 `FS` 与 `callMain`。不使用 SharedArrayBuffer，不要求给整个工具站添加 COOP/COEP。

请保留适用的许可、版权与源码提供要求。本项目不对 LGPL 允许的引擎修改、替换、重新链接或为调试修改所需的逆向工程额外施加限制。
