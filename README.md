# ⚽ QKaito Football Champion Manager - Backend API

> Hệ thống máy chủ Backend hoàn chỉnh cho game quản lý bóng đá chuyên sâu **Football Champion Manager**, được xây dựng bằng **NestJS + TypeScript + Prisma ORM** kết nối cơ sở dữ liệu MySQL 8.0 (91 bảng dữ liệu, 17.630 CLB và hơn 282.000 cầu thủ).

---

## 🚀 Công Nghệ Sử Dụng

- **Framework**: [NestJS](https://nestjs.com/) v10 (TypeScript)
- **Database & ORM**: [Prisma ORM](https://www.prisma.io/) v5 kết nối MySQL 8.0 / MariaDB 10.5
- **Bảo Mật & Xác Thực**: JWT Authentication + Passport JWT + Bcrypt
- **Tài Liệu API**: Swagger / OpenAPI 3.0 tự động sinh tại `/api/docs`
- **Realtime**: WebSockets ([Socket.IO](https://socket.io/)) cho luồng mô phỏng trận đấu trực tiếp (Live Match Simulation)
- **Lập Lịch**: `@nestjs/schedule` phục vụ vòng lặp ngày mùa giải (Season Day Cycle)

---

## Học viện bóng đá trẻ

Màn hình `/academy` có trong cả `footballChampion_FE` và `footballChampion_FEv2`, truy cập từ menu **Học viện trẻ**.

- Hiển thị đội trẻ U19/U21. Nút **Chiêu mộ** chỉ bật khi kỳ chuyển nhượng mở; API kiểm tra lại quyền quản lý CLB và cả hai cờ chuyển nhượng của mùa/timeline.
- Khi khởi tạo mùa, chốt cấp học viện và chỉ tiêu cho tất cả CLB, kể cả CLB chưa có người quản lý. Server khởi động cũng bổ sung các lứa còn thiếu.
- Chỉ tiêu `5 + floor(level / 2)`: cấp 1 có 5; 2–3 có 6; 4–5 có 7; 6–7 có 8; 8–9 có 9; cấp 10 có 10.
- Tuổi 14–16. Xác suất PA từ 80 của mỗi ứng viên là `level × 3%`, tối đa 30%. Đây là xác suất độc lập, không phải số tài năng bảo đảm trong một lứa.
- OVR từ `20 + 2 × level` đến `34 + 2 × level`, cộng 2 điểm mỗi tuổi trên 14 và không vượt PA. PA thường từ `45 + 2 × level` đến 79; nhóm tài năng cao có PA 80–99.
- Lần đầu mở tuyển sinh sinh và lưu toàn bộ hồ sơ theo cấp đã chốt. Mở lại hoặc sang kỳ chuyển nhượng giữa mùa không sinh lại. Ký một người giảm một ứng viên; `player_count` giữ số ban đầu.
- Ký miễn phí, hợp đồng 3 mùa tính cả mùa ký, lương tuần `max(100, OVR × 10)`. Tạo đủ cầu thủ U21, vị trí, attributes, mentality, tactics, trạng thái, hợp đồng, thống kê và tin CLB trong cùng transaction.
- Hợp đồng học viện dùng `squad_role = ACADEMY` và lưu số thứ tự mùa trong các cột hợp đồng `*_season_id`; xử lý hết hạn/gia hạn không phụ thuộc ID database liên tiếp.
- Nâng cấp học viện áp dụng cho lứa mùa sau. Chuyển mùa đánh dấu ứng viên chưa ký là EXPIRED, giữ cầu thủ đã ký và các lứa lịch sử.

API yêu cầu JWT và người đang quản lý CLB:

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/clubs/:clubId/academy` | Đội trẻ, cấp học viện, chỉ tiêu và trạng thái tuyển sinh |
| POST | `/clubs/:clubId/academy/recruitment` | Mở lại danh sách ứng viên của mùa |
| POST | `/clubs/:clubId/academy/candidates/:candidateId/sign` | Ký ứng viên vào U21 |

Cấu trúc database được quản lý tập trung trong `../qkaito_football_champion_schema.sql`.
Mọi thay đổi bảng, cột, index và khóa ngoại cập nhật vào file schema này.
Backend không tự sửa cấu trúc database khi khởi động.
Các lứa cũ thiếu snapshot được giữ nguyên, không tự tạo lại ứng viên.

`npm run test:academy` build và kiểm thử nghiệp vụ. `npm run test:academy:db` kiểm thử MySQL bằng thế giới/CLB riêng rồi rollback toàn bộ dữ liệu kiểm thử; cần database có cấu trúc khớp schema chính và có dữ liệu người dùng, CLB, tiền tệ SOFT hoạt động, học viện cấp 10.

## 🏛️ Kiến Trúc Phân Hệ (12 Modules)

| Phân hệ (Module) | Mô tả & Chức năng chính |
| :--- | :--- |
| **Auth & Users** | Đăng ký HLV, Đăng nhập nhận JWT Token, Lấy hồ sơ cá nhân (`/api/v1/auth`) |
| **Game World & Timeline** | Quản lý Thế giới/Server, Tiến độ mùa giải 40 ngày (Day Loop), Advance Day (`/api/v1/game-worlds`) |
| **Clubs & Facilities** | Danh sách CLB, Chi tiết CLB, Nhận quyền quản lý (`claim`), Sân vận động, Nâng cấp Cơ sở vật chất (`/api/v1/clubs`) |
| **Players & Squad** | Tìm kiếm cầu thủ, Chi tiết hồ sơ OVR & thuộc tính, Đội hình (Đội 1, Dự bị, Trẻ), Rao bán/cho mượn (`/api/v1/players`) |
| **Tactics & Formations** | Danh mục sơ đồ (4-3-3, 4-2-3-1...), Chỉ đạo chiến thuật (Mentality, Tempo, Pressing), Phân công đội hình xuất phát (`/api/v1/tactics`) |
| **Matches & Simulator** | Lịch thi đấu, Nộp đội hình, **Bộ mô phỏng trận đấu 90 phút** (bàn thắng, kiến tạo, thẻ phạt, chấn thương, rating, bán vé) (`/api/v1/matches`) |
| **Live Match Gateway** | WebSocket Gateway phát sự kiện trận đấu thời gian thực theo từng phút (`namespace: matches`) |
| **Competitions** | Danh sách giải đấu, Bảng xếp hạng (Standings), Vua phá lưới (Top Scorers), Vua kiến tạo (`/api/v1/competitions`) |
| **Transfers & Scouting** | Sàn chuyển nhượng, Đề nghị mua/mượn cầu thủ, Phê duyệt/từ chối, Tự động hạch toán tài chính (`/api/v1/transfers`) |
| **Finances & Currencies**| Quản lý số dư Tiền (CASH) & Vàng (GOLD), Sổ cái giao dịch chống trùng lặp (Idempotency), Cửa hàng đổi vàng (`/api/v1/finances`) |
| **Training** | Danh mục 20 bài tập chuyên sâu, Lên lịch tập luyện và phát triển chỉ số (`/api/v1/training`) |

---

## 📦 Cài Đặt & Chạy Hệ Thống

### 1. Yêu Cầu Môi Trường
- **Node.js**: v18+ (Đã kiểm thử trên Node v22)
- **MySQL Server**: v8.0+ đang chạy tại `127.0.0.1:3306`
- **Database**: `football_champion` đã được nạp dữ liệu từ thư mục `d:\backend\footballChampion`

### 2. Cấu Hình Môi Trường (.env)
Tạo file `.env` tại thư mục gốc:
```env
DATABASE_URL="mysql://root:root1234@127.0.0.1:3306/football_champion"
PORT=3000
JWT_SECRET="qkaito_football_champion_secret_jwt_key_2026"
JWT_EXPIRATION="7d"
CORS_ORIGIN="*"
```

### 3. Cài Đặt Gói & Sinh Prisma Client
```bash
npm install
npx prisma generate
```

### 4. Khởi Động Máy Chủ
```bash
# Chế độ phát triển (Hot Reload)
npm run start:dev

# Biên dịch mã nguồn
npm run build

# Chạy bản build sản xuất
npm run start:prod
```

## Giờ thi đấu

- League: 19:00, 19:30, 20:00, 20:30, 21:00 giờ địa phương.
- Cúp quốc gia, Siêu cúp và cúp châu lục: 10:00, 10:30, 11:00, 11:30, 12:00 giờ địa phương.
- U21: 17:00 giờ địa phương.

Vòng bảng U21 đá vòng tròn **một lượt**: 8 bảng × 4 đội, mỗi đội 3 trận vào
Day 7, 12, 17 (mỗi ngày một trận). Tổng vòng bảng 48 trận; không có lượt về.

Backend dùng múi giờ IANA theo quốc gia chủ nhà và ngày thi đấu, bao gồm giờ mùa hè.
Quốc gia có nhiều múi giờ dùng múi giờ đại diện trong `src/common/match-schedule.ts`.
Chung kết chưa có sân trung lập dùng quốc gia CLB được xếp chủ nhà.

`match_date` và `kickoff_time` lưu ngày/giờ server Việt Nam (UTC+7), có điều chỉnh ngày
khi quy đổi qua nửa đêm. `season_day` vẫn là ngày vòng đấu theo lịch địa phương.
API trả `kickoff_time` dạng `HH:mm`; frontend hiển thị trực tiếp, không cộng múi giờ lần nữa.
Cron chuyển ngày chạy lúc 00:00 `Asia/Ho_Chi_Minh`.

Luồng khởi động Day 1 và chuyển mùa vẫn gọi bộ sinh lịch hiện tại. Quy tắc giờ mới
áp dụng khi tạo lịch; bản cập nhật không tự đổi các trận đã lưu trong database.

Kiểm thử: `npm run test:scheduling`.

---

## 📖 Swagger API Documentation

Sau khi khởi động server, truy cập tài liệu API tương tác tại:
👉 **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

---

## ⚽ Bộ Mô Phỏng Trận Đấu (Match Simulation Engine)

Match Simulation Engine tự động tính toán diễn biến 90 phút dựa trên:
1. **Chỉ số Sức mạnh & Danh tiếng**: OVR cầu thủ, lợi thế sân nhà (+8% Home Advantage).
2. **Tỷ lệ Cơ hội & Bàn thắng**: Thuật toán Poisson-like tính toán đối kháng giữa hàng công và hàng thủ.
3. **Sinh Sự Kiện Trận Đấu**:
   - `GOAL` (kèm cầu thủ ghi bàn và cầu thủ kiến tạo)
   - `SHOT_SAVED` (dứt điểm nguy hiểm bị thủ môn cản phá)
   - `YELLOW_CARD` / `RED_CARD`
   - `INJURY`
4. **Hạch Toán Kinh Tế & Khán Giả**:
   - Tỷ lệ lấp đầy khán đài dựa trên danh tiếng 2 đội.
   - Tính toán doanh thu bán vé `attendance * ticket_price`.
   - Tự động cộng tiền mặt vào tài khoản CLB chủ nhà và ghi sổ cái `financial_transactions`.
5. **Phát Trực Tiếp Qua WebSocket**:
   - Client kết nối vào namespace `matches` và gửi `joinMatch`.
   - Nhận sự kiện thời gian thực qua event `matchEvent` và `matchFinished`.
