# 本地运行与部署配置

从仓库根目录运行 `mkdir -p logs && docker compose up -d --build`。
主站和工具站分别监听本机 8080、8081 端口；指标服务不公开端口。本模板未预设生产服务器或 TLS 配置。

hosts.json 初始为空。需要探针时，添加 publicId、displayName、regionLabel、timeZone 和内部 instance；
instance 应与 otel.yaml 的采集目标一致。对外展示字段不得包含私人主机地址。

生产环境使用不同的主站和工具域名，通过私有配置覆盖真实主机和采集目标，并自行配置 TLS。
构建配置可通过 `BUILD_ENV_FILE=.env` 传入。保留日志目录写权限，禁止公开指标端口或环境文件。

backup.sh 使用 restic；先配置私有仓库与密码文件，再按脚本检查备份目录。
恢复时使用 `restic restore latest --target /path/to/restore-review` 写入独立目录，完成检查后再替换运行文件。
模板没有预设定时器、远程部署命令或已通过的备份验收记录。
