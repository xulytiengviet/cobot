# Cobot Lab — PAROL6 điều khiển bằng bàn tay

Trang `index.html` chạy trực tiếp trên GitHub Pages, không cần backend. Mô hình dùng bảy STL và chuỗi khớp, phép biến đổi, trục quay, giới hạn góc từ `PAROL6_URDF/PAROL6/urdf/PAROL6.urdf`. Giữ nguyên mã firmware và các tài liệu gốc.

## Chạy

- GitHub: Settings → Pages → Source: **GitHub Actions**. Workflow `Deploy Cobot Lab` sẽ triển khai trang khi push lên main; có thể chạy thủ công trong Actions.
- Máy tính: tại thư mục repo, chạy `python scripts/prepare-vision.py`, sau đó `python -m http.server 8000`, mở `http://localhost:8000`.
- Camera cần HTTPS hoặc localhost, không mở bằng `file://`. Cần Internet để tải Three.js, MediaPipe và mô hình tay. Không yêu cầu API key.

## Điều khiển

1. Bấm **Bật camera**, cho phép truy cập camera. Giữ một bàn tay mở trong khung hình, ánh sáng đủ.
2. Bấm **Lấy mốc tay**. Góc robot hiện tại trở thành gốc điều khiển tương đối.
3. Chế độ **Cử chỉ · 6 khớp**: ngang → J1, dọc → J2, kích thước lòng bàn tay → J3, góc nghiêng bàn tay → J4, độ duỗi ngón trỏ → J5, khoảng cách ngón cái–trỏ → J6.
4. Chế độ **Cử chỉ · từng khớp**: chọn J1–J6, lấy mốc, dịch tay ngang. Chế độ này dễ kiểm soát và tách từng trục.
5. Mất dấu tay: giữ nguyên góc ngay, xóa mốc. Đưa tay trở lại rồi lấy mốc mới. Đổi chế độ / đổi khớp cũng yêu cầu lấy mốc mới.
6. **Dừng** hoặc Space khóa chuyển động. **Tiếp tục** mở khóa. Có thanh trượt, trình diễn, về gốc và lưu / khôi phục một tư thế vào localStorage.

## Phạm vi

Đây là mô phỏng **động học thuận**, không phải bộ giải IK theo vị trí đầu công tác, mô phỏng động lực học hay bộ điều khiển robot thật. Sáu góc là sáu khớp PAROL6; chụm ngón điều khiển J6, không phải kẹp (mô hình gốc không có kẹp). Vị trí hiển thị là gốc link L6, không phải TCP của dụng cụ. J6 là continuous trong URDF nhưng giao diện sử dụng khoảng -3.1…3.1 rad có khai báo trong file để điều khiển hữu hạn. Mô phỏng chưa kiểm tra va chạm / tự va chạm.

Độ sâu chỉ suy ra tương đối từ kích thước bàn tay trong ảnh 2D; không đo khoảng cách vật lý. Dùng một tay cố định, lấy lại mốc khi đổi tay. Các đặc trưng tay có thể ảnh hưởng lẫn nhau; chế độ từng khớp giúp thao tác chính xác hơn. Chuyển động có làm mượt và giới hạn tốc độ mô phỏng 1.2 rad/s.

Video không được gửi lên máy chủ bởi ứng dụng. Trình duyệt tải các thư viện / model từ jsDelivr và Google, nhận diện tại máy. Tắt camera giải phóng luồng video. Quyền camera có thể cần được đặt lại cạnh thanh địa chỉ nếu trước đó đã từ chối.

## Kiểm tra

`node --test tests/control.test.mjs` kiểm tra trung tính, sáu đặc trưng, giới hạn góc, liên tục góc nghiêng, điều khiển riêng khớp, giới hạn vận tốc và loại bỏ bàn tay quá nhỏ. Kiểm tra camera thật vẫn cần thực hiện trên laptop.

## Nguồn và giấy phép

PAROL6: Source Robotics / PCrnjak; giữ LICENSE GPL-3.0 của kho mã nguồn. Phần mô phỏng bổ sung được cung cấp theo cùng GPL-3.0. Three.js: MIT; MediaPipe: Apache-2.0. Các thư viện tải riêng qua CDN, không thay đổi giấy phép của mô hình / mã gốc.

## Bản sửa camera 23/09/2026

Camera được mở và kiểm tra có khung hình trước khi tải AI. Các tệp MediaPipe và mô hình được tải, kiểm tra SHA-256 trong bước triển khai rồi phục vụ từ chính GitHub Pages. Khi AI lỗi, camera tiếp tục hiển thị và có nút **Thử lại AI**. Giao diện có chọn thiết bị; tắt camera trước khi đổi thiết bị. Lỗi quyền, camera đang bận, không có camera và quá thời gian được phân biệt, kèm mã lỗi. Có thời hạn chờ và giải phóng luồng camera đến muộn sau khi người dùng hủy.

Workflow chạy `node --test tests/*.test.mjs` và kiểm thử Chromium với camera giả lập: khởi tạo MediaPipe thật, suy luận video, giữ camera khi tải mô hình thất bại và thử lại thành công. Kiểm thử này không thay thế kiểm tra driver/camera thật trên laptop.
