# Jev × Cobot: trợ lý trình duyệt trên máy tính

Tích hợp tùy chọn dùng Agent thật của [Jev Ultrafast](https://github.com/browser-use/jev-ultrafast), khóa phiên bản `1231850a0bf1a0c0341fe408ef1668dbbfdfac46`. Đây là tác nhân quan sát trạng thái HTML và thao tác giao diện, không nhận diện bàn tay và không tăng FPS camera. Chạy Python trên máy tính, không chạy trực tiếp trong GitHub Pages hoặc iPhone.

1. Cài `uv`, tải mã nguồn Cobot và mở terminal tại thư mục gốc.
2. Cấu hình `TYPESAFE_API_KEY`, `TEXT_MODEL_API_KEY` theo README upstream (text model mặc định dùng OpenRouter). Không đưa khóa vào mã nguồn hay trang Pages.
3. Chạy:

```bash
uv run --with 'git+https://github.com/browser-use/jev-ultrafast.git@1231850a0bf1a0c0341fe408ef1668dbbfdfac46' python integrations/jev/cobot_agent.py
```

Cho phép Browser Harness kết nối Chrome theo hướng dẫn upstream. Mặc định trợ lý đọc trạng thái camera, hiệu năng AI và đồng bộ rồi kết thúc. Tác vụ tùy chỉnh:

```bash
uv run --with 'git+https://github.com/browser-use/jev-ultrafast.git@1231850a0bf1a0c0341fe408ef1668dbbfdfac46' python integrations/jev/cobot_agent.py --goal 'Chọn chế độ hiệu năng Nhẹ · Điện thoại. Kiểm tra lựa chọn đã đổi rồi kết thúc. Không bật camera hoặc thay đổi mốc tay.'
```

Jev gửi trạng thái giao diện tới dịch vụ API; phát sinh phí theo tài khoản. Không chạy tác nhân trong vòng lặp điều khiển từng khung hình. Trạng thái DONE của tác nhân vẫn cần đối chiếu với giao diện thực tế. Script đã kiểm tra cú pháp; chưa chạy API trả phí vì chưa có khóa trong phiên làm việc.

Phần tối ưu nội bộ Cobot áp dụng ý tưởng quan sát một trạng thái nhất quán, kiểm tra độ mới trước khi thực thi, và tách vòng quan sát khỏi hiển thị. `web/live-policy.mjs` là chính sách cục bộ viết riêng, không phải mô hình Jev. Không sao chép mã upstream vào Cobot.
