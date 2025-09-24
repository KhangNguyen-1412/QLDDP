Hệ Thống Quản Lý Phòng Ký Túc Xá (QLDDP)
Đây là một ứng dụng web toàn diện được xây dựng bằng React và Firebase, được thiết kế để quản lý các hoạt động hàng ngày trong một phòng ký túc xá. Ứng dụng cung cấp các công cụ mạnh mẽ cho cả quản trị viên (chủ phòng) và các thành viên, giúp tự động hóa và đơn giản hóa việc quản lý.

I. Các Công Nghệ Sử Dụng
Frontend:
React
Tailwind CSS
Recharts (cho biểu đồ)
Axios (để gọi API)
Backend & Cơ sở dữ liệu:
Firebase (Authentication, Firestore Database, Storage)
Dịch vụ bên thứ ba:
Cloudinary: Lưu trữ và quản lý hình ảnh, video.
Google Gemini API: Tích hợp AI để tạo nội dung tự động.
II. Tính Năng Chính
Hệ thống được phân chia chức năng rõ ràng dựa trên vai trò người dùng: Admin (Quản trị viên) và Member (Thành viên).

1. Chức Năng Chung (Dành cho mọi người dùng đã đăng nhập)
Xác thực người dùng:
Đăng nhập bằng Mã số sinh viên (MSSV) và mật khẩu.
Đăng ký tài khoản mới bằng Email cá nhân, MSSV, và các thông tin cơ bản.
Yêu cầu xác minh Email để kích hoạt tài khoản.
Chức năng "Quên mật khẩu" qua email.
Quản lý Hồ sơ cá nhân:
Xem và chỉnh sửa thông tin cá nhân: Họ tên, SĐT, MSSV, ngày sinh, ngày vào KTX.
Tự thay đổi ảnh đại diện (avatar).
Đổi mật khẩu cá nhân.
Giao diện & Trải nghiệm:
Giao diện responsive, tương thích với cả máy tính và điện thoại.
Chế độ Sáng/Tối (Light/Dark mode).
Sidebar điều hướng có thể thu gọn.
2. Chức Năng Dành Cho Thành Viên (Member)
Dashboard Tổng Quan:
Hiển thị các thông tin quan trọng: số thông báo chưa đọc, chi phí cá nhân cần đóng kỳ gần nhất, và các nhiệm vụ trực phòng sắp tới.
Điểm Danh:
Tự điểm danh cho bản thân hàng ngày.
Xem lại lịch sử điểm danh của mình theo tháng.
Tài Chính Cá Nhân:
Xem chi tiết số tiền điện nước cần đóng trong kỳ.
Xem số ngày có mặt được dùng để tính tiền.
Tự đánh dấu "Đã đóng tiền".
Thanh toán tiện lợi bằng cách quét mã QR (VietQR) được tạo tự động với số tiền và nội dung chuyển khoản chính xác.
Sinh Hoạt Chung:
Xem lịch trực phòng của cá nhân.
Xem sơ đồ giường ngủ và vị trí của mình.
Xem thông tin kệ giày và kệ của mình.
Xem thông tin cơ bản của các thành viên khác trong phòng.
Kỷ Niệm Phòng:
Xem tất cả kỷ niệm (ảnh/video) do các thành viên đăng tải.
Đăng tải kỷ niệm mới (hỗ trợ nhiều file cùng lúc).
Chỉnh sửa hoặc xóa các kỷ niệm do chính mình đăng.
Góp Ý:
Gửi góp ý, đề xuất ẩn danh (hoặc không) cho Admin.
3. Chức Năng Dành Cho Quản Trị Viên (Admin)
Admin có tất cả quyền của Member và thêm các chức năng quản lý nâng cao:

Dashboard Quản Trị:
Biểu đồ thống kê tiêu thụ điện, nước qua các tháng.
Biểu đồ tròn phân bổ sinh viên theo khóa học.
Widget hiển thị tổng số người ở và tổng quỹ phòng hiện tại.
Quản Lý Thành Viên:
Thêm/Xóa thành viên trong phòng.
Quản lý danh sách thành viên "chờ" và "tạm thời", chuyển họ vào phòng chính thức.
Vô hiệu hóa tài khoản của thành viên đã rời đi, chuyển họ vào danh sách "Tiền bối".
Chỉnh sửa toàn bộ thông tin chi tiết của bất kỳ thành viên nào.
Trao/Thu hồi quyền điểm danh cho thành viên khác.
Quản Lý Tài Chính Toàn Diện:
Nhập chỉ số điện, nước hàng tháng để tính hóa đơn.
Cập nhật đơn giá điện, nước.
Xem lịch sử tất cả các hóa đơn, đánh dấu đã thanh toán.
Tải lên và xem ảnh chụp hóa đơn điện nước.
Chia tiền điện nước tự động cho từng thành viên dựa trên số ngày có mặt.
Xem lại lịch sử các lần chia tiền và chi tiết ai đã đóng, ai chưa.
Quản lý quỹ phòng: Cập nhật số dư thủ công, ghi nhận các khoản chi tiêu từ quỹ.
Quản Lý Sinh Hoạt Chung:
Lịch trực:
Thêm, xóa, sửa công việc trực phòng.
Phân công nhiệm vụ cho từng thành viên.
Tự động tạo lịch trực cho nhiều ngày bằng Gemini AI.
Sơ đồ phòng: Quản lý và phân chia vị trí giường ngủ.
Kệ giày: Phân công kệ giày cho từng thành viên.
Tương Tác & Truyền Thông:
Xem tất cả góp ý từ thành viên.
Tạo và gửi thông báo tùy chỉnh đến tất cả hoặc một thành viên cụ thể.
Xem lịch sử đăng nhập của tất cả người dùng.
Quản lý Kỷ Niệm:
Có quyền xóa bất kỳ bài đăng kỷ niệm nào.
III. Cấu Trúc Cơ Sở Dữ Liệu (Firestore)
Dữ liệu được tổ chức trong các collection chính dưới đường dẫn artifacts/{projectId}/public/data/:

users: Lưu thông tin tài khoản (email, MSSV, vai trò, thông tin cá nhân, liên kết đến residentId).
residents: Lưu hồ sơ người ở trong phòng (tên, trạng thái active/inactive, mã giường).
pendingResidents: Danh sách thành viên đang chờ được chuyển vào phòng.
formerResidents: Danh sách các "tiền bối" đã rời phòng.
dailyPresence: Lưu trữ dữ liệu điểm danh hàng ngày của từng thành viên.
billHistory: Lịch sử các hóa đơn điện nước tổng của cả phòng.
costSharingHistory: Lịch sử các lần chia tiền, bao gồm chi phí của từng cá nhân.
fundExpenses: Lịch sử các khoản chi tiêu từ quỹ chung.
cleaningTasks: Lịch trực phòng.
shoeRackAssignments: Phân công kệ giày.
memories: Các bài đăng kỷ niệm (ảnh/video).
feedback: Hộp thư góp ý.
notifications: Lưu trữ tất cả các thông báo.
loginHistory: Lịch sử đăng nhập của người dùng.
config: Lưu các cấu hình chung như đơn giá điện/nước (pricing) và mã QR thanh toán (payment).
