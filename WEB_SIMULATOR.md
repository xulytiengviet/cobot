# Cobot Lab 04 — tay thật, xương tay và bàn tay robot

## Bắt đầu

Mở trang GitHub Pages của kho. Bật camera, giữ một bàn tay ổn định rồi nhấn **Lấy mốc tay**. Nhãn **ĐỒNG BỘ** xác nhận robot đã bám tay. Mặc định toàn bộ video thật bị ẩn: camera chỉ là nguồn nhận diện, không cần hiển thị khuôn mặt.

- **Chỉ xương tay · Ẩn video:** chỉ vẽ các điểm và đoạn xương lên nền đen. Không vẽ bất kỳ pixel video nào.
- **Camera vùng tay · Có nền:** phóng vùng quanh bàn tay; đây là crop, không phải tách nền hoặc nhận diện khuôn mặt. Nền phía sau tay có thể xuất hiện.
- **Camera đầy đủ:** người dùng chủ động chọn để xem toàn bộ hình camera.
- Video nguồn đặt inline, ẩn, tắt PiP/remote playback theo khả năng trình duyệt. Hành vi cửa sổ nổi do hệ điều hành quản lý có thể khác giữa các thiết bị.

## Đồng bộ chuyển động

Một kết quả MediaPipe gồm 21 landmarks dùng chung cho cả ba hình: khung đầu vào, xương tay 3D và bàn tay robot. Bàn tay robot có năm ngón, mỗi ngón gồm các đốt và khớp hình học. Các landmarks 3D được chuẩn hóa theo hệ trục lòng bàn tay, nên dịch/xoay toàn bàn tay không tự làm co ngón. Bộ lọc làm mượt dùng chung giữa bàn tay robot và xương tay 3D khi đã lấy mốc. Thước phần trăm là độ co ngón ước lượng, không phải phép đo y khoa.

**Đồng bộ tay + cánh tay:** dịch tay ngang/dọc và thay đổi kích thước lòng bàn tay tạo mục tiêu vị trí tương đối cho gốc L6. Bộ giải IK vị trí có damping điều khiển J1–J3 theo URDF. Hướng lòng bàn tay điều khiển J4–J6 tương đối với góc lúc lấy mốc. Năm ngón chạy độc lập với cổ tay; co ngón không được dùng để xoay J5/J6 nữa. Khi ra ngoài tầm với, giữ nghiệm gần nhất trong giới hạn khớp và hiển thị thông báo.

**Cử chỉ · từng khớp:** chọn một J1–J6 và dịch tay ngang; các ngón vẫn bám tay sau khi lấy mốc. Thanh trượt và trình diễn vẫn có sẵn. **Xem bàn tay** đưa góc nhìn lại gần bàn tay robot. Lưu/khôi phục tư thế lưu cả góc cánh tay và tọa độ các ngón trong localStorage; tư thế cũ chỉ gồm sáu góc vẫn đọc được.

Mất dấu tay: giữ tư thế ngay. Mất dưới 0,7 giây có thể tiếp tục theo cùng mốc; lâu hơn phải lấy mốc mới. Đổi tay trái/phải, đổi chế độ, dừng hoặc ẩn tab sẽ xóa mốc. Space / Dừng khóa chuyển động robot. Bàn tay robot chỉ bám cử chỉ sau khi lấy mốc; xương tay trước khi lấy mốc vẫn hiển thị đầu vào để căn chỉnh.

## Phạm vi và nguồn

Cánh tay dùng URDF và STL gốc PAROL6; bàn tay năm ngón là phần mô phỏng bổ sung, không phải bộ phận phần cứng PAROL6 đã được xác nhận. Vị trí hiển thị là gốc L6, không phải đầu ngón. IK chỉ giải vị trí J1–J3; hướng cổ tay là ánh xạ tương đối, không phải bộ giải pose IK sáu trục hoàn chỉnh. Độ sâu là ước lượng đơn camera từ kích thước tay; không cam kết theo đúng tọa độ thế giới hoặc sao chép chuyển động 1:1 theo mét. Chưa có kiểm tra va chạm, mô phỏng lực, giới hạn cơ khí ngón thật hoặc kết nối robot thật.

Source Robotics / PCrnjak: PAROL6, GPL-3.0. Các phần bổ sung cùng GPL-3.0. Three.js: MIT. MediaPipe: Apache-2.0, xem web/VENDOR-NOTICE.md. Video được xử lý trong trình duyệt; ứng dụng không gửi video lên máy chủ.

## Triển khai và kiểm tra

GitHub Actions kiểm tra, tải các tệp AI theo phiên bản cố định và SHA-256, giữ chúng trong web/vendor/mediapipe, rồi triển khai Pages. Máy tính: chạy `python scripts/prepare-vision.py`, sau đó `python -m http.server 8000`. Cần HTTPS hoặc localhost; Three.js tải từ CDN. Trang `camera-check.html` kiểm tra API camera gốc độc lập với AI/3D.

`node --test tests/*.test.mjs` kiểm tra camera, chuẩn hóa landmarks, tách co ngón khỏi xoay cổ tay, vị trí trung tính, IK và giới hạn. Workflow kiểm tra MediaPipe thật với camera giả lập và kiểm tra đồng bộ bằng landmarks có kiểm soát. Các kiểm thử không thay thế trải nghiệm camera thật của người dùng, đặc biệt trên iOS.
