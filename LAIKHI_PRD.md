# 來去出門 (Depart) - 開發用 PRD

Version: MVP v0.1  
Platform: iOS (SwiftUI)  
Focus: 多路線最快規劃 + 出門決策  

---

## 1. 產品定義

**名稱**：來去出門 (Depart)

**核心**：一鍵查詢上班路線，自動計算最快方案

**使用情境**：Hybrid 工作者需要開會時，拿起手機看一眼就知道：
- 現在出門最快要幾分鐘？
- 該走哪條路線？
- 路線上有沒有障礙（YouBike 滿位等）？

---

## 2. MVP Scope

### Home Screen

```
────────────────────

來去上班

[Refresh Button]

────────────────────

🏢 公司
台北市中山區○○路

────────────────────

⏱️ 最快方案

🟢 18 分鐘

1️⃣ 走路到捷運站 (5min)
2️⃣ 搭捷運 (10min)
3️⃣ 走路到公司 (3min)

[開始導航]

────────────────────

其他方案

🚌 公車直達
23 分鐘

🚲 騎 YouBike + 捷運
❌ 無法還車（滿位）

────────────────────
```

### 功能清單

- ✅ 固定目的地（公司）
- ✅ 多路線時間計算
- ✅ 自動推薦最快方案
- ✅ 查詢公車 ETA（TDX API）
- ✅ 查詢捷運 ETA（MRT Taipei API）
- ✅ 查詢 YouBike 可用狀態（OpenData）
- ✅ 點擊導航跳轉 Apple Maps
- ✅ 手動 Refresh 按鈕

### 不做（V1.5+）

- ❌ 氣象 / 降雨預報
- ❌ AQI / 溫度決策
- ❌ Widget
- ❌ Notification
- ❌ Live Activity
- ❌ 多個目的地
- ❌ 自訂地址

---

## 3. 路線規劃引擎

### 可行路線

#### Route A: 公車直達

```
家 → 公車站 (walking)
  → 搭公車 (riding)
  → 公司

時間構成：
- 走路到公車站：2 分鐘（固定）
- 公車等待時間：？ (TDX API 查詢)
- 公車車程：15 分鐘（固定）

總時間 = 2 + ETA + 15
```

#### Route B: 走路 + 捷運

```
家 → 捷運站 (walking)
  → 搭捷運 (riding)
  → 公司 (walking)

時間構成：
- 走路到捷運站：5 分鐘（固定）
- 捷運等待時間：？ (MRT API 查詢)
- 捷運車程：10 分鐘（固定）
- 走路到公司：3 分鐘（固定）

總時間 = 5 + 等待 + 10 + 3 = 18 + 等待
```

#### Route C: YouBike + 捷運

```
家 → YouBike 站 (walking)
  → 騎 YouBike (riding)
  → 捷運站 YouBike 停車
  → 搭捷運 (riding)
  → 公司 (walking)

時間構成：
- 走路到 YouBike 站：2 分鐘（固定）
- YouBike 騎行時間：8 分鐘（固定）
- 等待捷運：？ (MRT API 查詢)
- 捷運車程：10 分鐘（固定）
- 走路到公司：3 分鐘（固定）

總時間 = 2 + 8 + 等待 + 10 + 3 = 23 + 等待

約束條件：
IF 捷運站 YouBike 可還格數 == 0
  → 此路線不可行 ❌
```

#### Route D: 直接走路

```
家 → 公司 (walking)

時間構成：
- 走路時間：25 分鐘（固定）

備註：備用方案，永遠可行
```

---

## 4. Decision Logic

### Step 1: 平行查詢三個 API

```
TDX API
  ├─ 公車 307 ETA → BusETA
  ├─ Fallback: 15 min

MRT API (台北捷運)
  ├─ 下班班次 ETA → MRTWaitTime
  ├─ Fallback: 3 min

YouBike API (台北)
  ├─ 捷運站 YouBike 可還格數 → DockAvailable
  └─ Fallback: 0 (不可行)
```

### Step 2: 計算所有路線時間

```
RouteA_Time = 2 + BusETA + 15
RouteB_Time = 5 + MRTWaitTime + 10 + 3
RouteC_Time = (DockAvailable > 0) ? (2 + 8 + MRTWaitTime + 10 + 3) : ∞
RouteD_Time = 25
```

### Step 3: 找最快且可行的路線

```
FastestRoute = min(
  [RouteA, RouteB, RouteC, RouteD]
  其中 Time < ∞ 的路線
)
```

### Step 4: 生成決策

```
IF FastestRoute 時間 < 15 min
  → 🟢 快去！馬上出門

ELSE IF FastestRoute 時間 < 30 min
  → 🟡 可以出門，別拖延

ELSE
  → 🔴 有點遠，早點出發
```

---

## 5. API 整合

### TDX API (公車 307)

**Endpoint**：
```
GET /api/v1/Bus/EstimatedTimeOfArrival/City/Taipei?
  $filter=RouteID eq '307' and StopID eq '{stopID}'
```

**Response**：
```json
{
  "PlateNumb": "307-FA",
  "EstimateTime": 480,  // 秒
  "IsLastBus": false
}
```

**轉換**：480秒 → 8分鐘

**Cache**：3 分鐘

---

### MRT API (台北捷運)

**資料來源**：台北捷運 GTFS Realtime

**查詢**：
- 出發站：用戶家附近捷運站
- 目的地：公司附近捷運站
- 方向：往外地

**回傳**：下班班次等待時間

**Cache**：2 分鐘

---

### YouBike API (台北)

**Endpoint**：
```
https://tcgbusfs.blob.core.windows.net/blobyoubikeweather/YouBikeTP.json
```

**查詢項目**：
- 捷運站 YouBike 站點的 `Available` (可借)
- 捷運站 YouBike 站點的 `EmptyDocks` (可還)

**Response**：
```json
{
  "StationID": "2001",
  "StationName": "中山捷運站",
  "Available": 8,
  "EmptyDocks": 2
}
```

**邏輯**：
```
IF EmptyDocks > 0
  → Route C 可行 ✅

ELSE
  → Route C 不可行 ❌
```

**Cache**：5 分鐘

---

## 6. Data Model (SwiftData)

### Destination

```swift
@Model
final class Destination {
    var id: UUID = UUID()
    var name: String = "公司"
    var address: String
    var latitude: Double
    var longitude: Double
    
    // 公車相關
    var busRouteID: String = "307"
    var busStopID: String  // TDX StopID
    var busWalkingTime: Int = 2  // 分鐘
    var busRidingTime: Int = 15  // 分鐘
    
    // 捷運相關
    var mrtStationName: String  // e.g. "中山站"
    var mrtWalkingTimeToStation: Int = 5  // 分鐘
    var mrtRidingTime: Int = 10  // 分鐘
    var mrtWalkingTimeFromStation: Int = 3  // 分鐘
    
    // YouBike 相關
    var youbikeOutStationID: String  // 家附近
    var youbikeInStationID: String  // 捷運站
    var youbikeWalkingTime: Int = 2  // 分鐘
    var youbikeRidingTime: Int = 8  // 分鐘
    
    // 走路直達
    var walkingDirectTime: Int = 25  // 分鐘
    
    var updatedAt: Date = Date()
}
```

### RouteOption

```swift
struct RouteOption: Identifiable {
    var id: UUID = UUID()
    var type: RouteType  // .bus, .mrt, .youbike, .walking
    var totalTime: Int  // 分鐘
    var steps: [String]  // 步驟說明
    var isAvailable: Bool = true
    var reason: String?  // 不可行原因 e.g. "YouBike 滿位"
}

enum RouteType {
    case bus
    case mrt
    case youbike
    case walking
}
```

---

## 7. User Flow

```
App 啟動

↓

Home 顯示公司

↓

User 點擊 [Refresh]
或 Auto-refresh (每 2 分鐘)

↓

並行呼叫 3 個 API：
  - TDX (公車 ETA)
  - MRT (捷運班次)
  - YouBike (借還狀態)

↓

Decision Engine 計算 4 條路線時間

↓

推薦最快方案 + 列出所有可行方案

↓

User 點擊路線的 [開始導航]

↓

跳轉 Apple Maps
  - Route A: 公車站 → 公司
  - Route B: 捷運站 → 公司
  - Route C: YouBike 站 → 捷運站 → 公司
  - Route D: 家 → 公司 (直走)
```

---

## 8. Architecture

```
Presentation Layer
  - HomeView (SwiftUI)
  - RouteOptionCard
  
ViewModel Layer
  - HomeViewModel
    - 負責協調 API 呼叫
    - 執行 Decision Engine
    - 產生推薦路線
  
Repository Layer
  - DestinationRepository
  - RouteRepository
  
Service Layer
  - BusService (TDX API)
  - MRTService (MRT API)
  - YouBikeService (OpenData)
  - RouteCalculator (決策引擎)
  - LocationService (CoreLocation)
  
Network Layer
  - APIClient (URLSession)
  - TDXClient
  - MRTClient
  - YouBikeClient
  
Models
  - Destination
  - RouteOption
  - TransitInfo
```

---

## 9. Folder Structure

```
DepartApp/

├── App/
│   └── DepartApp.swift
│
├── Features/
│   └── Home/
│       ├── HomeView.swift
│       ├── HomeViewModel.swift
│       └── Views/
│           ├── BestRouteCard.swift
│           ├── RouteOptionCard.swift
│           └── LoadingView.swift
│
├── Models/
│   ├── Destination.swift
│   ├── RouteOption.swift
│   └── TransitInfo.swift
│
├── Repository/
│   ├── DestinationRepository.swift
│   └── RouteRepository.swift
│
├── Services/
│   ├── BusService.swift
│   ├── MRTService.swift
│   ├── YouBikeService.swift
│   ├── RouteCalculator.swift
│   └── LocationService.swift
│
├── Network/
│   ├── APIClient.swift
│   ├── TDXClient.swift
│   ├── MRTClient.swift
│   └── YouBikeClient.swift
│
└── Resources/
    ├── Assets.xcassets
    └── Localizable.strings
```

---

## 10. 核心技術

| 項目 | 選擇 |
|------|------|
| Language | Swift |
| UI Framework | SwiftUI |
| Async | async/await |
| Storage | SwiftData |
| Networking | URLSession |
| Location | CoreLocation |
| Maps | MapKit |
| Architecture | MVVM + Repository |
| Cache | URLCache + Custom |

---

## 11. API 時間估算

假設 API 平行呼叫（不依序）：

```
API Calls (Parallel):
  - TDX: ~1-2 sec
  - MRT: ~0.5-1 sec
  - YouBike: ~0.5-1 sec

最壞情況：2 秒

Decision Engine：<100ms

UI 更新：instant
```

---

## 12. Error Handling

### API 失敗時的 Fallback

```
TDX 失敗
  → 使用上次快取 ETA
  → 若無快取，預設 ETA = 10 分鐘

MRT 失敗
  → 使用上次快取等待時間
  → 若無快取，預設等待 = 3 分鐘

YouBike 失敗
  → Route C 標記為 "資料更新中"
  → 仍可顯示，但提醒使用者可能資訊過期
```

### 網路問題

```
無網路
  → 顯示上次成功的結果 + "資訊可能過期"
  → 提供 Retry 按鈕

API 全部失敗
  → 顯示預設方案
  → 鼓勵使用者手動打開 Google Maps
```

---

## 13. 開發階段

### Phase 1: 資料模型 + API 整合

- [ ] SwiftData Destination Schema
- [ ] TDX API Client
- [ ] MRT API Client  
- [ ] YouBike API Client
- [ ] 3 個 API 的 Error Handling + Cache

### Phase 2: 路線計算引擎

- [ ] RouteCalculator Service
- [ ] 4 路線時間計算邏輯
- [ ] Decision Logic（推薦最快方案）

### Phase 3: UI + ViewModel

- [ ] HomeView UI
- [ ] HomeViewModel（協調 API 和計算）
- [ ] BestRouteCard（推薦路線）
- [ ] RouteOptionCard（其他方案）
- [ ] LoadingView + Error UI

### Phase 4: 導航 + 完善

- [ ] Apple Maps 整合
- [ ] Dark Mode
- [ ] Accessibility
- [ ] 初始設定流程（設定目的地座標）

---

## 14. 成功標準

- ✅ API 能正確查詢 3 個資料源
- ✅ 路線計算邏輯正確
- ✅ 推薦最快方案準確
- ✅ UI 清晰展示 4 條路線 + 耗時
- ✅ 點擊導航能正確打開 Apple Maps
- ✅ 網路失敗時有 Graceful Fallback

---

## 15. 未來功能 (V1.5+)

- 氣象 / 降雨預報整合
- Widget（顯示最快方案）
- Notification（出發提醒）
- 自訂多個目的地
- Apple Watch
- 路線歷史紀錄
