# LightweightWindowsToolset — 后端接口复用文档

> 为 PC 端游戏体力捕获工具（Windows 客户端）准备的后端接口说明与代码复用指南。
> 最后更新: 2026-05-26

---

## 1. 架构总览

```
┌──────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Windows 客户端   │────→│   REST API 服务        │────→│   本地 MySQL      │
│  (Python/Electron)│     │   (FastAPI, 电脑端)    │     │                  │
└──────────────────┘     └──────────────────────┘     └──────────────────┘
                                    ↑
┌──────────────────┐               │
│  Android 客户端   │───────────────┘
│  (Kotlin, 已有)   │   HTTP (Tailscale / 局域网)
└──────────────────┘
```

- **后端 API 服务**运行在 Windows 电脑上（`uvicorn main:app --host 0.0.0.0 --port 8000`）
- **双端**（Android + Windows）通过 HTTP 调用同一套后端接口，由后端统一操作 MySQL
- **网络层**：Tailscale 虚拟局域网，设备间通过 `100.x.x.x` IP 直接加密通信

---

## 2. 网络连接方案：Tailscale

### 原理
Tailscale 基于 WireGuard 协议，将不同设备组成一个加密的虚拟局域网。设备间通信端到端加密，数据不经过公网中转服务器（P2P 直连优先）。

### 关键特性
- **零配置**：各设备安装客户端并登录同一账号即可，不需要路由器端口转发
- **端到端加密**：设备间通信直接加密传输，不依赖 TLS 证书配置
- **NAT 穿透**：自动处理不同网络环境下的打洞连接
- **对应用透明**：分配的是虚拟网卡 IP（`100.x.x.x`），应用程序直接使用该 IP 通信，无需任何 SDK 或代理配置

### 当前部署

| 设备 | 名称 | Tailscale IP |
|------|------|-------------|
| Windows 电脑 | the2580 | `100.70.198.102` |
| Android 手机 | v2417a | `100.77.203.84` |

> 后端 API 地址：`http://100.70.198.102:8000`（双端通用）

---

## 3. 后端 API 接口文档

### 技术栈

| 组件 | 选型 |
|------|------|
| Web 框架 | FastAPI（Python） |
| ORM | SQLAlchemy |
| 服务器 | uvicorn |
| 数据库 | MySQL 8.0 |
| 驱动 | pymysql |

### 3.1 数据库表结构：`stamina_records`

```sql
CREATE TABLE stamina_records (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    game_name       VARCHAR(32)  NOT NULL,
    package_name    VARCHAR(128) NOT NULL,
    remaining_stamina INT NOT NULL,
    max_stamina     INT NOT NULL,
    capture_time    DATETIME NOT NULL,
    source          VARCHAR(16) NOT NULL DEFAULT 'android',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_game_name (game_name)
);
```

对应 SQLAlchemy 模型 (`backend/models.py`)：

```python
from sqlalchemy import Column, Integer, String, DateTime
from database import Base

class StaminaRecord(Base):
    __tablename__ = "stamina_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_name = Column(String(32), nullable=False, index=True)
    package_name = Column(String(128), nullable=False)
    remaining_stamina = Column(Integer, nullable=False)
    max_stamina = Column(Integer, nullable=False)
    capture_time = Column(DateTime, nullable=False)
    source = Column(String(16), nullable=False, default="android")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
```

### 3.2 数据库连接配置

文件：`backend/database.py`

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "mysql+pymysql://root:Ln08560689@localhost:3306/stamina_db?charset=utf8mb4"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

MySQL 配置：
- Host: `localhost:3306`
- Database: `stamina_db`
- User/Password: `root` / `Ln08560689`
- 表 `stamina_records` 由 `Base.metadata.create_all(bind=engine)` 自动创建

### 3.3 API 端点

> 启动后端后访问 `http://100.70.198.102:8000/docs` 可查看交互式 Swagger UI 文档。

#### POST /api/stamina/record — 记录体力

**请求体 (JSON)**：

```json
{
    "game_name": "原神",
    "package_name": "com.miHoYo.Yuanshen",
    "remaining_stamina": 62,
    "max_stamina": 200,
    "capture_time": "2026-05-26T14:30:00",
    "source": "windows"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| game_name | string | 是 | 游戏名称，如 "原神"、"绝区零" |
| package_name | string | 是 | 游戏包名/进程名，如 "Yuanshen.exe" |
| remaining_stamina | int | 是 | 当前剩余体力 |
| max_stamina | int | 是 | 最大体力上限 |
| capture_time | string (ISO 8601) | 是 | 截图时间 |
| source | string | 否 | 来源，默认 "android"，Windows 客户端传 "windows" |

**响应 (200)**：

```json
{
    "id": 1,
    "game_name": "原神",
    "package_name": "com.miHoYo.Yuanshen",
    "remaining_stamina": 62,
    "max_stamina": 200,
    "capture_time": "2026-05-26T14:30:00",
    "source": "windows",
    "created_at": "2026-05-26T14:30:01.123456"
}
```

#### GET /api/stamina/today/{game_name} — 获取今日最新体力

**路径参数**：`game_name` — 游戏名称

**响应**：
- 有记录时返回最新一条 (200)
- 无记录时返回 `204 No Content`

#### GET /api/stamina/today — 获取今日所有游戏体力

**响应 (200)**：返回各游戏今日最新体力记录的数组

```json
[
    {
        "id": 2,
        "game_name": "原神",
        "remaining_stamina": 62,
        "max_stamina": 200,
        "capture_time": "2026-05-26T14:30:00",
        "source": "windows",
        "created_at": "2026-05-26T14:30:01.123456"
    },
    {
        "id": 3,
        "game_name": "绝区零",
        "remaining_stamina": 180,
        "max_stamina": 240,
        "capture_time": "2026-05-26T14:35:00",
        "source": "android",
        "created_at": "2026-05-26T14:35:01.123456"
    }
]
```

---

## 4. 后端启动方式

```powershell
cd E:\codex_agent_project\AndroidGameInfoTools\backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

`requirements.txt`：
```
fastapi
uvicorn
sqlalchemy
pymysql
```

---

## 5. 核心流程：截图 → OCR → AI 解析 → API

### 5.1 全流程

```
[截取游戏窗口] → [OCR 提取文字] → [DeepSeek AI 解析 xx/yy 格式] → [POST /api/stamina/record]
```

### 5.2 OCR 提取（Android 参考：ML Kit）

Android 端使用 Google ML Kit Chinese Text Recognition（三层提取 block/line/element，置信度 ≥0.15）。

**Windows 端推荐方案**（参考 TextSnap 技术分析文档）：

| 方案 | 准确率 | 速度 | 安装体积 | 推荐度 |
|------|--------|------|----------|--------|
| PaddleOCR (paddlepaddle) | 95-97% | 1-3s (CPU) / 200-500ms (GPU) | ~150MB | ⭐⭐⭐ |
| Tesseract 5 | 85-90% | 2-5s | ~50MB | ⭐⭐ |
| Windows.Media.Ocr | 88-93% | 1-2s | 0 (系统内置) | ⭐⭐ (轻量零依赖) |

### 5.3 DeepSeek AI 解析（可复用）

从 OCR 文字中提取 `xx/yy` 格式的体力数据。

**DeepSeek API 配置**：
- API 地址：`https://api.deepseek.com`
- 认证：Bearer Token（`sk-xxx`）
- 模型：`deepseek-v4-flash`（配置在 `local.properties`）

**AI Prompt 模板**（Android 源码 `StaminaOcrProcessor.kt`）：

```
你是一个精确的游戏数据解析助手。请处理以下OCR识别到的游戏体力信息。
请找出"29/200"格式的文字。
其中"/"前面的数字(29)是剩余体力，"/"后面的数字(200)是最大体力。

游戏: {game_name}
体力名称: {stamina_name}

OCR结果:
{ocr_text}

只返回JSON: {"remaining_stamina": <剩余体力数字>, "max_stamina": <最大体力数字>}
如果找不到xx/yy格式的体力数字，返回: {"remaining_stamina": null, "max_stamina": null}
```

**API 调用方式**（参考 `DeepSeekClient.kt`）：

```python
# Python 示例
import requests
import json

def parse_stamina_via_ai(ocr_text: str, game_name: str, stamina_name: str, api_key: str, model: str = "deepseek-v4-flash"):
    """调用 DeepSeek API 从 OCR 文字中提取体力值"""
    
    system_prompt = "你是一个精确的游戏数据解析助手。只返回JSON。"
    user_prompt = f"""你是一个精确的游戏数据解析助手。请处理以下OCR识别到的游戏体力信息。
请找出类似"29/200"格式的文字。
其中"/"前面的数字(29)是剩余体力，"/"后面的数字(200)是最大体力。

游戏: {game_name}
体力名称: {stamina_name}

OCR结果:
{ocr_text}

只返回JSON: {{"remaining_stamina": <剩余体力数字>, "max_stamina": <最大体力数字>}}
如果找不到xx/yy格式的体力数字，返回: {{"remaining_stamina": null, "max_stamina": null}}"""

    response = requests.post(
        "https://api.deepseek.com/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": 500,
            "temperature": 0.7,
            "stream": False
        },
        timeout=30
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    
    # 从 JSON 响应中提取数值
    import re
    match = re.search(
        r'\{"remaining_stamina"\s*:\s*(\d+|null)[^}]*"max_stamina"\s*:\s*(\d+|null)[^}]*\}',
        content
    )
    if not match:
        return None, None
    
    remaining = int(match.group(1)) if match.group(1) != "null" else None
    maximum = int(match.group(2)) if match.group(2) != "null" else None
    return remaining, maximum
```

### 5.4 体力记录 POST（可复用）

```python
import requests
from datetime import datetime

BACKEND_URL = "http://100.70.198.102:8000"

def post_stamina_record(
    game_name: str,
    package_name: str,
    remaining_stamina: int,
    max_stamina: int,
    capture_time: datetime = None,
    source: str = "windows"
):
    """向后台 API 提交体力记录"""
    if capture_time is None:
        capture_time = datetime.now()
    
    payload = {
        "game_name": game_name,
        "package_name": package_name,
        "remaining_stamina": remaining_stamina,
        "max_stamina": max_stamina,
        "capture_time": capture_time.isoformat(),
        "source": source
    }
    
    response = requests.post(
        f"{BACKEND_URL}/api/stamina/record",
        json=payload,
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def get_today_record(game_name: str):
    """查询某游戏今日最新体力记录"""
    response = requests.get(
        f"{BACKEND_URL}/api/stamina/today/{game_name}",
        timeout=10
    )
    if response.status_code == 204:
        return None
    response.raise_for_status()
    return response.json()


def get_all_today_records():
    """查询今日所有游戏最新体力记录"""
    response = requests.get(
        f"{BACKEND_URL}/api/stamina/today",
        timeout=10
    )
    response.raise_for_status()
    return response.json()
```

---

## 6. 游戏配置参考

Android 端 `GameConfig.kt` 中已定义的 4 款游戏：

| GameId | 游戏名称 | 体力名称 | 应用包名 |
|--------|---------|---------|---------|
| GENSHIN | 原神 | 原粹树脂 | com.miHoYo.Yuanshen |
| ZZZ | 绝区零 | 电量 | com.miHoYo.Nap |
| ENDFIELD | 终末地 | — | (待定) |
| ABNORMAL | 异环 | — | (待定) |

**Windows 端对应进程名**（需实际确认）：

| 游戏 | 推荐 Windows 进程名 | 推荐 package_name 值 |
|------|--------------------|
| 原神 | `YuanShen.exe` 或 `GenshinImpact.exe` | `YuanShen.exe` |
| 绝区零 | `ZenlessZoneZero.exe` | `ZenlessZoneZero.exe` |
| 终末地 | 待确认 | 待确认 |
| 异环 | 待确认 | 待确认 |

---

## 7. 最小可行性示例（Python）

以下是一个完整的端到端最小示例，展示从截图到后端记录的完整调用链：

```python
"""
Windows 端体力捕获工具 — 核心流程演示
依赖: pip install requests opencv-python pillow
DeepSeek AI 部分需要有效的 API Key
"""

import requests
import json
import re
from datetime import datetime
from pathlib import Path

# === 配置 ===
BACKEND_URL = "http://100.70.198.102:8000"
DEEPSEEK_API_KEY = "sk-your-key-here"       # 替换为真实 key
DEEPSEEK_MODEL = "deepseek-v4-flash"

# 游戏配置
GAME_CONFIGS = {
    "原神": {
        "stamina_name": "原粹树脂",
        "process_name": "YuanShen.exe"
    },
    "绝区零": {
        "stamina_name": "电量",
        "process_name": "ZenlessZoneZero.exe"
    }
}


def call_deepseek_parse(ocr_text: str, game_name: str, stamina_name: str):
    """DeepSeek AI 解析体力"""
    user_prompt = (
        f'你是一个精确的游戏数据解析助手。请处理以下OCR识别到的游戏体力信息。\n'
        f'请找出类似"29/200"格式的文字。\n'
        f'其中"/"前面的数字(29)是剩余体力，"/"后面的数字(200)是最大体力。\n\n'
        f'游戏: {game_name}\n'
        f'体力名称: {stamina_name}\n\n'
        f'OCR结果:\n{ocr_text}\n\n'
        f'只返回JSON: {{"remaining_stamina": <数字>, "max_stamina": <数字>}}\n'
        f'如果找不到xx/yy格式的体力数字，返回: {{"remaining_stamina": null, "max_stamina": null}}'
    )
    
    r = requests.post(
        "https://api.deepseek.com/chat/completions",
        headers={
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": DEEPSEEK_MODEL,
            "messages": [
                {"role": "system", "content": "你是一个精确的游戏数据解析助手。只返回JSON。"},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": 500,
            "temperature": 0.7,
            "stream": False
        },
        timeout=30
    )
    r.raise_for_status()
    content = r.json()["choices"][0]["message"]["content"]
    
    match = re.search(
        r'\{"remaining_stamina"\s*:\s*(\d+|null)[^}]*"max_stamina"\s*:\s*(\d+|null)[^}]*\}',
        content
    )
    if not match:
        return None, None
    
    remaining = int(match.group(1)) if match.group(1) != "null" else None
    maximum = int(match.group(2)) if match.group(2) != "null" else None
    return remaining, maximum


def post_to_backend(game_name: str, process_name: str, 
                    remaining: int, maximum: int):
    """提交到尾端 API"""
    payload = {
        "game_name": game_name,
        "package_name": process_name,
        "remaining_stamina": remaining,
        "max_stamina": maximum,
        "capture_time": datetime.now().isoformat(),
        "source": "windows"
    }
    r = requests.post(f"{BACKEND_URL}/api/stamina/record", json=payload, timeout=10)
    r.raise_for_status()
    return r.json()


# === 使用示例 (伪代码) ===
# 1. 截取游戏窗口 → PIL Image
# 2. OCR 提取文字 → ocr_text (string)
# 3. AI 解析
#    rem, max_val = call_deepseek_parse(ocr_text, "原神", "原粹树脂")
# 4. 提交后端 (仅当 AI 成功解析到数值时)
#    if rem is not None and max_val is not None:
#        result = post_to_backend("原神", "YuanShen.exe", rem, max_val)
```

---

## 8. 与 Android 端的共享后端

Windows 和 Android 客户端**共用同一个后端服务**，区别仅在于 `source` 字段：

| 客户端 | source 值 | 判断依据 |
|--------|----------|---------|
| Android | `android` | 默认值 |
| Windows | `windows` | 显式传入 |

后端 API 对 source 不做区分逻辑，仅做记录用途，方便后续按来源筛选统计数据。

---

## 9. 参考资料

- Android 端 API 客户端源码：`AndroidGameInfoTools/app/src/main/java/com/gameinfo/tools/capture/StaminaApiClient.kt`
- 后端 API 源码：`AndroidGameInfoTools/backend/main.py`
- 数据库模型源码：`AndroidGameInfoTools/backend/models.py`
- DeepSeek 客户端源码：`AndroidGameInfoTools/app/src/main/java/com/gameinfo/tools/data/api/DeepSeekClient.kt`
- OCR + AI 解析源码：`AndroidGameInfoTools/app/src/main/java/com/gameinfo/tools/capture/StaminaOcrProcessor.kt`
- 截图技术分析：`TextSnap-技术分析文档.md`（含 PaddleOCR / Win32 GDI 截图 / 图像预处理方案）
- 架构摘要：`AndroidGameInfoTools/architecture-summary.md`
