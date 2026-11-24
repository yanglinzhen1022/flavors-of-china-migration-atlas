# 参与贡献 · Contributing to 食味中国

欢迎补充你的家乡风味名城、地方地理标志特产与饮食典故！

## 新增或修改城市风物数据

每座城市都是 `data/cities/<city_id>.json` 下的独立 JSON 文件。字段要求：

- `id`: 全小写英文标识（如 `guilin`）
- `name`, `ancientName`, `pinyin`, `province`, `region`（七大区之一：`华北/东北/华东/华中/西南/华南/西北`）
- `coord`: `[经度, 纬度]`（中国范围 `73–135`, `18–54`）
- `cuisineFamily`: 所属菜系流派
- `flavorTags`: 至少 2 个风味标签
- `flavorScores`: `{ "鲜": 0..5, "辣": 0..5, "酸": 0..5, "甜": 0..5, "醇": 0..5 }` 整数
- `tagline`, `geoReason`: 城市一句话风味判词与水土气候成因
- `specialties`: 至少 2 项特产（含 `name`, `category`, `era`, `gi`, `desc`）
- `timeline`: 至少 2 条味觉历史演进（含 `year`, `eraLabel`, `title`, `detail`, `source`）
- `dishes`: 至少 3 道代表名菜/小吃

## 本地构建与校验

```bash
npm run build      # 更新 data/cities_bundle.json 与 topics/ 静态专题页
npm run validate   # 校验全部城市、路线、地理坐标与史料完整性
npm test           # 运行投影、检索、深链与 MCP 集成测试
```
