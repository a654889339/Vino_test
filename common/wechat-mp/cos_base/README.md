# common/wechat-mp/cos_base（薄占位与扩展点）

**默认不复制代码**：主包/工具内使用

`require('../../common/frontend/cos_base/paths.js')`（以 `R-Melamine/wechat-mp/utils` 为基准的相对路径）

即可复用与 H5 相同的 `paths.js` 逻辑；**桶域与白名单**来自 `../config/cos/rmelamine.media.yaml`（经 `GET /api/media/cosConfig` 下发明文），勿在本目录手抄第二份白名单。

仅当 **分包/独立构建** 等导致无法以相对路径指到 `common/frontend/cos_base` 时，可在此放一层 `module.exports = require('../../../frontend/cos_base/paths.js')` 类薄封装，并保持与 `common/frontend/cos_base` 的变更同步（见该目录 README，双仓与 Vino 镜像同名字段）。
