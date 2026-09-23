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

Mất dấu tay: giữ tư thế ngay. Khi mẫu điều khiển đã cũ quá 450 ms, robot lập tức giữ tư thế; nếu mất dấu liên tục khoảng 1,6–2,8 giây tùy tải AI, mốc mới được yêu cầu. Đổi tay trái/phải, đổi chế độ, dừng hoặc ẩn tab sẽ xóa mốc. Space / Dừng khóa chuyển động robot. Bàn tay robot chỉ bám cử chỉ sau khi lấy mốc; xương tay trước khi lấy mốc vẫn hiển thị đầu vào để căn chỉnh.

## Phạm vi và nguồn

Cánh tay dùng URDF và STL gốc PAROL6; bàn tay năm ngón là phần mô phỏng bổ sung, không phải bộ phận phần cứng PAROL6 đã được xác nhận. Vị trí hiển thị là gốc L6, không phải đầu ngón. IK chỉ giải vị trí J1–J3; hướng cổ tay là ánh xạ tương đối, không phải bộ giải pose IK sáu trục hoàn chỉnh. Độ sâu là ước lượng đơn camera từ kích thước tay; không cam kết theo đúng tọa độ thế giới hoặc sao chép chuyển động 1:1 theo mét. Chưa có kiểm tra va chạm, mô phỏng lực, giới hạn cơ khí ngón thật hoặc kết nối robot thật.

Source Robotics / PCrnjak: PAROL6, GPL-3.0. Các phần bổ sung cùng GPL-3.0. Three.js: MIT. MediaPipe: Apache-2.0, xem web/VENDOR-NOTICE.md. Video được xử lý trong trình duyệt; ứng dụng không gửi video lên máy chủ.

## Triển khai và kiểm tra

GitHub Actions kiểm tra, tải các tệp AI theo phiên bản cố định và SHA-256, giữ chúng trong web/vendor/mediapipe, rồi triển khai Pages. Máy tính: chạy `python scripts/prepare-vision.py`, sau đó `python -m http.server 8000`. Cần HTTPS hoặc localhost; Three.js tải từ CDN. Trang `camera-check.html` kiểm tra API camera gốc độc lập với AI/3D.

`node --test tests/*.test.mjs` kiểm tra camera, chuẩn hóa landmarks, tách co ngón khỏi xoay cổ tay, vị trí trung tính, IK và giới hạn. Workflow kiểm tra MediaPipe thật với camera giả lập và kiểm tra đồng bộ bằng landmarks có kiểm soát. Các kiểm thử không thay thế trải nghiệm camera thật của người dùng, đặc biệt trên iOS.

## Video nổi (LAB 05)
Bật camera → Hiện video nổi để xem video trực tiếp song song với xương tay và cobot. Cửa sổ nổi nằm trong trang; kéo thanh tiêu đề để di chuyển, kéo góc ↘ để đổi kích thước (hoặc chọn góc bằng Tab và dùng phím mũi tên). Nhấn × hoặc Escape khi đang ở cửa sổ để ẩn video mà vẫn giữ nhận diện và mốc tay. Tắt camera sẽ đóng và xóa hình trong popup.

Mặc định video nổi ẩn. Khi bật, popup hiển thị toàn bộ camera, có thể bao gồm mặt và nền; lựa chọn Chỉ xương tay vẫn áp dụng riêng cho khung nhận diện. Popup dùng lại luồng camera hiện có, không yêu cầu thêm camera và hoạt động cả khi mô hình AI đang tải.

## Đồng bộ mẫu tay (LAB 06)
Nhận diện chạy một lần cho mỗi khung video mới, không còn bộ giới hạn 20 Hz. Trong chế độ tay đã lấy mốc, một kết quả nhận diện cập nhật đồng thời tư thế ngón, mục tiêu IK và góc khớp mô phỏng; bỏ lớp làm mượt riêng vốn khiến robot chạy sau hình thị giác. Chế độ thanh trượt/trình diễn vẫn chuyển động mềm. Xương tay 3D hiển thị tư thế quan sát được trước cả khi lấy mốc; cobot chỉ nhận điều khiển sau khi lấy mốc. Khi đang điều khiển, dữ liệu ngón dùng chung một mẫu, còn hướng và vị trí cobot chịu giới hạn động học và có thể khác tay thật. Xương 3D xoay cùng bàn tay cobot, không giữ hướng cố định như trước.

Khung thị giác là quan sát trực tiếp; trước khi lấy mốc hoặc khi dừng nó vẫn cho thấy tay thật, còn cả hai mô hình 3D giữ tư thế. Dòng trạng thái phân biệt rõ trạng thái này với đang bám tay. Đồng bộ là cùng mẫu nhận diện, không phải cam kết không có độ trễ: tốc độ phụ thuộc camera/AI và khả năng máy; robot vẫn bị giới hạn góc và tầm với.

## Chống đứng hình (LAB 07)
- AI chạy trong Web Worker khi trình duyệt hỗ trợ; nếu khởi tạo worker thất bại, dùng đường tương thích có giới hạn tải. Camera và giao diện tiếp tục chạy khi worker xử lý mẫu.
- Chỉ một mẫu đang xử lý, không xếp hàng khung hình. Chuẩn hóa đầu vào tối đa 480 px, bỏ mẫu quá 700 ms hoặc khác phiên camera/tab; worker không trả kết quả sau 4 giây sẽ được đóng và hiện Thử lại AI.
- Nhịp AI thích ứng theo thời gian xử lý (tối đa khoảng 15 mẫu/s), chế độ Nhẹ tối đa 8 mẫu/s; ba hình biểu diễn vẫn dùng cùng kết quả đã chấp nhận. Giao diện 30 FPS mục tiêu, giảm độ phân giải và bóng trên thiết bị cảm ứng. Đây là mức mục tiêu, không cam kết FPS trên mọi máy.
- Watchdog phân biệt video ngừng chạy trên 2,5 giây với AI không thấy tay. Khôi phục camera đóng stream cũ, mở lại và yêu cầu lấy mốc mới. Khi chuyển tab, vô hiệu mốc và kết quả đang chờ.
- Nếu dùng trình duyệt trong ứng dụng trên iPhone và camera bị treo, mở URL bằng Safari rồi bật lại camera. Chế độ ẩn video vẫn mặc định.
- Jev: xem [trợ lý máy tính](integrations/jev/README.md). Không cần khóa API cho camera hoặc chính sách tối ưu cục bộ.

## Bố cục điện thoại (LAB 08)
Khi bật video trên màn hình nhỏ, khung video nằm trong trang ngay phía trên Bật/Tắt camera và Lấy mốc tay, không phủ lên các nút. Chiều cao video giới hạn theo màn hình, thao tác cuộn vẫn hoạt động. Trên máy tính video vẫn là cửa sổ nổi kéo/đổi kích thước. Chuyển kích thước màn hình tự đổi bố cục, dùng cùng luồng camera và không xóa mốc.

## Camera thu nhỏ luôn hiện (LAB 09)
Thay thế bố cục LAB 08: trên điện thoại video nổi mặc định thu nhỏ 210 × 290 px, vẫn theo màn hình khi cuộn. Nút Lấy mốc tay nằm ngay trong cửa sổ video và dùng chung trạng thái khả dụng/hành động với nút chính. ↙ thu nhỏ, ↗ phóng to; cả hai đều giữ video chạy và không thay đổi mốc. Kéo tiêu đề để di chuyển. Chỉ × hoặc Ẩn video mới ẩn cửa sổ. Không tự mở video nếu người dùng chưa chọn Hiện video nổi.


## MINI10 — Camera di động và đồng bộ theo mẫu nguồn
- Trên điện thoại và thiết bị cảm ứng, video camera mini tự hiện sau khi bật camera, nằm ngay trong bảng điều khiển phía trên Bật/Tắt camera và Lấy mốc tay. Nó không còn là lớp phủ cố định che mất nút; ↗/↙ thay đổi chiều cao mà không ẩn video. Trên PC vẫn kéo/đổi kích thước cửa sổ nổi được.
- Theo dõi khung hình giải mã bằng requestVideoFrameCallback (kết hợp fallback currentTime nếu trình duyệt giảm tần suất callback của video ẩn). Watchdog ngưng nhận mẫu khi không còn khung hình; Khôi phục camera hủy stream và phiên nhận diện cũ.
- Ảnh trong khung nhận diện là bản chụp đúng khung hình đã đưa vào MediaPipe, không trộn điểm xương của ảnh cũ với video mới. Cửa sổ video mini là video camera trực tiếp phục vụ quan sát và có thể mới hơn khung đã nhận diện.
- Kết quả AI chỉ được phép điều khiển khi tuổi xử lý không quá 450 ms và đang thuộc đúng phiên camera/tab. Xương tay 3D biểu diễn tư thế bàn tay camera ngay trước khi lấy mốc; robot giữ khi chưa hiệu chuẩn, dừng, mất tay hoặc dữ liệu trễ.
- Điện thoại mặc định chế độ nhẹ, ảnh đưa vào AI tối đa 320 px; dừng dựng cảnh WebGL khi cảnh ở ngoài vùng nhìn thấy. Bài kiểm thử PR xác nhận khung video nội tuyến không đè lên nút điều khiển ở viewport 390×844, độ mới khung hình và phép biến đổi trục lòng bàn tay.
- Đây vẫn là mô phỏng: độ sâu chỉ ước lượng từ một camera; J1–J3 giải IK vị trí, J4–J6 ánh xạ tương đối. Chưa có IK pose sáu trục đầy đủ hoặc kiểm tra va chạm, và không nên điều khiển robot thật trực tiếp bằng kết quả nhận diện chưa được xác thực.
