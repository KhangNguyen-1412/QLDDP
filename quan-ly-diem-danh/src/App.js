import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  sendEmailVerification,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  onSnapshot,
  query,
  addDoc,
  serverTimestamp,
  deleteDoc,
  getDocs,
  where,
  getDoc,
  updateDoc,
  orderBy,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL} from 'firebase/storage'; // Thêm imports cho Firebase Storage
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { QRCodeCanvas } from 'qrcode.react';

// Firebase Config - Moved outside the component to be a constant
const firebaseConfig = {
  apiKey: 'AIzaSyBMx17aRieYRxF2DiUfVzC7iJPXOJwNiy0',
  authDomain: 'qlddv2.firebaseapp.com',
  projectId: 'qlddv2',
  storageBucket: 'qlddv2.firebasestorage.app',
  messagingSenderId: '946810652108',
  appId: '1:946810652108:web:a4b75fe67c41ba132c0969',
  measurementId: 'G-0G06LXY4D8',
};

// currentAppId should consistently be the projectId - Moved outside the component
const currentAppId = firebaseConfig.projectId;

// KHAI BÁO HẰNG SỐ CLOUDINARY Ở ĐÂY
const CLOUDINARY_CLOUD_NAME = 'dzvcgfkxs'; // Thay bằng Cloud Name của bạn
const CLOUDINARY_UPLOAD_PRESET_MEMORY = 'qun_ly_phong'; // Đổi tên để rõ ràng hơn cho kỷ niệm
const CLOUDINARY_UPLOAD_PRESET_AVATAR = 'qun_ly_phong'; // Bạn có thể dùng chung preset này cho avatar
const CLOUDINARY_API_URL_IMAGE_UPLOAD = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`; // API cho upload ảnh
const CLOUDINARY_API_URL_AUTO_UPLOAD = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`; // API cho upload tự động (ảnh/video)
// KẾT THÚC KHAI BÁO CLOUDINARY

function App() {
  //Hàm xử lý việc tải ảnh QR lên Cloudinary và lưu URL lại.
  const handleUploadQrCode = async () => {
    if (!newQrCodeFile || userRole !== 'admin') {
      setBillingError('Vui lòng chọn một file ảnh hoặc bạn không có quyền.');
      return;
    }
    setIsUploadingQrCode(true);

    const formData = new FormData();
    formData.append('file', newQrCodeFile);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET_AVATAR); // Có thể dùng chung preset

    try {
      const response = await axios.post(CLOUDINARY_API_URL_IMAGE_UPLOAD, formData);
      const downloadURL = response.data.secure_url;

      const configDocRef = doc(db, `artifacts/${currentAppId}/public/data/config`, 'payment');
      await setDoc(configDocRef, { qrCodeUrl: downloadURL }, { merge: true });

      setNewQrCodeFile(null);
      alert('Đã cập nhật mã QR thanh toán thành công!');
    } catch (error) {
      console.error("Lỗi khi tải lên mã QR:", error);
      setBillingError('Đã xảy ra lỗi khi tải lên mã QR.');
    } finally {
      setIsUploadingQrCode(false);
    }
  };
  // Hàm cho thu gọn sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  //Hàm set csdl
  const [storage, setStorage] = useState(null);
  // Các state liên quan tới theme mùa
  const [seasonalEffectElements, setSeasonalEffectElements] = useState([]);

  // Hàm hiện popover thông tin và nút đăng xuất
  const [profilePopoverAnchor, setProfilePopoverAnchor] = useState(null);

  const handleProfileClick = (event) => {
  // Nếu popover đã mở (anchor đã tồn tại), thì đóng nó lại.
  // Ngược lại, nếu đang đóng, thì mở nó ra.
  setProfilePopoverAnchor(profilePopoverAnchor ? null : event.currentTarget);
};

  const handleProfileClose = () => {
    setProfilePopoverAnchor(null);
  };

  const popoverRef = useRef(null); // Tạo một ref

  useEffect(() => {
    // Hàm để xử lý khi click ra ngoài
    function handleClickOutside(event) {
      // Nếu popover đang mở và vị trí click không nằm trong popover
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        handleProfileClose(); // Thì đóng popover
      }
    }

    // Thêm trình lắng nghe sự kiện khi popover mở
    if (profilePopoverAnchor) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    // Dọn dẹp trình lắng nghe khi component unmount hoặc popover đóng
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profilePopoverAnchor]);

  // Thêm state để kiểm soát việc Admin thêm tài khoản mới
  const [newAccountStudentId, setNewAccountStudentId] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountFullName, setNewAccountFullName] = useState('');
  const [newAccountPersonalEmail, setNewAccountPersonalEmail] = useState(''); // Email cá nhân ban đầu (tùy chọn)

  // State để theo dõi việc có cần hiển thị thông báo xác minh email không
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loggedInResidentProfile, setLoggedInResidentProfile] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [residents, setResidents] = useState([]);
  const [newResidentName, setNewResidentName] = useState('');
  const [showInactiveResidents, setShowInactiveResidents] = useState(false);
  // Hàm kiểm tra đăng nhập
  const [authMode, setAuthMode] = useState('login'); // 'login' hoặc 'register'
  const [studentIdForLogin, setStudentIdForLogin] = useState('');
  const [newStudentIdForAuth, setNewStudentIdForAuth] = useState('');

  //Hàm ghi số ký điện và số khối nước mới
  const [currentElectricityReading, setCurrentElectricityReading] = useState('');
  const [currentWaterReading, setCurrentWaterReading] = useState('');

  //Hàm ghi số ký điện và số khối nước cũ
  const [lastElectricityReading, setLastElectricityReading] = useState(0);
  const [lastWaterReading, setLastWaterReading] = useState(0);

  //Hàm giá tiền điện, nước & tổng tiền
  const [electricityCost, setElectricityCost] = useState(0);
  const [waterCost, setWaterCost] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  //Hàm dành cho mục điểm danh
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [monthlyAttendanceData, setMonthlyAttendanceData] = useState({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calculatedDaysPresent, setCalculatedDaysPresent] = useState({});
  const [totalCalculatedDaysAllResidents, setTotalCalculatedDaysAllResidents] = useState(0);
  const [costPerDayPerPerson, setCostPerDayPerPerson] = useState(0);
  const [individualCosts, setIndividualCosts] = useState({});
  const [remainingFund, setRemainingFund] = useState(0);

  const [selectedResidentForReminder, setSelectedResidentForReminder] = useState('');
  const [generatedReminder, setGeneratedReminder] = useState('');
  const [isGeneratingReminder, setIsGeneratingReminder] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState('');
  const [billingError, setBillingError] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');
  // Thêm state này vào cùng với các state xác thực khác
  const [personalEmailForRegister, setPersonalEmailForRegister] = useState('');

  // New states for member's editable profile
  const [memberPhoneNumber, setMemberPhoneNumber] = useState('');
  const [memberAcademicLevel, setMemberAcademicLevel] = useState('');
  const [memberDormEntryDate, setMemberDormEntryDate] = useState('');
  const [memberBirthday, setMemberBirthday] = useState('');
  const [memberStudentId, setMemberStudentId] = useState('');
  const [editProfileMode, setEditProfileMode] = useState(false);
  const [updateSuccessMessage, setUpdateSuccessMessage] = useState('');

  const [allUsersData, setAllUsersData] = useState([]);

  const [billHistory, setBillHistory] = useState([]);
  const [selectedBillDetails, setSelectedBillDetails] = useState(null);

  const [monthlyConsumptionStats, setMonthlyConsumptionStats] = useState({});

  const [costSharingHistory, setCostSharingHistory] = useState([]);
  const [selectedCostSharingDetails, setSelectedCostSharingDetails] = useState(null);

  // State for Cleaning Schedule
  const [cleaningSchedule, setCleaningSchedule] = useState([]);
  const [newCleaningTaskName, setNewCleaningTaskName] = useState('');
  const [newCleaningTaskDate, setNewCleaningTaskDate] = useState('');
  const [selectedResidentForCleaning, setSelectedResidentForCleaning] = useState('');
  const [showGenerateScheduleModal, setShowGenerateScheduleModal] = useState(false);
  const [generatedCleaningTasks, setGeneratedCleaningTasks] = useState([]);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [numDaysForSchedule, setNumDaysForSchedule] = useState(7);

  // State for Shoe Rack Management
  const [shoeRackAssignments, setShoeRackAssignments] = useState({});
  const [selectedShelfNumber, setSelectedShelfNumber] = useState('');
  const [selectedResidentForShelf, setSelectedResidentForShelf] = useState('');

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  //Hàm kiểm tra lượt đăng nhập 
  const [loginHistory, setLoginHistory] = useState([]);

  // useEffect tải lịch sử đăng nhập cho admin
  useEffect(() => {
    if (db && (userRole === 'admin' || userRole === 'developer')) {
      const historyQuery = query(
        collection(db, `artifacts/${currentAppId}/public/data/loginHistory`), 
        orderBy('loginAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
        const historyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLoginHistory(historyList);
      });

      return () => unsubscribe();
    }
  }, [db, userRole]);

  //State cho feedback
  const [feedbackContent, setFeedbackContent] = useState('');
  const [allFeedback, setAllFeedback] = useState([]); // Chỉ dành cho admin
  //State phóng to 
  const [selectedFeedbackDetails, setSelectedFeedbackDetails] = useState(null);

  // Hàm gửi góp ý
  const handleSendFeedback = async (e) => {
    e.preventDefault();
    if (!db || !userId || !feedbackContent.trim()) {
      alert('Nội dung góp ý không được để trống.');
      return;
    }

    const feedbackCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/feedback`);
    try {
      await addDoc(feedbackCollectionRef, {
        content: feedbackContent.trim(),
        submittedBy: userId,
        submittedByName: fullName,
        submittedAt: serverTimestamp(),
        status: 'new',
      });
      setFeedbackContent('');
      alert('Cảm ơn bạn đã gửi góp ý! Chúng mình sẽ xem xét sớm nhất có thể.');
    } catch (error) {
      console.error("Lỗi khi gửi góp ý:", error);
      alert('Đã xảy ra lỗi khi gửi góp ý.');
    }
  };
  //useEffect cho gửi góp ý
  useEffect(() => {
    if (db && userRole === 'admin') {
      const feedbackQuery = query(collection(db, `artifacts/${currentAppId}/public/data/feedback`), orderBy('submittedAt', 'desc'));
      
      const unsubscribe = onSnapshot(feedbackQuery, (snapshot) => {
        const feedbackList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllFeedback(feedbackList);
      });

      return () => unsubscribe();
    }
  }, [db, userRole]);

  //Hàm nâng cấp vai trò cho Admin
  const handleUpgradeToAdmin = async (targetUserId) => {
    if (userRole !== 'admin') {
      setAuthError('Bạn không có quyền thực hiện thao tác này.');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn nâng cấp người này lên vai trò quản trị viên không?`)) {
      return;
    }

    const userDocRef = doc(db, `artifacts/${currentAppId}/public/data/users`, targetUserId);
    try {
      await updateDoc(userDocRef, {
        role: 'admin'
      });
      alert(`Đã nâng cấp vai trò thành công!`);
    } catch (error) {
      console.error("Lỗi khi nâng cấp vai trò:", error);
      setAuthError('Đã xảy ra lỗi khi nâng cấp vai trò.');
    }
  };

  //State show mã qr thanh 
  const [showQrCodeModal, setShowQrCodeModal] = useState(false);
  //State tải mã qr
  const [qrCodeUrl, setQrCodeUrl] = useState(null); // Lưu URL của mã QR
  const [newQrCodeFile, setNewQrCodeFile] = useState(null);
  const [isUploadingQrCode, setIsUploadingQrCode] = useState(false);
  //useEffect tải mã qr lên web
  useEffect(() => {
    if (db) {
      const configDocRef = doc(db, `artifacts/${currentAppId}/public/data/config`, 'payment');
      const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setQrCodeUrl(docSnap.data().qrCodeUrl || null);
        }
      });
      return () => unsubscribe();
    }
  }, [db]);
  //State zoom mã qr
  const [isQrCodeZoomed, setIsQrCodeZoomed] = useState(false);

  // State for Room Memories
  const [memories, setMemories] = useState([]);
  const [newMemoryEventName, setNewMemoryEventName] = useState('');
  const [newMemoryPhotoDate, setNewMemoryPhotoDate] = useState('');
  const [newMemoryImageFile, setNewMemoryImageFile] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingMemory, setIsUploadingMemory] = useState(false);
  const [memoryError, setMemoryError] = useState('');
  const [searchTermMemory, setSearchTermMemory] = useState('');
  const [filterUploaderMemory, setFilterUploaderMemory] = useState('all'); // 'all' hoặc userId

  const [showAddMemoryModal, setShowAddMemoryModal] = useState(false);

  // States for Former Residents <-- KHAI BÁO CHÍNH XÁC VÀ DUY NHẤT Ở ĐÂY
  const [formerResidents, setFormerResidents] = useState([]); // <-- Đảm bảo dòng này tồn tại và không bị xóa
  const [newFormerResidentName, setNewFormerResidentName] = useState('');
  const [newFormerResidentEmail, setNewFormerResidentEmail] = useState('');
  const [newFormerResidentPhone, setNewFormerResidentPhone] = useState('');
  const [newFormerResidentStudentId, setNewFormerResidentStudentId] = useState('');
  const [newFormerResidentBirthday, setNewFormerResidentBirthday] = useState('');
  const [newFormerResidentDormEntryDate, setNewFormerResidentDormEntryDate] = useState('');
  const [newFormerResidentAcademicLevel, setNewFormerResidentAcademicLevel] = useState('');
  const [newFormerResidentDeactivatedDate, setNewFormerResidentDeactivatedDate] = useState(''); // Ngày vô hiệu hóa thủ công
  const [showAddFormerResidentModal, setShowAddFormerResidentModal] = useState(false);
  const [searchTermFormerResident, setSearchTermFormerResident] = useState('');
  const [newFormerResidentContact, setNewFormerResidentContact] = useState('');
  const [newFormerResidentNotes, setNewFormerResidentNotes] = useState('');

  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notificationError, setNotificationError] = useState(''); // Để hiển thị lỗi liên quan đến thông báo

  // New states for Change Password feature
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeMessage, setPasswordChangeMessage] = useState(''); // Để hiển thị thông báo thành công/lỗi khi đổi mật khẩu

  // State for sidebar navigation
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const hasInitialized = useRef(false);

  const [selectedNotificationDetails, setSelectedNotificationDetails] = useState(null); // Để hiển thị chi tiết thông báo

  //State cập nhật điện nước
  const [electricityRate, setElectricityRate] = useState(2580); // Giá mặc định ban đầu
  const [waterRate, setWaterRate] = useState(4000); // Giá mặc định ban đầu
  const [newElectricityRate, setNewElectricityRate] = useState('');
  const [newWaterRate, setNewWaterRate] = useState('');

  //useEffect cập nhật điện nước
  useEffect(() => {
    if (db && userRole === 'admin') {
      const configDocRef = doc(db, `artifacts/${currentAppId}/public/data/config`, 'pricing');
      
      const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setElectricityRate(data.electricityRate || 2580);
          setWaterRate(data.waterRate || 4000);
        }
      });

      return () => unsubscribe();
    }
  }, [db, userRole]);

  //Hàm cập nhật giá
  const handleUpdateRates = async () => {
    if (userRole !== 'admin') {
      setBillingError('Bạn không có quyền thực hiện thao tác này.');
      return;
    }
    const newElecRate = parseFloat(newElectricityRate);
    const newWatRate = parseFloat(newWaterRate);

    if (isNaN(newElecRate) || isNaN(newWatRate) || newElecRate <= 0 || newWatRate <= 0) {
      setBillingError('Vui lòng nhập giá điện và nước hợp lệ.');
      return;
    }

    const configDocRef = doc(db, `artifacts/${currentAppId}/public/data/config`, 'pricing');
    try {
      await setDoc(configDocRef, {
        electricityRate: newElecRate,
        waterRate: newWatRate,
        lastUpdated: serverTimestamp()
      }, { merge: true });

      setNewElectricityRate('');
      setNewWaterRate('');
      setBillingError('');
      alert('Đã cập nhật giá điện nước thành công!');
    } catch (error) {
      console.error("Lỗi khi cập nhật giá:", error);
      setBillingError('Đã xảy ra lỗi khi cập nhật giá.');
    }
  };

  // New state for Image Lightbox/Zoom
  const [selectedImageToZoom, setSelectedImageToZoom] = useState(null); // Lưu URL của ảnh muốn phóng to

  // Hàm trao quyền cho member điểm danh
  const handleToggleAttendancePermission = async (targetUserId, currentStatus) => {
    if (userRole !== 'admin') {
      setAuthError('Bạn không có quyền thực hiện thao tác này.');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn ${currentStatus ? 'thu hồi' : 'trao'} quyền điểm danh cho người này?`)) {
      return;
    }

    const userDocRef = doc(db, `artifacts/${currentAppId}/public/data/users`, targetUserId);
    try {
      await updateDoc(userDocRef, {
        canTakeAttendance: !currentStatus // Đảo ngược trạng thái hiện tại
      });
      alert(`Đã ${!currentStatus ? 'trao' : 'thu hồi'} quyền điểm danh thành công!`);
    } catch (error) {
      console.error("Lỗi khi cập nhật quyền điểm danh:", error);
      setAuthError('Đã xảy ra lỗi khi cập nhật quyền.');
    }
  };

  // Hàm để thêm một kỷ niệm mới
  const handleAddMemory = async (e) => {
    e.preventDefault();
    setMemoryError('');
    if (!db || !auth || !newMemoryEventName || !newMemoryPhotoDate || newMemoryImageFile.length === 0) {
      setMemoryError('Vui lòng điền đầy đủ thông tin và chọn ít nhất một file.');
      return;
    }
    if (!userId) {
      setMemoryError('Bạn cần đăng nhập để đăng kỷ niệm.');
      return;
    }

    setIsUploadingMemory(true);
    setUploadProgress(0);

    try {
      const uploadedFilesInfo = []; // Để lưu URL, publicId, fileType của tất cả các file

      for (const file of newMemoryImageFile) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET_MEMORY);

        const response = await axios.post(CLOUDINARY_API_URL_AUTO_UPLOAD, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          },
        });
        uploadedFilesInfo.push({
          fileUrl: response.data.secure_url,
          publicId: response.data.public_id,
          fileType: response.data.resource_type,
        });
      }

      const memoriesCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/memories`);
      const uploaderStudentId = loggedInResidentProfile?.studentId || allUsersData.find((u) => u.id === userId)?.studentId;
      await addDoc(memoriesCollectionRef, {
        eventName: newMemoryEventName.trim(),
        photoDate: newMemoryPhotoDate,
        files: uploadedFilesInfo, // LƯU MẢNG CÁC ĐỐI TƯỢNG FILE
        uploadedBy: userId,
        uploadedAt: serverTimestamp(),
        uploadedByStudentId: uploaderStudentId, // <-- LƯU MSSV thay vì UserID
        uploadedByName: loggedInResidentProfile 
          ? loggedInResidentProfile.name 
          : allUsersData.find((u) => u.id === userId)?.fullName || 'Người dùng ẩn danh',
        // Bạn vẫn có thể giữ lại uploadedBy: userId để tham chiếu nếu cần
        uploadedBy: userId,
      });

      setNewMemoryEventName('');
      setNewMemoryPhotoDate('');
      setNewMemoryImageFile([]); // Reset mảng file
      setUploadProgress(0);
      setIsUploadingMemory(false);
      setShowAddMemoryModal(false);
      alert('Đã thêm kỷ niệm mới thành công!');
      console.log('Đã thêm kỷ niệm mới thành công!');
    } catch (error) {
      console.error('Lỗi khi thêm kỷ niệm (tổng thể):', error);
      setMemoryError(`Lỗi khi thêm kỷ niệm: ${error.message}`);
    }
  };

  const [editingMemory, setEditingMemory] = useState(null); // Lưu bài đăng kỷ niệm đang được chỉnh sửa
  const [editMemoryEventName, setEditMemoryEventName] = useState('');
  const [editMemoryPhotoDate, setEditMemoryPhotoDate] = useState('');
  const [editMemoryNewFiles, setEditMemoryNewFiles] = useState([]); // File mới thêm vào bài đăng đã có
  const [isUploadingEditMemory, setIsUploadingEditMemory] = useState(false);
  const [editMemoryUploadProgress, setEditMemoryUploadProgress] = useState(0);
  const [editMemoryError, setEditMemoryError] = useState('');

  //Hàm chỉnh sửa bài đăng kỷ niệm
  const handleEditMemory = (memory) => {
    setEditingMemory(memory);
    setEditMemoryEventName(memory.eventName);
    setEditMemoryPhotoDate(memory.photoDate);
    setEditMemoryNewFiles([]); // Reset files khi bắt đầu chỉnh sửa
    setEditMemoryError('');
  };

  // Hàm cập nhật bài đăng kỷ niệm
  const handleUpdateMemory = async (e) => {
    e.preventDefault();
    setEditMemoryError('');
    if (!db || !auth || !editingMemory) {
      setEditMemoryError('Không có kỷ niệm nào được chọn để cập nhật.');
      return;
    }
    if (!editMemoryEventName || !editMemoryPhotoDate) {
      setEditMemoryError('Vui lòng điền đầy đủ thông tin sự kiện và ngày.');
      return;
    }

    setIsUploadingEditMemory(true);
    setEditMemoryUploadProgress(0);

    try {
      // Bắt đầu với CÁC FILE HIỆN CÓ từ editingMemory.files
      // Đảm bảo editingMemory.files luôn là một mảng (vì đã được xử lý trong useEffect)
      let updatedFilesInfo = editingMemory.files ? [...editingMemory.files] : [];

      // Tải lên các file mới được thêm vào
      if (editMemoryNewFiles.length > 0) {
        for (const file of editMemoryNewFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET_MEMORY);

          const response = await axios.post(CLOUDINARY_API_URL_AUTO_UPLOAD, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setEditMemoryUploadProgress(percentCompleted);
            },
          });
          // Thêm thông tin file mới vào mảng
          updatedFilesInfo.push({
            fileUrl: response.data.secure_url,
            publicId: response.data.public_id,
            fileType: response.data.resource_type,
          });
        }
      }

      const memoryDocRef = doc(db, `artifacts/${currentAppId}/public/data/memories`, editingMemory.id);
      await updateDoc(memoryDocRef, {
        eventName: editMemoryEventName.trim(),
        photoDate: editMemoryPhotoDate,
        files: updatedFilesInfo, // CHỈ CẬP NHẬT TRƯỜNG 'files'
        lastUpdatedBy: userId,
        lastUpdatedAt: serverTimestamp(),
      });

      setEditingMemory(null); // Đóng modal chỉnh sửa
      setEditMemoryEventName('');
      setEditMemoryPhotoDate('');
      setEditMemoryNewFiles([]);
      setEditMemoryUploadProgress(0);
      setIsUploadingEditMemory(false);
      setEditMemoryError('');
      alert('Đã cập nhật kỷ niệm thành công!');
    } catch (error) {
      console.error('Lỗi khi cập nhật kỷ niệm:', error);
      setEditMemoryError(`Lỗi khi cập nhật kỷ niệm: ${error.message}`);
      setIsUploadingEditMemory(false);
    }
  };
  // Effect để áp dụng lớp chủ đề cho phần tử HTML và lưu vào bộ nhớ cục bộ
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Hàm trợ giúp để định dạng ngày thành "%Y-%m-%d"
  const formatDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Khởi tạo Firebase và thiết lập trình lắng nghe xác thực
  useEffect(() => {
    if (hasInitialized.current) {
      console.log('Firebase đã được khởi tạo trước đó. Bỏ qua.');
      return;
    }
    hasInitialized.current = true;
    console.log('Bắt đầu khởi tạo Firebase...');

    try {
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error('Cấu hình Firebase bị thiếu hoặc rỗng. Vui lòng kiểm tra lại cấu hình.');
        setIsAuthReady(true);
        return;
      }

      let app;
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
        console.log('2. Firebase app đã được khởi tạo:', app.name);
      } else {
        app = getApp();
        console.log('2. Đã sử dụng Firebase app hiện có:', app.name);
      }

      const firestoreDb = getFirestore(app);
      console.log('3. Firestore đã được thiết lập.');

      const firebaseAuth = getAuth(app);
      console.log('4. Firebase Auth đã được thiết lập.');

      // Bắt đầu thay đổi từ đây: Khởi tạo Firebase Storage
      const firebaseStorage = getStorage(app); // <-- Khởi tạo Storage
      console.log('5. Firebase Storage đã được thiết lập.'); // Cập nhật log

      // Đặt tất cả các đối tượng Firebase đã khởi tạo vào trạng thái
      setDb(firestoreDb);
      setAuth(firebaseAuth);
      setStorage(firebaseStorage); // <-- Cập nhật trạng thái Storage

      console.log('DEBUG INIT: db object after setDb:', firestoreDb);
      console.log('DEBUG INIT: auth object after setAuth:', firebaseAuth);
      console.log('DEBUG INIT: storage object after setStorage:', firebaseStorage); // Log để kiểm tra

      console.log('6. setDb, setAuth và setStorage đã được gọi. Đang chờ onAuthStateChanged...');

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        console.log("6. onAuthStateChanged đã được kích hoạt. Người dùng hiện tại:", user ? user.uid : 'null');
        if (user) {
            // KIỂM TRA EMAIL ĐÃ XÁC MINH CHƯA
            // Luôn reload để đảm bảo user.emailVerified là trạng thái mới nhất từ Firebase Auth server
            await user.reload();
            if (!user.emailVerified) {
                console.log("Email chưa được xác minh cho UID:", user.uid);
                setUserId(null);
                setUserRole(null);
                setLoggedInResidentProfile(null);
                setActiveSection('dashboard');
                setAuthError("Tài khoản của bạn chưa được xác minh email. Vui lòng kiểm tra hộp thư đến và nhấp vào liên kết xác minh. Bạn cũng có thể sử dụng nút 'Gửi lại email xác minh' bên dưới.");
                setIsAuthReady(true);
                return;
            }
    
            // --- NẾU EMAIL ĐÃ ĐƯỢC XÁC MINH, TIẾP TỤC XỬ LÝ NHƯ BÌNH THƯỜNG ---
            setUserId(user.uid);
            console.log("7. Người dùng đã xác thực (UID):", user.uid);
    
            // --- NẾU EMAIL ĐÃ ĐƯỢC XÁC MINH, TIẾP TỤC XỬ LÝ NHƯ BÌNH THƯỜNG ---
            setUserId(user.uid);
            console.log("7. Người dùng đã xác thực (UID):", user.uid);

            const userDocRef = doc(firestoreDb, `artifacts/${currentAppId}/public/data/users`, user.uid);
            const userDocSnap = await getDoc(userDocRef);
            let fetchedPhotoURL = null;
            let fetchedRole = 'member';
            let fetchedFullName = user.email; // Mặc định là email
            let linkedResidentId = null;

            let fetchedPhoneNumber = '';
            let fetchedAcademicLevel = '';
            let fetchedDormEntryDate = '';
            let fetchedBirthday = '';
            let fetchedStudentId = ''; // NEW: Khai báo biến này
    
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              if (userData.role) fetchedRole = userData.role;
              if (userData.fullName) fetchedFullName = userData.fullName;
              if (userData.linkedResidentId) linkedResidentId = userData.linkedResidentId;
              if (userData.photoURL) fetchedPhotoURL = userData.photoURL;
              fetchedPhoneNumber = userData.phoneNumber || '';
              fetchedAcademicLevel = userData.academicLevel || '';
              fetchedDormEntryDate = userData.dormEntryDate || '';
              fetchedBirthday = userData.birthday || '';
              fetchedStudentId = userData.studentId || '';
              // NEW: Kiểm tra trạng thái xác minh email từ Firebase Auth
              // (user.emailVerified của tài khoản Auth)
              setNeedsEmailVerification(!user.emailVerified);
            } else {
              // Trường hợp tạo tài liệu user mới khi đăng nhập lần đầu
              // (nên không xảy ra nhiều nếu Admin tạo tài khoản trước)
              await setDoc(userDocRef, {
                email: user.email, // Email mà Firebase Auth đang dùng
                fullName: user.email, // Tên mặc định
                role: 'member',
                createdAt: serverTimestamp(),
                emailVerified: user.emailVerified // Lấy từ Firebase Auth, có thể là false
              }, { merge: true });
              const newUserDocSnap = await getDoc(userDocRef);
              if (newUserDocSnap.exists()) {
                const newUserData = newUserDocSnap.data();
                fetchedRole = newUserData.role;
                fetchedFullName = newUserData.fullName;
                linkedResidentId = newUserData.linkedResidentId;
                fetchedPhotoURL = newUserData.photoURL;
                fetchedPhoneNumber = newUserData.phoneNumber || '';
                fetchedAcademicLevel = newUserData.academicLevel || '';
                fetchedDormEntryDate = newUserData.dormEntryDate || '';
                fetchedBirthday = newUserData.birthday || '';
                fetchedStudentId = newUserData.studentId || '';
              }
              // NEW: Nếu tài khoản mới được tạo, mặc định cần xác minh email
              setNeedsEmailVerification(!user.emailVerified);
            }
            setUserAvatarUrl(fetchedPhotoURL);
            setUserRole(fetchedRole);
            setFullName(fetchedFullName);
            setMemberPhoneNumber(fetchedPhoneNumber);
            setMemberAcademicLevel(fetchedAcademicLevel);
            setMemberDormEntryDate(fetchedDormEntryDate);
            setMemberBirthday(fetchedBirthday);
            setMemberStudentId(fetchedStudentId);
            setEmail(user.email); 
            console.log("8. Vai trò người dùng:", fetchedRole);
    
            const residentsCollectionRef = collection(firestoreDb, `artifacts/${currentAppId}/public/data/residents`);
            let currentLoggedInResidentProfile = null;
    
            if (linkedResidentId) {
                const residentDoc = await getDoc(doc(residentsCollectionRef, linkedResidentId));
                if (residentDoc.exists()) {
                    currentLoggedInResidentProfile = { id: residentDoc.id, ...residentDoc.data() };
                    console.log("9. Hồ sơ cư dân được liên kết (từ linkedResidentId):", currentLoggedInResidentProfile.name);
                } else {
                    console.log("9. linkedResidentId trong tài liệu người dùng không hợp lệ hoặc cư dân không tồn tại.");
                    linkedResidentId = null;
                }
            }
    
            if (!currentLoggedInResidentProfile && fetchedFullName) {
                const qResidentByName = query(residentsCollectionRef, where("name", "==", fetchedFullName));
                const residentSnapByName = await getDocs(qResidentByName);
    
                if (!residentSnapByName.empty) {
                    const matchedResident = residentSnapByName.docs[0];
                    if (!matchedResident.data().linkedUserId || matchedResident.data().linkedUserId === user.uid) {
                        await updateDoc(userDocRef, { linkedResidentId: matchedResident.id });
                        currentLoggedInResidentProfile = { id: matchedResident.id, ...matchedResident.data() };
                        console.log("9. Đã tìm và liên kết hồ sơ cư dân theo tên:", currentLoggedInResidentProfile.name);
                    } else {
                        console.log(`Cư dân "${fetchedFullName}" đã được liên kết với một người dùng khác.`);
                    }
                } else {
                    console.log(`Không tìm thấy hồ sơ cư dân có tên "${fetchedFullName}". Admin có thể cần thêm/liên kết thủ công.`);
                }
            }
            setLoggedInResidentProfile(currentLoggedInResidentProfile);
            console.log(`DEBUG AUTH: User ID: ${user.uid}, User Role: ${fetchedRole}, Linked Resident: ${currentLoggedInResidentProfile ? currentLoggedInResidentProfile.name : 'None'}`);
            // KẾT THÚC: Logic hiện có để lấy vai trò người dùng
            
            setIsAuthReady(true);
            console.log("9. Trạng thái xác thực Firebase đã sẵn sàng: ", true);
        } else {
            // Khi người dùng đăng xuất
            setUserId(null);
            setUserRole(null);
            setLoggedInResidentProfile(null);
            setActiveSection('dashboard');
            setFullName('');
            setEmail('');
            setPassword('');
            setMemberPhoneNumber('');
            setMemberAcademicLevel('');
            setMemberDormEntryDate('');
            setMemberBirthday('');
            setMemberStudentId('');
            setUserAvatarUrl(null);
            setNeedsEmailVerification(false); // Reset cờ này khi đăng xuất
            setIsAuthReady(true);
            console.log("9. Trạng thái xác thực Firebase đã sẵn sàng: ", true);
        }
    });

      return () => {
        console.log('Hủy đăng ký lắng nghe trạng thái xác thực.');
        unsubscribe();
      };
    } catch (error) {
      console.error('Lỗi nghiêm trọng khi khởi tạo Firebase (tổng thể):', error);
      setIsAuthReady(true);
    }
  }, []); // Không cần userRole trong dependency array này vì nó được xử lý nội bộ

  // Thêm vào cùng với các state khác ở đầu component App
  const [fundInputValue, setFundInputValue] = useState('');

  // Thêm hàm này vào file App.js
  const handleUpdateFundManually = async () => {
    if (userRole !== 'admin') {
      setAuthError('Bạn không có quyền thực hiện thao tác này.');
      return;
    }
    const newFundValue = parseFloat(fundInputValue);
    if (isNaN(newFundValue)) {
      setBillingError('Vui lòng nhập một số tiền hợp lệ.');
      return;
    }
    if (costSharingHistory.length === 0) {
      setBillingError('Chưa có lịch sử chia tiền nào để cập nhật. Vui lòng tính tiền và chia tiền ít nhất một lần.');
      return;
    }

    // Lấy bản ghi chia tiền gần nhất
    const latestCostSharingRecord = costSharingHistory[0];
    const recordRef = doc(db, `artifacts/${currentAppId}/public/data/costSharingHistory`, latestCostSharingRecord.id);

    try {
      await updateDoc(recordRef, {
        remainingFund: newFundValue
      });
      setFundInputValue(''); // Xóa nội dung ô nhập
      setBillingError(''); // Xóa thông báo lỗi nếu có
      alert('Đã cập nhật quỹ phòng thành công!');
    } catch (error) {
      console.error("Lỗi khi cập nhật quỹ phòng:", error);
      setBillingError('Đã xảy ra lỗi khi cập nhật quỹ phòng.');
    }
  };

  // State thêm chi tiêu tiền quỹ
  const [fundExpenses, setFundExpenses] = useState([]); // Để lưu danh sách chi tiêu
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');

  // Hàm chi tiêu tiền 
  const handleAddFundExpense = async (e) => {
    e.preventDefault();
    if (userRole !== 'admin') {
      setAuthError('Bạn không có quyền thực hiện thao tác này.');
      return;
    }
    const amount = parseFloat(newExpenseAmount);
    if (isNaN(amount) || amount <= 0 || !newExpenseDescription.trim()) {
      setBillingError('Vui lòng nhập mô tả và số tiền hợp lệ.');
      return;
    }
    if (costSharingHistory.length === 0) {
      setBillingError('Chưa có lịch sử chia tiền nào để ghi nhận chi tiêu. Vui lòng tính tiền và chia tiền ít nhất một lần.');
      return;
    }

    // Lấy bản ghi chia tiền gần nhất để cập nhật quỹ
    const latestCostSharingRecord = costSharingHistory[0];
    const recordRef = doc(db, `artifacts/${currentAppId}/public/data/costSharingHistory`, latestCostSharingRecord.id);
    const newRemainingFund = (latestCostSharingRecord.remainingFund || 0) - amount;

    const expensesCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/fundExpenses`);

    try {
      // Thêm bản ghi chi tiêu mới
      await addDoc(expensesCollectionRef, {
        description: newExpenseDescription.trim(),
        amount: amount,
        spentBy: userId,
        spentAt: serverTimestamp(),
        relatedCostSharingId: latestCostSharingRecord.id
      });

      // Cập nhật lại quỹ phòng
      await updateDoc(recordRef, {
        remainingFund: newRemainingFund
      });

      // Reset form và đóng modal
      setNewExpenseDescription('');
      setNewExpenseAmount('');
      setBillingError('');
      setShowAddExpenseModal(false);
      alert('Đã ghi nhận chi tiêu thành công!');
    } catch (error) {
      console.error("Lỗi khi ghi nhận chi tiêu:", error);
      setBillingError('Đã xảy ra lỗi khi ghi nhận chi tiêu.');
    }
  };

  // useEffect chi tiêu tiền 
  useEffect(() => {
    if (!db || userRole !== 'admin') {
      setFundExpenses([]);
      return;
    }
    const expensesQuery = query(collection(db, `artifacts/${currentAppId}/public/data/fundExpenses`), orderBy('spentAt', 'desc'));
    
    const unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
      const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFundExpenses(expenses);
    });

    return () => unsubscribe();
  }, [db, userRole]);

  // States for Avatar Upload
  const [newAvatarFile, setNewAvatarFile] = useState(null);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // States for Former Resident Avatar Upload (Admin Only)
  const [newFormerResidentAvatarFile, setNewFormerResidentAvatarFile] = useState(null);
  const [formerResidentAvatarUploadProgress, setFormerResidentAvatarUploadProgress] = useState(0);
  const [isUploadingFormerResidentAvatar, setIsUploadingFormerResidentAvatar] = useState(false);
  const [formerResidentAvatarError, setFormerResidentAvatarError] = useState('');
  const [uploadFormerResidentAvatarProgress, setUploadFormerResidentAvatarProgress] = useState(0);

  //Cho popup sửa tiền bối
  const [editingFormerResidentAvatarFile, setEditingFormerResidentAvatarFile] = useState(null);
  const [isUploadingEditingFormerResidentAvatar, setIsUploadingEditingFormerResidentAvatar] = useState(false);
  const [uploadEditingFormerResidentAvatarProgress, setUploadEditingFormerResidentAvatarProgress] = useState(0);

  // Để lưu trữ avatar URLs
  const [userAvatarUrl, setUserAvatarUrl] = useState(null);
  const [formerResidentAvatarUrls, setFormerResidentAvatarUrls] = useState({});

  const handleUploadMyAvatar = async () => {
    setAvatarError('');
    if (!db || !userId || !auth.currentUser || !newAvatarFile) {
      setAvatarError('Vui lòng chọn một tệp ảnh để tải lên.');
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarUploadProgress(0);

    const formData = new FormData();
    formData.append('file', newAvatarFile);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET_AVATAR);
    // Optional: Add folder for better organization
    formData.append('folder', 'avatars/users'); // Ví dụ: lưu vào thư mục 'avatars/users' trên Cloudinary
    // Optional: Set public_id to userId to allow overwriting
    formData.append('public_id', userId); // Để avatar của mỗi user có public_id là UID của họ

    try {
      const response = await axios.post(CLOUDINARY_API_URL_IMAGE_UPLOAD, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setAvatarUploadProgress(percentCompleted);
        },
      });

      const downloadURL = response.data.secure_url;
      console.log('Avatar tải lên Cloudinary thành công, URL:', downloadURL);

      // Cập nhật photoURL trong tài liệu người dùng trong Firestore
      const userDocRef = doc(db, `artifacts/${currentAppId}/public/data/users`, userId);
      await updateDoc(userDocRef, { photoURL: downloadURL });

      setUserAvatarUrl(downloadURL);
      setNewAvatarFile(null);
      setAvatarUploadProgress(0);
      setIsUploadingAvatar(false);
      setAvatarError('');
      alert('Đã cập nhật ảnh đại diện thành công!');
    } catch (error) {
      console.error('Lỗi khi tải ảnh avatar lên Cloudinary:', error);
      setAvatarError(`Lỗi khi tải ảnh: ${error.message}`);
      setIsUploadingAvatar(false);
      // Log lỗi chi tiết từ Axios nếu có
      if (error.response) {
        console.error('Cloudinary Error Response:', error.response.data);
      }
    }
  };

  // Hàm tải lên avatar cho tiền bối (chỉ admin)
  const handleUploadFormerResidentAvatar = async (formerResidentId) => {
    setFormerResidentAvatarError('');
    if (!db || !userId || userRole !== 'admin' || !newFormerResidentAvatarFile) {
      setFormerResidentAvatarError('Bạn không có quyền hoặc vui lòng chọn một tệp ảnh.');
      return;
    }

    setIsUploadingFormerResidentAvatar(true);
    setFormerResidentAvatarUploadProgress(0);

    const formData = new FormData();
    formData.append('file', newFormerResidentAvatarFile);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET_AVATAR);
    // Optional: Add folder
    formData.append('folder', 'avatars/former-residents'); // Ví dụ: lưu vào thư mục 'avatars/former-residents'
    // Optional: Set public_id to formerResidentId
    formData.append('public_id', formerResidentId); // Để avatar của mỗi tiền bối có public_id là ID của họ

    try {
      const response = await axios.post(CLOUDINARY_API_URL_IMAGE_UPLOAD, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setFormerResidentAvatarUploadProgress(percentCompleted);
        },
      });

      const downloadURL = response.data.secure_url;
      console.log('Avatar tiền bối tải lên Cloudinary thành công, URL:', downloadURL);

      // Cập nhật photoURL trong tài liệu tiền bối trong Firestore
      const formerResidentDocRef = doc(db, `artifacts/${currentAppId}/public/data/formerResidents`, formerResidentId);
      await updateDoc(formerResidentDocRef, { photoURL: downloadURL });

      setFormerResidentAvatarUrls((prev) => ({ ...prev, [formerResidentId]: downloadURL }));
      setNewFormerResidentAvatarFile(null);
      setFormerResidentAvatarUploadProgress(0);
      setIsUploadingFormerResidentAvatar(false);
      setFormerResidentAvatarError('');
      alert('Đã cập nhật ảnh đại diện tiền bối thành công!');
    } catch (error) {
      console.error('Lỗi khi tải ảnh avatar tiền bối lên Cloudinary:', error);
      setFormerResidentAvatarError(`Lỗi khi tải ảnh: ${error.message}`);
      setIsUploadingFormerResidentAvatar(false);
      if (error.response) {
        console.error('Cloudinary Error Response:', error.response.data);
      }
    }
  };

  // Trong useEffect lắng nghe formerResidents (đã có)
  useEffect(() => {
    if (!db || !isAuthReady || userId === null) {
      console.log('Lắng nghe tiền bối: Đang chờ DB, Auth hoặc User ID sẵn sàng.');
      return;
    }
    console.log('Bắt đầu lắng nghe cập nhật thông tin tiền bối...');

    const formerResidentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/formerResidents`);
    const q = query(formerResidentsCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedFormerResidents = [];
        const newFormerResidentAvatarUrls = {}; // Để lưu URLs avatar
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.deactivatedAt && typeof data.deactivatedAt.toDate === 'function') {
            data.deactivatedAt = data.deactivatedAt.toDate();
          }
          if (data.photoURL) {
            // Lưu photoURL nếu có
            newFormerResidentAvatarUrls[docSnap.id] = data.photoURL;
          }
          fetchedFormerResidents.push({ id: docSnap.id, ...data });
        });
        setFormerResidents(fetchedFormerResidents);
        setFormerResidentAvatarUrls(newFormerResidentAvatarUrls); // Cập nhật state
        console.log('Đã cập nhật thông tin tiền bối:', fetchedFormerResidents);
      },
      (error) => {
        console.error('Lỗi khi tải dữ liệu tiền bối:', error);
      },
    );

    return () => {
      console.log('Hủy đăng ký lắng nghe thông tin tiền bối.');
      unsubscribe();
    };
  }, [db, isAuthReady, userId]); // Giữ nguyên dependencies

  // Hàm để admin gửi thông báo tùy chỉnh
  const handleSendCustomNotification = async (e) => {
    e.preventDefault();
    setCustomNotificationError('');
    setCustomNotificationSuccess('');

    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      setCustomNotificationError('Bạn không có quyền gửi thông báo tùy chỉnh.');
      return;
    }
    if (!newNotificationMessage.trim()) {
      setCustomNotificationError('Nội dung thông báo không được để trống.');
      return;
    }
    if (newNotificationRecipient !== 'all' && !allUsersData.find((u) => u.id === newNotificationRecipient)) {
      setCustomNotificationError('Người nhận không hợp lệ. Vui lòng chọn lại.');
      return;
    }

    try {
      const messageToSend = newNotificationMessage.trim();
      const notificationTitle = newNotificationTitle.trim() || 'Thông báo'; // Sử dụng tiêu đề hoặc mặc định

      await createNotification(
        newNotificationRecipient,
        newNotificationType,
        messageToSend,
        userId,
        null, // relatedId (nếu không có)
        notificationTitle, // Truyền title vào đây
      );

      setCustomNotificationSuccess('Thông báo đã được gửi thành công!');
      setNewNotificationTitle('');
      setNewNotificationMessage('');
      setNewNotificationRecipient('all');
      setNewNotificationType('general');
      setShowAddNotificationModal(false);
    } catch (error) {
      console.error('Lỗi khi gửi thông báo tùy chỉnh:', error);
      setCustomNotificationError(`Lỗi khi gửi thông báo: ${error.message}`);
    }
  };
  //Hàm phân trang
  const [currentPageMemories, setCurrentPageMemories] = useState(1);
  const [itemsPerPageMemories] = useState(9); // 10 bài đăng mỗi trang
  const [totalPagesMemories, setTotalPagesMemories] = useState(1);
  const [totalMemoriesCount, setTotalMemoriesCount] = useState(0); // Tổng số bài kỷ niệm

// Lắng nghe cập nhật Kỷ niệm phòng
useEffect(() => {
  if (!db || !auth || !storage || !isAuthReady || userId === null) {
    console.log('Lắng nghe kỷ niệm: Đang chờ DB, Auth hoặc User ID sẵn sàng.');
    return;
  }
  console.log('Bắt đầu lắng nghe cập nhật kỷ niệm phòng...');

  const memoriesCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/memories`);
  let q = query(memoriesCollectionRef);

  // Áp dụng bộ lọc người đăng nếu có
  if (filterUploaderMemory !== 'all') {
    q = query(q, where('uploadedBy', '==', filterUploaderMemory));
  }

  // Áp dụng tìm kiếm theo tên sự kiện nếu có
  if (searchTermMemory.trim() !== '') {
    // Lưu ý: Tìm kiếm '==' chỉ khớp chính xác. Để tìm kiếm một phần, bạn cần giải pháp khác (ví dụ: Algolia Search hoặc Cloud Functions)
    q = query(q, where('eventName', '==', searchTermMemory.trim()));
  }

  // Sắp xếp theo photoDate giảm dần, sau đó theo uploadedAt giảm dần nếu photoDate giống nhau
  // CHÚ Ý: Đảm bảo photoDate có thể so sánh được (ví dụ: định dạng YYYY-MM-DD)
  // Firestore yêu cầu các trường trong orderBy phải được index
  q = query(q, orderBy('photoDate', 'desc'), orderBy('uploadedAt', 'desc')); // Đã có rồi, rất tốt!

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const allFetchedMemories = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.uploadedAt && typeof data.uploadedAt.toDate === 'function') {
          data.uploadedAt = data.uploadedAt.toDate();
        }
        // Đảm bảo 'files' là một mảng, nếu không thì tạo một mảng từ fileUrl cũ
        if (!data.files) {
          data.files = [];
          if (data.fileUrl) {
            // Kiểm tra nếu có fileUrl cũ (single file)
            data.files.push({
              fileUrl: data.fileUrl,
              publicId: data.publicId,
              fileType: data.fileType || (data.fileUrl.match(/\.(mp4|mov|avi|wmv|flv)$/i) ? 'video' : 'image'), // Đoán loại nếu không có
            });
          }
        }
        // Xóa các trường cũ không cần thiết nếu bạn đã chuyển hoàn toàn sang 'files'
        delete data.fileUrl;
        delete data.publicId;
        delete data.fileType;

        allFetchedMemories.push({ id: docSnap.id, ...data });
      });

      // Cập nhật tổng số bài kỷ niệm
      setTotalMemoriesCount(allFetchedMemories.length);

      // Tính tổng số trang (làm tròn lên)
      setTotalPagesMemories(Math.ceil(allFetchedMemories.length / itemsPerPageMemories));

      // Lọc dữ liệu cho trang hiện tại (PHÂN TRANG CLIENT-SIDE)
      const startIndex = (currentPageMemories - 1) * itemsPerPageMemories;
      const endIndex = startIndex + itemsPerPageMemories;
      const memoriesForCurrentPage = allFetchedMemories.slice(startIndex, endIndex);

      // Đặt lại trang hiện tại về 1 nếu thay đổi bộ lọc/tìm kiếm mà không có đủ trang
      // Hoặc nếu trang hiện tại vượt quá tổng số trang mới
      if (currentPageMemories > Math.ceil(allFetchedMemories.length / itemsPerPageMemories) && allFetchedMemories.length > 0) {
        setCurrentPageMemories(1);
      } else if (allFetchedMemories.length === 0) { // Nếu không có kỷ niệm nào, đảm bảo currentPageMemories là 1
          setCurrentPageMemories(1);
      }

      setMemories(memoriesForCurrentPage); // Cập nhật state 'memories' chỉ với các bài của trang hiện tại
      console.log('Đã cập nhật kỷ niệm phòng (có bộ lọc và phân trang):', memoriesForCurrentPage);
    },
    (error) => {
      console.error('Lỗi khi tải dữ liệu kỷ niệm (có bộ lọc):', error);
    },
  );

  return () => {
    console.log('Hủy đăng ký lắng nghe kỷ niệm.');
    unsubscribe();
  };
}, [db, isAuthReady, userId, searchTermMemory, filterUploaderMemory, currentPageMemories, itemsPerPageMemories]); // THÊM currentPageMemories và itemsPerPageMemories vào dependencies

  // --- Các hàm xác thực ---
  // Hàm để Admin tạo tài khoản mới cho thành viên
  const handleAdminCreateAccount = async () => {
    setAuthError('');
    if (!auth || !db) {
      setAuthError("Hệ thống xác thực chưa sẵn sàng.");
      return;
    }
    // Chỉ admin mới được tạo tài khoản
    if (userRole !== 'admin') {
      setAuthError("Bạn không có quyền tạo tài khoản mới.");
      return;
    }
    if (newAccountFullName.trim() === '' || newAccountStudentId.trim() === '' || newAccountPassword.trim() === '') {
      setAuthError("Vui lòng nhập Họ tên, Mã số sinh viên và Mật khẩu.");
      return;
    }
    if (newAccountPassword.length < 6) {
      setAuthError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    const studentIdToRegister = newAccountStudentId.trim();
    const personalEmailToUse = newAccountPersonalEmail.trim() || `${studentIdToRegister}@dormapp.com`; // Email cá nhân hoặc email nội bộ nếu trống

    try {
      // 1. KIỂM TRA MSSV CÓ DUY NHẤT CHƯA
      const usersRef = collection(db, `artifacts/${currentAppId}/public/data/users`);
      const qStudentId = query(usersRef, where("studentId", "==", studentIdToRegister));
      const snapshotStudentId = await getDocs(qStudentId);
      if (!snapshotStudentId.empty) {
        setAuthError("Mã số sinh viên này đã được đăng ký. Vui lòng sử dụng mã khác.");
        return;
      }

      // 2. TẠO TÀI KHOẢN TRONG FIREBASE AUTH BẰNG EMAIL (có thể là email thật hoặc nội bộ)
      const userCredential = await createUserWithEmailAndPassword(auth, personalEmailToUse, newAccountPassword);
      const user = userCredential.user;
      console.log("Admin đã tạo tài khoản Auth thành công! UID:", user.uid);

      // KHÔNG GỬI EMAIL XÁC MINH NGAY LẬP TỨC. Để thành viên tự xác minh sau.
      // Firebase Auth sẽ tự động set emailVerified là false ban đầu.

      // 3. TẠO TÀI LIỆU NGƯỜI DÙNG TRONG FIRESTORE
      await setDoc(doc(db, `artifacts/${currentAppId}/public/data/users`, user.uid), {
        email: personalEmailToUse,
        fullName: newAccountFullName.trim(),
        studentId: studentIdToRegister,
        role: 'member', // Luôn tạo là member
        createdAt: serverTimestamp(),
        emailVerified: false // Mặc định là false, người dùng phải tự xác minh
      });
      console.log("Admin đã tạo tài liệu user trong Firestore.");

      // Admin có thể liên kết resident profile sau hoặc hệ thống tự động liên kết theo tên
      // Tùy chọn: Bạn có thể thêm logic để Admin chọn residentId để liên kết ngay tại đây.
      // Để đơn giản, phần liên kết resident profile sẽ vẫn dựa vào `onAuthStateChanged` hoặc Admin tự làm.

      alert(`Đã tạo tài khoản cho ${newAccountFullName.trim()} (MSSV: ${studentIdToRegister}) thành công! Người dùng cần đăng nhập và xác minh email cá nhân.`);

      // Reset form
      setNewAccountStudentId('');
      setNewAccountPassword('');
      setNewAccountFullName('');
      setNewAccountPersonalEmail('');
      setAuthError(''); // Xóa lỗi
    } catch (error) {
      console.error("Lỗi khi Admin tạo tài khoản:", error.code, error.message);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError("Email này đã được sử dụng bởi một tài khoản khác. Vui lòng dùng email khác.");
      } else {
        setAuthError(`Lỗi khi tạo tài khoản: ${error.message}`);
      }
    }
  };

  //Hàm đăng nhập tài khoản
  const handleSignIn = async () => {
    setAuthError('');
    if (!auth || !db) {
        setAuthError("Hệ thống xác thực chưa sẵn sàng.");
        return;
    }
    if (studentIdForLogin.trim() === '' || password.trim() === '') {
        setAuthError("Vui lòng nhập Mã số sinh viên và Mật khẩu.");
        return;
    }

    const studentIdToLogin = studentIdForLogin.trim();

    try {
        // 1. TÌM EMAIL LIÊN KẾT VỚI MSSV TỪ FIRESTORE
        const usersRef = collection(db, `artifacts/${currentAppId}/public/data/users`);
        const qStudentId = query(usersRef, where("studentId", "==", studentIdToLogin));
        const snapshot = await getDocs(qStudentId);

        if (snapshot.empty) {
            setAuthError("Mã số sinh viên không tồn tại hoặc mật khẩu không đúng."); // Thông báo chung để tránh lộ thông tin
            return;
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        const personalEmail = userData.email;

        if (!personalEmail) {
            setAuthError("Tài khoản không có email liên kết. Vui lòng liên hệ quản trị viên.");
            return;
        }
        if (userData.role === 'inactive') { // Kiểm tra trạng thái vô hiệu hóa
            setAuthError("Tài khoản này đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.");
            return;
        }

        // 2. ĐĂNG NHẬP VỚI EMAIL VÀ MẬT KHẨU
        const userCredential = await signInWithEmailAndPassword(auth, personalEmail, password);
        const user = userCredential.user;
        // Sau khi đăng nhập, `onAuthStateChanged` sẽ kích hoạt và kiểm tra emailVerified

        // ===== BẮT ĐẦU PHẦN GHI LỊCH SỬ ĐĂNG NHẬP =====
        const loginHistoryRef = collection(db, `artifacts/${currentAppId}/public/data/loginHistory`);
        await addDoc(loginHistoryRef, {
          userId: user.uid,
          userName: userData.fullName || user.email,
          loginAt: serverTimestamp(),
          userAgent: navigator.userAgent // Ghi lại thông tin trình duyệt/HĐH
        });
        // ===== KẾT THÚC PHẦN GHI LỊCH SỬ =====

        console.log("Đăng nhập thành công! Đang kiểm tra trạng thái xác minh email...");
        setAuthError(''); // Xóa lỗi xác thực nếu có
        setPassword('');
        setStudentIdForLogin('');
        setEmail(''); // Xóa email input truyền thống
    } catch (error) {
        console.error("Lỗi đăng nhập:", error.code, error.message);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') { // Thêm invalid-credential
            setAuthError("Mã số sinh viên hoặc mật khẩu không đúng.");
        } else if (error.code === 'auth/invalid-email') {
            setAuthError("Email liên kết không hợp lệ. Vui lòng liên hệ quản trị viên.");
        } else if (error.code === 'auth/too-many-requests') {
            setAuthError("Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.");
        } else {
            setAuthError(`Lỗi đăng nhập: ${error.message}`);
        }
    }
  };

  // Hàm đăng ký tài khoản
  const handleRegister = async () => {
    setAuthError('');
    if (!auth || !db) {
      setAuthError("Hệ thống xác thực chưa sẵn sàng.");
      return;
    }
    // Thêm kiểm tra cho email cá nhân
    if (fullName.trim() === '' || newStudentIdForAuth.trim() === '' || personalEmailForRegister.trim() === '' || password.trim() === '') {
      setAuthError("Vui lòng nhập đầy đủ Họ tên, Mã số sinh viên, Email và Mật khẩu.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    const studentIdToRegister = newStudentIdForAuth.trim();
    const personalEmail = personalEmailForRegister.trim(); // Sử dụng email người dùng nhập

    try {
      // 1. KIỂM TRA MSSV VÀ EMAIL CÓ DUY NHẤT KHÔNG
      const usersRef = collection(db, `artifacts/${currentAppId}/public/data/users`);
      const qStudentId = query(usersRef, where("studentId", "==", studentIdToRegister));
      const studentIdSnapshot = await getDocs(qStudentId);
      if (!studentIdSnapshot.empty) {
        setAuthError("Mã số sinh viên này đã được sử dụng.");
        return;
      }

      const qEmail = query(usersRef, where("email", "==", personalEmail));
      const emailSnapshot = await getDocs(qEmail);
      if (!emailSnapshot.empty) {
        setAuthError("Email này đã được sử dụng bởi một tài khoản khác.");
        return;
      }

      // 2. TẠO TÀI KHOẢN TRONG FIREBASE AUTH BẰNG EMAIL CÁ NHÂN
      const userCredential = await createUserWithEmailAndPassword(auth, personalEmail, password);
      const user = userCredential.user;
      console.log("Đã tạo tài khoản Auth thành công! UID:", user.uid);

      // 3. GỬI EMAIL XÁC MINH NGAY LẬP TỨC
      await sendEmailVerification(user);
      console.log("Đã gửi email xác minh đến:", personalEmail);

      // 4. TẠO TÀI LIỆU NGƯỜI DÙNG TRONG FIRESTORE
      await setDoc(doc(db, `artifacts/${currentAppId}/public/data/users`, user.uid), {
        email: personalEmail, // Lưu email cá nhân
        fullName: fullName.trim(),
        studentId: studentIdToRegister,
        role: 'member',
        createdAt: serverTimestamp(),
        emailVerified: false, // Ban đầu luôn là false
        phoneNumber: '',
        academicLevel: '',
        dormEntryDate: '',
        birthday: '',
        photoURL: null,
      });
      console.log("Đã tạo tài liệu người dùng trong Firestore.");

      // 5. THÔNG BÁO VÀ CHUYỂN HƯỚNG
      alert(`Đăng ký thành công! Vui lòng kiểm tra hộp thư tại ${personalEmail} để xác minh tài khoản trước khi đăng nhập.`);
      // Reset form và chuyển qua tab đăng nhập
      setAuthMode('login');
      setFullName('');
      setNewStudentIdForAuth('');
      setPersonalEmailForRegister(''); // Reset state email mới
      setPassword('');
      setAuthError('');

    } catch (error) {
      console.error("Lỗi khi đăng ký:", error.code, error.message);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError("Email này đã được sử dụng.");
      } else if (error.code === 'auth/invalid-email') {
        setAuthError("Địa chỉ email không hợp lệ.");
      } else {
        setAuthError(`Lỗi khi đăng ký: ${error.message}`);
      }
    }
  };

  // Hàm Gửi lại email xác minh
  const handleResendVerificationEmail = async () => {
    setAuthError(''); // Reset lỗi xác thực
    setForgotPasswordMessage(''); // Reset thông báo quên mật khẩu

    const user = auth.currentUser;
    if (!user) {
        setAuthError("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        return;
    }

    try {
        await sendEmailVerification(user);
        setAuthError("Đã gửi email xác minh thành công! Vui lòng kiểm tra hộp thư đến của bạn. Sau khi xác minh, hãy đăng nhập lại.");
    } catch (error) {
        console.error("Lỗi khi gửi lại email xác minh:", error);
        if (error.code === 'auth/too-many-requests') {
            setAuthError("Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút.");
        } else {
            setAuthError(`Lỗi gửi xác minh: ${error.message}`);
        }
    }
  };

  const handleSignOut = async () => {
    setAuthError('');
    if (!auth) return;
    try {
      await signOut(auth);
      console.log('Đăng xuất thành công!');
      setUserId(null); // Đảm bảo userId cũng được đặt lại
      setUserRole(null); // Xóa vai trò khi đăng xuất
      setLoggedInResidentProfile(null); // Xóa hồ sơ cư dân liên kết
      setActiveSection('dashboard'); // Đặt lại phần hoạt động
    } catch (error) {
      console.error('Lỗi đăng xuất:', error.code, error.message);
      setAuthError(`Lỗi đăng xuất: ${error.message}`);
    }
  };

  // Handle forgot password
  const handleForgotPassword = async () => {
    setForgotPasswordMessage('');
    if (!auth) {
      setForgotPasswordMessage('Hệ thống xác thực chưa sẵn sàng.');
      return;
    }
    // Vẫn yêu cầu email thật để gửi link reset
    if (forgotPasswordEmail.trim() === '') {
      setForgotPasswordMessage('Vui lòng nhập Email của bạn.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, forgotPasswordEmail.trim());
      setForgotPasswordMessage('Đã gửi liên kết đặt lại mật khẩu đến email của bạn. Vui lòng kiểm tra hộp thư đến.');
      setForgotPasswordEmail(''); // Clear email input
    } catch (error) {
      console.error('Lỗi quên mật khẩu:', error.code, error.message);
      setForgotPasswordMessage(`Lỗi: ${error.message}`);
    }
  };

  // Hàm chỉnh sửa thông tin cá nhân (member và admin)
  const handleSaveUserProfile = async () => {
    setAuthError('');
    if (!db || !userId) {
      setAuthError('Hệ thống chưa sẵn sàng hoặc bạn chưa đăng nhập.');
      return;
    }

    const userDocRef = doc(db, `artifacts/${currentAppId}/public/data/users`, userId);
    const currentUserData = (await getDoc(userDocRef)).data(); // Lấy dữ liệu hiện tại

    try {
      const userDataToUpdate = {
        fullName: fullName.trim(),
        phoneNumber: memberPhoneNumber.trim(),
        academicLevel: memberAcademicLevel.trim(),
        dormEntryDate: memberDormEntryDate.trim(),
        birthday: memberBirthday.trim(),
        studentId: memberStudentId.trim(),
      };

      // Nếu email thay đổi, cập nhật email trong Auth và đặt lại emailVerified
      if (email.trim() !== currentUserData.email) {
        try {
          userDataToUpdate.email = email.trim(); // Cập nhật email trong Firestore
          userDataToUpdate.emailVerified = false; // Đặt lại trạng thái xác minh trong Firestore
          setNeedsEmailVerification(true); // Cập nhật cờ để hiển thị thông báo
          alert('Email đã được thay đổi. Vui lòng kiểm tra email mới để xác minh lại tài khoản.');
        } catch (updateEmailError) {
          console.error("Lỗi khi cập nhật email trong Auth:", updateEmailError);
          setAuthError(`Lỗi khi cập nhật email: ${updateEmailError.message}. Vui lòng thử lại.`);
          return;
        }
      }

      await updateDoc(userDocRef, userDataToUpdate);
      console.log('Đã cập nhật tài liệu người dùng thành công!');

      setAuthError('Thông tin cá nhân đã được cập nhật thành công!');
    } catch (error) {
      console.error('Lỗi khi cập nhật thông tin cá nhân:', error);
      setAuthError(`Lỗi khi cập nhật thông tin cá nhân: ${error.message}`);
    }
  };

  // Hàm để xóa một kỷ niệm (admin có thể xóa bất kỳ, người đăng tải có thể xóa của chính họ)
  const handleDeleteMemory = async (memoryId, files, uploadedByUserId) => {
    setMemoryError('');
    if (!db || !userId) {
      setMemoryError('Hệ thống chưa sẵn sàng hoặc bạn chưa đăng nhập.');
      return;
    }

    const isAllowedToDelete = userRole === 'admin' || userId === uploadedByUserId;

    if (!isAllowedToDelete) {
      setMemoryError('Bạn không có quyền xóa kỷ niệm này.');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn xóa kỷ niệm này không?')) {
      return;
    }

    try {
      // Xóa tài liệu Firestore trước
      await deleteDoc(doc(db, `artifacts/${currentAppId}/public/data/memories`, memoryId));

      // Xóa từng file từ Cloudinary
      if (files && files.length > 0) {
        for (const fileInfo of files) {
          if (fileInfo.publicId) {
            console.log(
              `Đang cố gắng xóa file Cloudinary với publicId: ${fileInfo.publicId}, loại: ${fileInfo.fileType}`,
            );
            // Đây là placeholder cho việc gọi Cloud Function của bạn
            // Bạn cần tạo một Cloud Function để xử lý việc xóa file Cloudinary an toàn
            // Hàm này sẽ nhận publicId và resourceType và xóa file khỏi Cloudinary bằng API_SECRET
            // Ví dụ: await axios.post('/api/deleteCloudinaryAsset', { publicId: fileInfo.publicId, resourceType: fileInfo.fileType });
          }
        }
        alert(
          'Chức năng xóa file trên Cloudinary yêu cầu triển khai Cloud Function. Kỷ niệm đã được xóa khỏi danh sách.',
        );
      }

      console.log(`Đã xóa kỷ niệm ${memoryId} và các file liên quan (nếu có).`);
    } catch (error) {
      console.error('Lỗi khi xóa kỷ niệm:', error);
      setMemoryError(`Lỗi khi xóa kỷ niệm: ${error.message}`);
    }
  };

  // NEW: State cho việc chỉnh sửa thông tin thành viên trong Common Room Info
  const [editingCommonResidentData, setEditingCommonResidentData] = useState(null); // Lưu thông tin cư dân từ 'residents'
  const [editingCommonResidentUserLinkedData, setEditingCommonResidentUserLinkedData] = useState(null); // Lưu thông tin user liên kết

  // Các state cho form chỉnh sửa trong modal
  const [editCommonFullName, setEditCommonFullName] = useState('');
  const [editCommonEmail, setEditCommonEmail] = useState(''); // Email của user (chỉ hiển thị, không chỉnh sửa)
  const [editCommonPhoneNumber, setEditCommonPhoneNumber] = useState('');
  const [editCommonAcademicLevel, setEditCommonAcademicLevel] = useState('');
  const [editCommonDormEntryDate, setEditCommonDormEntryDate] = useState('');
  const [editCommonBirthday, setEditCommonBirthday] = useState('');
  const [editCommonStudentId, setEditCommonStudentId] = useState('');

  // NEW: State for avatar upload in the edit modal
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [tempAvatarUrl, setTempAvatarUrl] = useState('');

  // NEW: Hàm để mở modal chỉnh sửa thông tin thành viên trong "Thông tin phòng chung"
  const handleEditCommonResidentDetails = (resident) => {
    // Chỉ admin mới có quyền chỉnh sửa thông tin chung của người khác
    if (userRole !== 'admin') {
      setAuthError('Bạn không có quyền chỉnh sửa thông tin này.');
      return;
    }

    const linkedUser = allUsersData.find(user => user.linkedResidentId === resident.id);

    setEditingCommonResidentData(resident);
    setEditingCommonResidentUserLinkedData(linkedUser || null);

    // Nạp dữ liệu vào các state của form chỉnh sửa
    setEditCommonFullName(linkedUser?.fullName || resident.name);
    setEditCommonEmail(linkedUser?.email || '');
    setEditCommonPhoneNumber(linkedUser?.phoneNumber || '');
    setEditCommonAcademicLevel(linkedUser?.academicLevel || '');
    setEditCommonDormEntryDate(linkedUser?.dormEntryDate || '');
    setEditCommonBirthday(linkedUser?.birthday || '');
    setEditCommonStudentId(linkedUser?.studentId || '');

    // NEW: Set the temporary avatar URL for preview
    setTempAvatarUrl(linkedUser?.avatarUrl || '');
    setSelectedAvatarFile(null); // Reset selected file when opening modal

    setAuthError(''); // Clear any previous auth errors
    
  };

  const handleUpdateCommonResidentDetails = async () => {
  setAuthError('');
  setUpdateSuccessMessage('');
  if (!db || !userId || userRole !== 'admin') {
   setAuthError('Bạn không có quyền thực hiện thao tác này.');
   return;
  }
  if (!editingCommonResidentData) {
   setAuthError('Không có thông tin thành viên để cập nhật.');
   return;
  }
  if (!editCommonFullName.trim()) {
   setAuthError('Họ tên không được để trống.');
   return;
  }
 
  try {
   let avatarUrl = null;
   // Upload avatar if a new file has been selected
   if (selectedAvatarFile && editingCommonResidentUserLinkedData?.id) {
    avatarUrl = await uploadAvatar(editingCommonResidentUserLinkedData.id);
    if (!avatarUrl) {
     return; // Stop if avatar upload failed
    }
   }
 
   // 1. Cập nhật tài liệu resident (chỉ tên)
   const residentDocRef = doc(db, `artifacts/${currentAppId}/public/data/residents`, editingCommonResidentData.id);
   await updateDoc(residentDocRef, {
    name: editCommonFullName.trim(),
    lastUpdatedBy: userId,
    lastUpdatedAt: serverTimestamp(),
   });
   console.log('Đã cập nhật tên cư dân trong collection residents.');
 
   // 2. Cập nhật tài liệu user liên kết (nếu có)
   if (editingCommonResidentUserLinkedData) {
    const updateData = {
     fullName: editCommonFullName.trim(),
     phoneNumber: editCommonPhoneNumber.trim(),
     academicLevel: editCommonAcademicLevel.trim(),
     dormEntryDate: editCommonDormEntryDate.trim(),
     birthday: editCommonBirthday.trim(),
     studentId: editCommonStudentId.trim(),
     lastUpdatedBy: userId,
     lastUpdatedAt: serverTimestamp(),
    };
    // Add avatar URL to the update data if it was uploaded
    if (avatarUrl) {
     updateData.avatarUrl = avatarUrl;
    }
    const userDocRef = doc(db, `artifacts/${currentAppId}/public/data/users`, editingCommonResidentUserLinkedData.id);
    await updateDoc(userDocRef, updateData);
    console.log('Đã cập nhật thông tin cá nhân trong collection users.');
   }
 
   setEditingCommonResidentData(null); // Đóng modal
   setEditingCommonResidentUserLinkedData(null);
   // Reset các state của form
   setEditCommonFullName('');
   setEditCommonEmail('');
   setEditCommonPhoneNumber('');
   setEditCommonAcademicLevel('');
   setEditCommonDormEntryDate('');
   setEditCommonBirthday('');
   setEditCommonStudentId('');
   setSelectedAvatarFile(null);
   setTempAvatarUrl('');

   // THÔNG BÁO CẬP NHẬT THÀNH CÔNG
  setUpdateSuccessMessage('Cập nhật thông tin thành viên thành công! 🎉');
  setTimeout(() => setUpdateSuccessMessage(''), 5000); // Xóa thông báo sau 5 giây

  } catch (error) {
   console.error('Lỗi khi cập nhật thông tin thành viên:', error);
   setAuthError(`Lỗi khi cập nhật thông tin thành viên: ${error.message}`);
   setTimeout(() => setAuthError(''), 7000); // Xóa lỗi sau 7 giây
  }
  };

  // NEW: Hàm để đóng modal chỉnh sửa mà không lưu
  const handleCancelCommonResidentEdit = () => {
    setEditingCommonResidentData(null);
    setEditingCommonResidentUserLinkedData(null);
    setAuthError('');
    // Reset các state của form
    setEditCommonFullName('');
    setEditCommonEmail('');
    setEditCommonPhoneNumber('');
    setEditCommonAcademicLevel('');
    setEditCommonDormEntryDate('');
    setEditCommonBirthday('');
    setEditCommonStudentId('');
  };

  // NEW: Function to handle file selection for avatar
  const handleAvatarFileChange = (event) => {
  const file = event.target.files?.[0];
  if (file) {
   setSelectedAvatarFile(file);
   // Create a temporary URL for preview
   setTempAvatarUrl(URL.createObjectURL(file));
  }
  };
 
 // NEW: Function to handle avatar upload to Firebase Storage
 const uploadAvatar = async (userId) => {
  if (!db || !storage || !selectedAvatarFile) {
   return null;
  }
 
  setIsUploadingAvatar(true);
  setAvatarUploadProgress(0);
  const avatarStorageRef = ref(storage, `avatars/${userId}/${selectedAvatarFile.name}`);
  const uploadTask = uploadBytesResumable(avatarStorageRef, selectedAvatarFile);
 
  return new Promise((resolve, reject) => {
   uploadTask.on(
    'state_changed',
    (snapshot) => {
     const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
     setAvatarUploadProgress(progress);
     console.log('Upload is ' + progress + '% done');
    },
    (error) => {
     setIsUploadingAvatar(false);
     console.error('Error uploading avatar:', error);
     setAuthError('Lỗi khi tải lên ảnh đại diện.');
     reject(error);
    },
    async () => {
     // Upload completed successfully, now we can get the download URL
     const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
     setIsUploadingAvatar(false);
     setAvatarUploadProgress(0);
     resolve(downloadURL);
    }
   );
  });
 };

  // Hàm để chuyển một người dùng/cư dân sang danh sách tiền bối (chỉ admin)
  const handleMoveToFormerResidents = async (residentId, userIdToDeactivate) => {
    setAuthError(''); // Reset authError
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      setAuthError('Bạn không có quyền thực hiện thao tác này.');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn vô hiệu hóa người này và chuyển họ vào danh sách tiền bối không?')) {
      return;
    }

    try {
      // Lấy thông tin người dùng và cư dân
      const userDocRef = userIdToDeactivate
        ? doc(db, `artifacts/${currentAppId}/public/data/users`, userIdToDeactivate)
        : null;
      const residentDocRef = doc(db, `artifacts/${currentAppId}/public/data/residents`, residentId);

      let residentData = null;
      const residentSnap = await getDoc(residentDocRef);
      if (residentSnap.exists()) {
        residentData = residentSnap.data();
      } else {
        setAuthError('Không tìm thấy hồ sơ cư dân để chuyển đổi.');
        return;
      }

      let userData = null;
      if (userDocRef) {
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          userData = userSnap.data();
        }
      }

      // 1. Vô hiệu hóa tài khoản người dùng (nếu có)
      // Lưu ý: Vô hiệu hóa tài khoản người dùng Firebase Auth trực tiếp từ client là không thể
      // Bạn cần một Cloud Function để làm điều này một cách an toàn.
      // Tạm thời, chúng ta sẽ chỉ cập nhật vai trò/trạng thái trong Firestore.
      if (userDocRef && userData) {
        await updateDoc(userDocRef, {
          role: 'inactive', // Đặt vai trò là 'inactive'
          linkedResidentId: null, // Hủy liên kết cư dân
          deactivatedAt: serverTimestamp(),
        });
        console.log(`Đã vô hiệu hóa tài khoản người dùng ${userData.email}`);
      }

      // 2. Vô hiệu hóa hồ sơ cư dân hiện tại
      await updateDoc(residentDocRef, {
        isActive: false,
        linkedUserId: null, // Hủy liên kết người dùng
      });
      console.log(`Đã vô hiệu hóa hồ sơ cư dân ${residentData.name}`);

      // 3. Chuyển thông tin vào collection 'formerResidents'
      const formerResidentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/formerResidents`);
      await setDoc(
        doc(formerResidentsCollectionRef, residentId),
        {
          // Dùng residentId làm doc ID
          name: residentData.name,
          email: userData?.email || null, // Lấy email từ user data nếu có
          phoneNumber: userData?.phoneNumber || null,
          studentId: userData?.studentId || null,
          birthday: userData?.birthday || null,
          dormEntryDate: userData?.dormEntryDate || null,
          academicLevel: userData?.academicLevel || null,
          originalUserId: userIdToDeactivate,
          deactivatedAt: serverTimestamp(),
          reasonForDeparture: 'Đã chuyển đi', // Có thể thêm input cho lý do
        },
        { merge: true },
      ); // Dùng merge để không ghi đè nếu đã tồn tại

      setAuthError(`Đã chuyển ${residentData.name} sang danh sách tiền bối.`);
      console.log(`Đã chuyển ${residentData.name} sang danh sách tiền bối.`);
    } catch (error) {
      console.error('Lỗi khi chuyển người dùng sang tiền bối:', error);
      setAuthError(`Lỗi: ${error.message}`);
    }
  };

  // Hàm để thêm tiền bối thủ công (KHÔNG CÒN XỬ LÝ HÌNH ẢNH)
  const handleAddFormerResidentManually = async (e) => {
    e.preventDefault();
    setAuthError(''); // Reset authError
    if (!db || !auth || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      setAuthError('Bạn không có quyền thêm tiền bối thủ công.');
      return;
    }
    if (!newFormerResidentName || !newFormerResidentEmail || !newFormerResidentDeactivatedDate) {
      setAuthError('Vui lòng điền đầy đủ Họ tên, Email, Ngày ra khỏi phòng.');
      return;
    }

    // Kiểm tra nếu có file avatar được chọn
    if (newFormerResidentAvatarFile) {
      setIsUploadingFormerResidentAvatar(true); // Bắt đầu quá trình tải lên avatar
      setFormerResidentAvatarUploadProgress(0);
      setFormerResidentAvatarError(''); // Reset lỗi avatar
    }

    try {
      let avatarDownloadURL = null;

      // Tải avatar lên Cloudinary nếu có file được chọn
      if (newFormerResidentAvatarFile) {
        const formData = new FormData();
        formData.append('file', newFormerResidentAvatarFile);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET_AVATAR);
        formData.append('folder', 'avatars/former-residents-manual-add'); // Thư mục riêng cho avatar của tiền bối thêm thủ công

        try {
          const response = await axios.post(CLOUDINARY_API_URL_IMAGE_UPLOAD, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setFormerResidentAvatarUploadProgress(percentCompleted);
            },
          });
          avatarDownloadURL = response.data.secure_url;
          console.log('Avatar tiền bối tải lên Cloudinary thành công, URL:', avatarDownloadURL);
        } catch (uploadError) {
          console.error('Lỗi khi tải ảnh avatar tiền bối lên Cloudinary:', uploadError);
          setFormerResidentAvatarError(`Lỗi khi tải ảnh avatar: ${uploadError.message}`);
          setIsUploadingFormerResidentAvatar(false);
          // Nếu tải ảnh thất bại, hủy toàn bộ quá trình thêm tiền bối
          return;
        } finally {
          setIsUploadingFormerResidentAvatar(false); // Kết thúc trạng thái tải lên avatar
        }
      }

      const formerResidentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/formerResidents`);
      await addDoc(formerResidentsCollectionRef, {
        name: newFormerResidentName.trim(),
        email: newFormerResidentEmail.trim(),
        phoneNumber: newFormerResidentPhone.trim() || null,
        studentId: newFormerResidentStudentId.trim() || null,
        birthday: newFormerResidentBirthday.trim() || null,
        dormEntryDate: newFormerResidentDormEntryDate.trim() || null,
        academicLevel: newFormerResidentAcademicLevel.trim() || null,
        deactivatedAt: newFormerResidentDeactivatedDate,
        photoURL: avatarDownloadURL, // Lưu URL của avatar vào Firestore
        addedManuallyBy: userId,
        createdAt: serverTimestamp(),
      });

      // Reset form và các trạng thái
      setNewFormerResidentName('');
      setNewFormerResidentEmail('');
      setNewFormerResidentPhone('');
      setNewFormerResidentStudentId('');
      setNewFormerResidentBirthday('');
      setNewFormerResidentDormEntryDate('');
      setNewFormerResidentAcademicLevel('');
      setNewFormerResidentDeactivatedDate('');
      setNewFormerResidentAvatarFile(null); // Reset input file avatar
      setFormerResidentAvatarUploadProgress(0);
      setFormerResidentAvatarError(''); // Reset lỗi avatar
      setShowAddFormerResidentModal(false);

      alert('Đã thêm tiền bối thành công!');
      console.log('Đã thêm tiền bối thủ công thành công!');
    } catch (error) {
      console.error('Lỗi khi thêm tiền bối thủ công (Firestore):', error);
      setAuthError(`Lỗi khi thêm tiền bối: ${error.message}`);
      setIsUploadingFormerResidentAvatar(false); // Đảm bảo trạng thái upload được reset
    }
  };

  // Hàm để xóa tiền bối thủ công (chỉ xóa tài liệu Firestore)
  const handleDeleteFormerResident = async (residentId) => {
    // <-- Tham số chỉ là residentId
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      alert('Bạn không có quyền xóa tiền bối.');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn xóa thông tin tiền bối này không?')) {
      return;
    }

    try {
      // Xóa tài liệu Firestore
      await deleteDoc(doc(db, `artifacts/${currentAppId}/public/data/formerResidents`, residentId));

      // Toàn bộ logic xóa ảnh từ Firebase Storage đã bị loại bỏ

      console.log(`Đã xóa tiền bối ${residentId}.`);
      alert('Đã xóa tiền bối thành công!');
    } catch (error) {
      console.error('Lỗi khi xóa tiền bối:', error);
      alert(`Lỗi khi xóa tiền bối: ${error.message}`);
    }
  };

  const createNotification = async (recipientId, type, message, createdBy, relatedId = null, title = null) => {
    // Thêm tham số title
    if (!db) {
      console.error('DB chưa sẵn sàng để tạo thông báo.');
      return;
    }
    try {
      const notificationsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/notifications`);
      await addDoc(notificationsCollectionRef, {
        recipientId: recipientId,
        type: type,
        message: message,
        isRead: false,
        createdAt: serverTimestamp(),
        createdBy: createdBy,
        relatedId: relatedId,
        title: title, // Lưu title vào Firestore
      });
      console.log(`Đã tạo thông báo loại '${type}' cho '${recipientId}'.`);
    } catch (error) {
      console.error('Lỗi khi tạo thông báo:', error);
      setNotificationError(`Lỗi khi tạo thông báo: ${error.message}`);
    }
  };

  // Hàm đánh dấu thông báo đã đọc
  const markNotificationAsRead = async (notificationId) => {
    if (!db || !userId) {
      console.error('DB hoặc User ID chưa sẵn sàng để đánh dấu thông báo đã đọc.');
      return;
    }
    try {
      const notificationDocRef = doc(db, `artifacts/${currentAppId}/public/data/notifications`, notificationId);
      await updateDoc(notificationDocRef, { isRead: true });
      console.log(`Đã đánh dấu thông báo ${notificationId} là đã đọc.`);
    } catch (error) {
      console.error('Lỗi khi đánh dấu thông báo đã đọc:', error);
      setNotificationError(`Lỗi khi đánh dấu thông báo đã đọc: ${error.message}`);
    }
  };

  // Hàm xóa thông báo (chỉ admin)
  const deleteNotification = async (notificationId) => {
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      alert('Bạn không có quyền xóa thông báo.');
      return;
    }
    if (!window.confirm('Bạn có chắc chắn muốn xóa thông báo này không?')) {
      return;
    }
    try {
      const notificationDocRef = doc(db, `artifacts/${currentAppId}/public/data/notifications`, notificationId);
      await deleteDoc(notificationDocRef);
      console.log(`Đã xóa thông báo ${notificationId}.`);
      alert('Đã xóa thông báo thành công!');
    } catch (error) {
      console.error('Lỗi khi xóa thông báo:', error);
      alert(`Lỗi khi xóa thông báo: ${error.message}`);
    }
  };

  // States for Custom Notification Design (Admin)
  const [newNotificationRecipient, setNewNotificationRecipient] = useState('all'); // 'all' or a specific userId
  const [newNotificationType, setNewNotificationType] = useState('general'); // e.g., 'general', 'custom', 'urgent'
  const [newNotificationMessage, setNewNotificationMessage] = useState('');
  const [newNotificationTitle, setNewNotificationTitle] = useState(''); // Optional title/subject
  const [customNotificationError, setCustomNotificationError] = useState('');
  const [customNotificationSuccess, setCustomNotificationSuccess] = useState('');
  const [showAddNotificationModal, setShowAddNotificationModal] = useState(false);

  const [selectedMemoryForLightbox, setSelectedMemoryForLightbox] = useState(null); // Lưu toàn bộ đối tượng memory
  const [currentLightboxIndex, setCurrentLightboxIndex] = useState(0); // Index của file đang hiển thị
  const [selectedMemoryDetails, setSelectedMemoryDetails] = useState(null);

  // New states for avatar upload in the common room info modal
  const [selectedResidentForAvatarUpload, setSelectedResidentForAvatarUpload] = useState(null);
  const [avatarUploadModalFile, setAvatarUploadModalFile] = useState(null);
  const [avatarUploadModalProgress, setAvatarUploadModalProgress] = useState(0);
  const [isUploadingAvatarModal, setIsUploadingAvatarModal] = useState(false);
  const [avatarUploadModalError, setAvatarUploadModalError] = useState('');

  // NEW: Function to handle avatar upload for an ACTIVE resident (for admin in common room info)
  const handleUploadResidentAvatar = async (residentUserId) => {
    setAvatarUploadModalError('');
    if (!db || !auth || !auth.currentUser || !avatarUploadModalFile) {
      setAvatarUploadModalError('Vui lòng chọn một tệp ảnh để tải lên.');
      return;
    }
    if (!residentUserId) {
      setAvatarUploadModalError('Không tìm thấy ID người dùng để cập nhật avatar.');
      return;
    }
    if (userRole !== 'admin') { // Chỉ admin mới có quyền này
      setAvatarUploadModalError('Bạn không có quyền thực hiện thao tác này.');
      return;
    }

    setIsUploadingAvatarModal(true);
    setAvatarUploadModalProgress(0);

    const formData = new FormData();
    formData.append('file', avatarUploadModalFile);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET_AVATAR);
    formData.append('folder', 'avatars/users'); // Lưu vào thư mục 'avatars/users' trên Cloudinary
    formData.append('public_id', residentUserId); // Sử dụng residentUserId làm public_id để dễ quản lý

    try {
      const response = await axios.post(CLOUDINARY_API_URL_IMAGE_UPLOAD, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setAvatarUploadModalProgress(percentCompleted);
        },
      });

      const downloadURL = response.data.secure_url;
      console.log('Avatar tải lên Cloudinary thành công, URL:', downloadURL);

      // Cập nhật photoURL trong tài liệu người dùng trong Firestore
      const userDocRef = doc(db, `artifacts/${currentAppId}/public/data/users`, residentUserId);
      await updateDoc(userDocRef, { photoURL: downloadURL });

      // Nếu avatar của người dùng hiện tại được cập nhật, hãy cập nhật trạng thái userAvatarUrl
      if (userId === residentUserId) {
        setUserAvatarUrl(downloadURL);
      }

      setAvatarUploadModalFile(null); // Đặt lại tệp đã chọn
      setAvatarUploadModalProgress(0);
      setIsUploadingAvatarModal(false);
      setAvatarUploadModalError('');
      alert('Đã cập nhật ảnh đại diện thành công!');
      // Tùy chọn: đóng modal sau khi tải lên thành công
      setSelectedResidentForAvatarUpload(null);
    } catch (error) {
      console.error('Lỗi khi tải ảnh avatar lên Cloudinary:', error);
      setAvatarUploadModalError(`Lỗi khi tải ảnh: ${error.message}`);
      setIsUploadingAvatarModal(false);
      if (error.response) {
        console.error('Cloudinary Error Response:', error.response.data);
      }
    }
  };

  // Hàm đổi mật khẩu
  const handleChangePassword = async () => {
    setPasswordChangeMessage('');
    if (!auth || !userId) {
      setPasswordChangeMessage('Hệ thống xác thực chưa sẵn sàng hoặc bạn chưa đăng nhập.');
      return;
    }
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      setPasswordChangeMessage('Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeMessage('Mật khẩu mới và xác nhận mật khẩu mới không khớp.');
      return;
    }
    if (newPassword.length < 6) {
      // Firebase yêu cầu mật khẩu tối thiểu 6 ký tự
      setPasswordChangeMessage('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (oldPassword === newPassword) {
      setPasswordChangeMessage('Mật khẩu mới phải khác mật khẩu cũ.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setPasswordChangeMessage('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
      return;
    }

    try {
      // Để updatePassword hoạt động, người dùng phải đăng nhập lại gần đây
      // Nếu không, updatePassword sẽ thất bại với lỗi auth/requires-recent-login
      // Chúng ta sẽ cố gắng đăng nhập lại người dùng bằng mật khẩu cũ trước.
      const credential = signInWithEmailAndPassword(auth, user.email, oldPassword); // Dùng user.email
      await credential; // Chờ xác thực lại thành công

      await updatePassword(user, newPassword);
      setPasswordChangeMessage('Đổi mật khẩu thành công!');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error('Lỗi khi đổi mật khẩu:', error.code, error.message);
      if (error.code === 'auth/wrong-password') {
        setPasswordChangeMessage('Mật khẩu cũ không chính xác.');
      } else if (error.code === 'auth/requires-recent-login') {
        setPasswordChangeMessage(
          "Để đổi mật khẩu, vui lòng đăng xuất và đăng nhập lại, sau đó thử lại. Hoặc dùng chức năng 'Quên mật khẩu'.",
        );
      } else if (error.code === 'auth/weak-password') {
        setPasswordChangeMessage('Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.');
      } else {
        setPasswordChangeMessage(`Lỗi đổi mật khẩu: ${error.message}`);
      }
    }
  };

  // Lắng nghe cập nhật danh sách tất cả cư dân (admin sẽ thấy tất cả, thành viên sẽ không dùng trực tiếp)
  useEffect(() => {
    if (!db || !auth || !storage || !isAuthReady || userId === null) {
      console.log('Lắng nghe cư dân: Đang chờ DB, Auth hoặc User ID sẵn sàng.');
      return;
    }
    console.log('Bắt đầu lắng nghe cập nhật danh sách cư dân...');

    const residentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/residents`);
    const q = query(residentsCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const currentResidents = [];
        snapshot.forEach((doc) => {
          currentResidents.push({ id: doc.id, ...doc.data() });
        });
        setResidents(currentResidents);
        console.log('Đã cập nhật danh sách cư dân:', currentResidents);
      },
      (error) => {
        console.error('Lỗi khi lấy dữ liệu cư dân:', error);
      },
    );

    return () => {
      console.log('Hủy đăng ký lắng nghe cư dân.');
      unsubscribe();
    };
  }, [db, isAuthReady, userId]); // userId is still relevant here for the collection path.

  // Lắng nghe cập nhật điểm danh hàng ngày theo thời gian thực cho tháng đã chọn
  useEffect(() => {
    if (!db || !auth || !storage || !isAuthReady || !selectedMonth || userId === null) {
      console.log('Lắng nghe điểm danh: Đang chờ DB, Auth, tháng hoặc User ID sẵn sàng.');
      return;
    }
    console.log(`Bắt đầu lắng nghe điểm danh hàng ngày cho tháng: ${selectedMonth}...`);

    const dailyPresenceCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/dailyPresence`);
    let q;

    // Cả Admin và Member đã đăng nhập đều cần truy vấn tất cả bản ghi điểm danh để hiển thị
    if (userRole === 'member' || userRole === 'admin') { // Nếu là thành viên hoặc admin
      q = query(dailyPresenceCollectionRef); // Truy vấn tất cả các bản ghi
    } else {
      // Nếu không có vai trò hoặc chưa đăng nhập, không truy vấn gì cả
      setMonthlyAttendanceData({}); // Xóa dữ liệu cũ
      return;
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = {};
        snapshot.forEach((docSnap) => {
          const record = docSnap.data();
          const yearMonth = selectedMonth.split('-');
          const startOfMonth = `${selectedMonth}-01`;
          const lastDay = new Date(parseInt(yearMonth[0]), parseInt(yearMonth[1]), 0).getDate();
          const endOfMonth = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

          if (record.date && record.date >= startOfMonth && record.date <= endOfMonth) {
            if (!data[record.residentId]) {
              data[record.residentId] = {};
            }
            const day = record.date.split('-')[2];
            data[record.residentId][day] = record.status;
          }
        });
        setMonthlyAttendanceData(data);
        console.log(`Đã cập nhật dữ liệu điểm danh cho tháng ${selectedMonth}:`, data);
      },
      (error) => {
        console.error('Lỗi khi tải dữ liệu điểm danh tháng:', error);
      },
    );

    return () => {
      console.log(`Hủy đăng ký lắng nghe điểm danh hàng ngày cho tháng ${selectedMonth}.`);
      unsubscribe();
    };
  }, [db, isAuthReady, selectedMonth, userId, userRole, loggedInResidentProfile]); // Thêm loggedInResidentProfile vào dependency

  // Lấy các chỉ số đồng hồ được ghi nhận cuối cùng khi thành phần được gắn kết
  useEffect(() => {
    if (!db || !auth || !storage || !isAuthReady || userId === null) {
      console.log('Lắng nghe chỉ số đồng hồ: Đang chờ DB, Auth hoặc User ID sẵn sàng.');
      return;
    }
    // Chỉ admin mới cần lắng nghe chỉ số đồng hồ
    if (userRole !== 'admin') {
      setLastElectricityReading(0);
      setCurrentElectricityReading(''); // Đặt lại nếu không phải admin
      setLastWaterReading(0);
      setCurrentWaterReading(''); // Đặt lại nếu không phải admin
      return;
    }
    console.log('Bắt đầu lắng nghe chỉ số đồng hồ...');

    const meterReadingsDocRef = doc(db, `artifacts/${currentAppId}/public/data/meterReadings`, 'currentReadings');

    const unsubscribe = onSnapshot(
      meterReadingsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLastElectricityReading(data.electricity || 0);
          setLastWaterReading(data.water || 0);
          console.log('Đã tải chỉ số đồng hồ cuối cùng:', data);
        } else {
          setLastElectricityReading(0);
          setLastWaterReading(0);
          console.log('Tài liệu chỉ số đồng hồ không tồn tại, đặt về 0.');
        }
      },
      (error) => {
        console.error('Lỗi khi lấy chỉ số đồng hồ:', error);
      },
    );

    return () => {
      console.log('Hủy đăng ký lắng nghe chỉ số đồng hồ.');
      unsubscribe();
    };
  }, [db, isAuthReady, userId, userRole]); // Thêm userRole vào dependency

  // Lắng nghe cập nhật Lịch sử hóa đơn
  useEffect(() => {
    if (!db || !auth || !storage || !isAuthReady || userId === null) {
      console.log('Lắng nghe lịch sử hóa đơn: Đang chờ DB, Auth hoặc User ID sẵn sàng.');
      return;
    }
    // Chỉ admin mới cần lắng nghe lịch sử hóa đơn
    if (userRole !== 'admin') {
      setBillHistory([]);
      return;
    }
    console.log('Bắt đầu lắng nghe lịch sử hóa đơn...');

    const billHistoryCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/billHistory`);
    const q = query(billHistoryCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const history = [];
        snapshot.forEach((docSnap) => {
          // Use docSnap instead of doc
          const data = docSnap.data();
          // Chuyển đổi Timestamp thành Date nếu có
          if (data.billDate && typeof data.billDate.toDate === 'function') {
            data.billDate = data.billDate.toDate();
          }
          history.push({ id: docSnap.id, ...data });
        });
        // Sắp xếp phía client theo billDate giảm dần
        history.sort((a, b) => (b.billDate || 0) - (a.billDate || 0));
        setBillHistory(history);
        console.log('Đã cập nhật lịch sử hóa đơn:', history);
      },
      (error) => {
        console.error('Lỗi khi lấy lịch sử hóa đơn:', error);
      },
    );

    return () => {
      console.log('Hủy đăng ký lắng nghe lịch sử hóa đơn.');
      unsubscribe();
    };
  }, [db, isAuthReady, userId, userRole]); // Thêm userRole vào dependency

  // Lắng nghe cập nhật Lịch sử chia sẻ chi phí
  useEffect(() => {
    if (!db || !auth || !storage || !isAuthReady || userId === null) {
      console.log('Lắng nghe lịch sử chia tiền: Đang chờ DB, Auth hoặc User ID sẵn sàng.');
      return;
    }
    // Không cần điều kiện userRole ở đây vì cả admin và thành viên đều cần đọc để hiển thị chi phí
    console.log('Bắt đầu lắng nghe lịch sử chia tiền...');

    const costSharingCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/costSharingHistory`);
    const q = query(costSharingCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const history = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Chuyển đổi Timestamp thành Date nếu có
          if (data.calculatedDate && typeof data.calculatedDate.toDate === 'function') {
            data.calculatedDate = data.calculatedDate.toDate();
          }
          history.push({ id: docSnap.id, ...data });
        });
        // Sắp xếp phía client theo calculatedDate giảm dần
        history.sort((a, b) => (b.calculatedDate || 0) - (a.calculatedDate || 0));
        setCostSharingHistory(history);
        console.log('Đã cập nhật lịch sử chia tiền:', history);
        // CẬP NHẬT remainingFund TỪ BẢN GHI MỚI NHẤT
        if (history.length > 0) {
          setRemainingFund(history[0].remainingFund || 0);
        } else {
          setRemainingFund(0); // Nếu không có bản ghi nào, quỹ phòng là 0
        }
      },
      (error) => {
        console.error('Lỗi khi lấy lịch sử chia tiền:', error);
      },
    );

    return () => {
      console.log('Hủy đăng ký lắng nghe lịch sử chia tiền.');
      unsubscribe();
    };
  }, [db, isAuthReady, userId]); // userRole không còn là dependency trực tiếp ở đây

  // Lắng nghe cập nhật Lịch trực phòng
  useEffect(() => {
    if (!db || !auth || !storage || !isAuthReady || userId === null) {
      console.log('Lắng nghe lịch trực phòng: Đang chờ DB, Auth hoặc User ID sẵn sàng.');
      return;
    }
    // Không cần điều kiện userRole ở đây vì cả admin và thành viên đều cần đọc để hiển thị lịch trực
    console.log('Bắt đầu lắng nghe lịch trực phòng...');

    const cleaningTasksCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/cleaningTasks`);
    const q = query(cleaningTasksCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasks = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Chuyển đổi Timestamp thành Date nếu có
          if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            data.createdAt = data.createdAt.toDate();
          }
          tasks.push({ id: docSnap.id, ...data });
        });
        // Sắp xếp phía client theo ngày tăng dần, sau đó theo tên công việc
        tasks.sort((a, b) => {
          if (a.date < b.date) return -1;
          if (a.date > b.date) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });
        setCleaningSchedule(tasks);
        console.log('Đã cập nhật lịch trực phòng:', tasks);
      },
      (error) => {
        console.error('Lỗi khi lấy lịch trực phòng:', error);
      },
    );

    return () => {
      console.log('Hủy đăng ký lắng nghe lịch trực phòng.');
      unsubscribe();
    };
  }, [db, isAuthReady, userId]); // userRole không còn là dependency trực tiếp ở đây

  // Lắng nghe cập nhật Phân công kệ giày
  useEffect(() => {
    if (!db || !auth || !storage || !isAuthReady || userId === null) {
      console.log('Lắng nghe gán kệ giày: Đang chờ DB, Auth hoặc User ID sẵn sàng.');
      return;
    }
    console.log('Bắt đầu lắng nghe gán kệ giày...');

    const shoeRackCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/shoeRackAssignments`);
    const q = query(shoeRackCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const assignments = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Chuyển đổi Timestamp thành Date nếu có
          if (data.assignedAt && typeof data.assignedAt.toDate === 'function') {
            data.assignedAt = data.assignedAt.toDate();
          }
          assignments[data.shelfNumber] = {
            residentId: data.residentId,
            residentName: data.residentName,
            assignedAt: data.assignedAt,
          };
        });
        setShoeRackAssignments(assignments);
        console.log('Đã cập nhật gán kệ giày:', assignments);
      },
      (error) => {
        console.error('Lỗi khi lấy gán kệ giày:', error);
      },
    );

    return () => {
      console.log('Hủy đăng ký lắng nghe gán kệ giày.');
      unsubscribe();
    };
  }, [db, isAuthReady, userId]);

  // Effect để tính toán thống kê tiêu thụ hàng tháng
  useEffect(() => {
    // Chỉ admin mới cần thống kê tiêu thụ
    if (userRole !== 'admin') {
      setMonthlyConsumptionStats({});
      return;
    }
    if (billHistory.length === 0) {
      setMonthlyConsumptionStats({});
      return;
    }

    const stats = {};
    billHistory.forEach((bill) => {
      const billDate = bill.billDate; // billDate đã là Date object do chuyển đổi trong useEffect billHistory
      if (billDate) {
        const yearMonth = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`;
        if (!stats[yearMonth]) {
          stats[yearMonth] = { electricity: 0, water: 0, total: 0 };
        }
        stats[yearMonth].electricity += bill.electricityConsumption || 0;
        stats[yearMonth].water += bill.waterConsumption || 0;
        stats[yearMonth].total += bill.totalCost || 0;
      }
    });

    // Sắp xếp các tháng để hiển thị
    const sortedStats = Object.keys(stats)
      .sort()
      .reduce((obj, key) => {
        obj[key] = stats[key];
        return obj;
      }, {});
    setMonthlyConsumptionStats(sortedStats);
    console.log('Đã cập nhật thống kê tiêu thụ hàng tháng:', sortedStats);
  }, [billHistory, userRole]); // Thêm userRole vào dependency

  // Lắng nghe tất cả dữ liệu người dùng để hiển thị trong "Thông tin phòng chung"
  useEffect(() => {
    if (!db || !isAuthReady || userId === null) {
      console.log('Lắng nghe tất cả người dùng: Đang chờ DB, Auth hoặc User ID sẵn sàng.');
      return;
    }
    console.log('Bắt đầu lắng nghe cập nhật tất cả người dùng...');

    const usersCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/users`);
    const q = query(usersCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allUsers = [];
        snapshot.forEach((docSnap) => {
          // Use docSnap instead of doc
          const userData = docSnap.data();
          // Chuyển đổi Timestamp thành Date nếu có
          if (userData.createdAt && typeof userData.createdAt.toDate === 'function') {
            userData.createdAt = userData.createdAt.toDate();
          }
          allUsers.push({ id: docSnap.id, ...userData });
        });
        setAllUsersData(allUsers);
        console.log('Đã cập nhật tất cả dữ liệu người dùng:', allUsers);
      },
      (error) => {
        console.error('Lỗi khi lấy tất cả dữ liệu người dùng:', error);
      },
    );

    return () => {
      console.log('Hủy đăng ký lắng nghe tất cả người dùng.');
      unsubscribe();
    };
  }, [db, isAuthReady, userId]); // userId is still relevant for the collection path.

  // Lắng nghe cập nhật Thông tin tiền bối
  useEffect(() => {
    if (!db || !auth || !storage || !isAuthReady || userId === null) {
      console.log('Lắng nghe tiền bối: Đang chờ DB, Auth hoặc User ID sẵn sàng.');
      return;
    }
    console.log('Bắt đầu lắng nghe cập nhật thông tin tiền bối...');

    const formerResidentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/formerResidents`);
    const q = query(formerResidentsCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedFormerResidents = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Chuyển đổi Timestamp thành Date nếu có
          if (data.deactivatedAt && typeof data.deactivatedAt.toDate === 'function') {
            data.deactivatedAt = data.deactivatedAt.toDate();
          }
          fetchedFormerResidents.push({ id: docSnap.id, ...data });
        });
        setFormerResidents(fetchedFormerResidents);
        console.log('Đã cập nhật thông tin tiền bối:', fetchedFormerResidents);
      },
      (error) => {
        console.error('Lỗi khi tải dữ liệu tiền bối:', error);
      },
    );

    return () => {
      console.log('Hủy đăng ký lắng nghe thông tin tiền bối.');
      unsubscribe();
    };
  }, [db, isAuthReady, userId]);

  // Lắng nghe thông báo
  useEffect(() => {
    if (!db || !auth || !storage || !isAuthReady || userId === null) {
      console.log('Lắng nghe thông báo: Đang chờ DB, Auth hoặc User ID sẵn sàng.');
      return;
    }
    console.log('Bắt đầu lắng nghe thông báo...');

    const notificationsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/notifications`);
    // Lấy các thông báo dành cho người dùng hiện tại (userId) hoặc các thông báo chung ('all')
    const q = query(
      notificationsCollectionRef,
      where('recipientId', 'in', [userId, 'all']), // Lấy thông báo cho mình hoặc thông báo chung
      orderBy('createdAt', 'desc'), // Sắp xếp thông báo mới nhất lên đầu
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedNotifications = [];
        let unreadCount = 0;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            data.createdAt = data.createdAt.toDate();
          }
          fetchedNotifications.push({ id: docSnap.id, ...data });
          if (!data.isRead) {
            unreadCount++;
          }
        });
        setNotifications(fetchedNotifications);
        setUnreadNotificationsCount(unreadCount);
        console.log('Đã cập nhật thông báo:', fetchedNotifications);
      },
      (error) => {
        console.error('Lỗi khi tải thông báo:', error);
        setNotificationError(`Lỗi khi tải thông báo: ${error.message}`);
      },
    );

    return () => {
      console.log('Hủy đăng ký lắng nghe thông báo.');
      unsubscribe();
    };
  }, [db, isAuthReady, userId]);

  // Thêm `notificationError` vào useEffect để reset lỗi khi chuyển section
  useEffect(() => {
    setNotificationError(''); // reset lỗi thông báo
  }, [activeSection]);

  // useEffect để kiểm tra và tạo thông báo sinh nhật
  useEffect(() => {
    // Đảm bảo tất cả dữ liệu cần thiết đã được tải và người dùng đã đăng nhập
    if (!db || !auth || !storage || !isAuthReady || userId === null || !allUsersData.length || !residents.length) {
      console.log("Birthday notification check: Waiting for DB, Auth, User ID, allUsersData, or residents to be ready.");
      return;
    }

    const checkBirthdays = async () => {
      const today = new Date();
      const currentYear = today.getFullYear();
      // Chúng ta sẽ kiểm tra sinh nhật chỉ cho ngày hôm nay để đơn giản hóa logic "một lần"
      const currentMonth = today.getMonth() + 1; // getMonth() trả về 0-11
      const currentDay = today.getDate();

      residents
        .filter((res) => res.isActive) // Chỉ xem xét cư dân đang hoạt động
        .forEach(resident => {
          const userLinked = allUsersData.find((u) => u.linkedResidentId === resident.id);
          if (userLinked && userLinked.birthday) {
            // Định dạng ngày sinh nhật của người dùng là YYYY-MM-DD
            // Đảm bảo userLinked.birthday có định dạng YYYY-MM-DD
            // Ví dụ: '1990-07-10'
            const [birthYearStr, birthMonthStr, birthDayStr] = userLinked.birthday.split('-');
            const birthMonth = parseInt(birthMonthStr);
            const birthDay = parseInt(birthDayStr);

            // Kiểm tra xem có phải là sinh nhật hôm nay không
            if (birthMonth === currentMonth && birthDay === currentDay) {
              // *** LOGIC MỚI ĐỂ CHỈ THÔNG BÁO MỘT LẦN DUY NHẤT TRONG NĂM ***
              const notificationKey = `birthdayNotified_${userLinked.id}_${currentYear}`;

              // Kiểm tra xem đã thông báo cho sinh nhật này trong năm nay chưa
              if (!localStorage.getItem(notificationKey)) {
                // Nếu chưa, tạo thông báo
                const message = `🎉 Chúc mừng sinh nhật ${userLinked.fullName || resident.name} tròn ${currentYear - parseInt(birthYearStr)} tuổi!`;
                
                // Gọi hàm tạo thông báo
                createNotification(
                  'all', // Gửi thông báo chung cho tất cả mọi người
                  'birthday',
                  message,
                  userId, // Người tạo thông báo
                  resident.id, // ID cư dân liên quan
                  `Chúc mừng sinh nhật ${userLinked.fullName || resident.name}` // Tiêu đề thông báo
                );

                // Sau khi thông báo, đánh dấu đã thông báo vào localStorage
                localStorage.setItem(notificationKey, 'true');
                console.log(`Đã gửi thông báo sinh nhật cho ${userLinked.fullName} và lưu trạng thái vào localStorage.`);

              } else {
                console.log(`Thông báo sinh nhật cho ${userLinked.fullName} (${currentYear}) đã được hiển thị rồi.`);
              }
            }
          }
        });
    };

    // Chạy kiểm tra khi component load hoặc khi dữ liệu phụ thuộc thay đổi
    checkBirthdays();

  }, [db, isAuthReady, userId, allUsersData, residents]); // Đảm bảo các dependencies đúng

  // Effect để reset lỗi và modals khi chuyển section
  useEffect(() => {
    setSelectedBillDetails(null);
    setSelectedCostSharingDetails(null);
    setShowGenerateScheduleModal(false);
    setAuthError('');
    setBillingError('');
    setGeneratedReminder('');
    setGeneratedCleaningTasks([]);
    setIsGeneratingReminder(false);
    setIsGeneratingSchedule(false);
    setMemoryError('');
    //formerResidentError không còn là state, không cần reset
  }, [activeSection]);

  //KHU VỰC CONST
  // Thêm một cư dân mới
  const handleAddResident = async () => {
    setAuthError('');
    setBillingError('');
    if (!db || !auth || !storage || !userId || (userRole !== 'admin' && userId === 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể thêm cư dân
      console.error('Hệ thống chưa sẵn sàng hoặc bạn không có quyền.');
      setAuthError('Bạn không có quyền thực hiện thao tác này.');
      return;
    }
    if (newResidentName.trim() === '') {
      console.error('Tên người trong phòng không được để trống.');
      setAuthError('Tên người trong phòng không được để trống.');
      return;
    }

    const activeResidentsCount = residents.filter((res) => res.isActive !== false).length;
    if (activeResidentsCount >= 8) {
      console.error('Bạn chỉ có thể thêm tối đa 8 người đang hoạt động trong phòng.');
      setAuthError('Bạn chỉ có thể thêm tối đa 8 người đang hoạt động trong phòng.');
      return;
    }

    const residentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/residents`);

    try {
      await addDoc(residentsCollectionRef, {
        name: newResidentName.trim(),
        addedBy: userId,
        createdAt: serverTimestamp(),
        isActive: true,
      });
      setNewResidentName('');
      console.log(`Đã thêm "${newResidentName}" vào danh sách.`);
    } catch (error) {
      console.error('Lỗi khi thêm người trong phòng:', error);
      setAuthError(`Lỗi khi thêm người trong phòng: ${error.message}`);
    }
  };

  // Thêm vào danh sách các useState của bạn
  const [editingFormerResident, setEditingFormerResident] = useState(null); // Lưu trữ đối tượng tiền bối đang được chỉnh sửa

  // Hàm này để MỞ POPUP và nạp dữ liệu vào form chỉnh sửa
  const handleEditFormerResident = (resident) => {
    setEditingFormerResident({
      id: resident.id,
      name: resident.name,
      email: resident.email || '',
      phoneNumber: resident.phoneNumber || '',
      studentId: resident.studentId || '',
      birthday: resident.birthday || '',
      dormEntryDate: resident.dormEntryDate || '',
      academicLevel: resident.academicLevel || '',
      // Đảm bảo deactivatedAt là string định dạng YYYY-MM-DD
      deactivatedAt: resident.deactivatedAt instanceof Date
        ? formatDate(resident.deactivatedAt)
        : resident.deactivatedAt || '',
      photoURL: resident.photoURL || null,
    });
  };
  
  // Thêm hàm này vào file App.js của bạn
  const handleUpdateFormerResident = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!db || !userId || userRole !== 'admin') {
      setAuthError('Bạn không có quyền cập nhật thông tin tiền bối.');
      return;
    }
    if (!editingFormerResident || !editingFormerResident.id) {
      setAuthError('Không có tiền bối nào được chọn để cập nhật.');
      return;
    }
    if (!editingFormerResident.name || !editingFormerResident.email || !editingFormerResident.deactivatedAt) {
      setAuthError('Vui lòng điền đầy đủ Họ tên, Email, Ngày ra khỏi phòng.');
      return;
    }

    try {
      // Bước 1: Giữ lại URL avatar cũ làm giá trị mặc định
      let avatarDownloadURL = editingFormerResident.photoURL;

      // Bước 2: CHỈ TẢI LÊN NẾU CÓ FILE MỚI ĐƯỢC CHỌN
      if (editingFormerResidentAvatarFile) {
        setIsUploadingEditingFormerResidentAvatar(true);
        setUploadEditingFormerResidentAvatarProgress(0);

        const formData = new FormData();
        formData.append('file', editingFormerResidentAvatarFile);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET_AVATAR);
        formData.append('folder', 'avatars/former-residents');

        try {
          // Tải file lên và gán kết quả vào biến 'response'
          const response = await axios.post(CLOUDINARY_API_URL_IMAGE_UPLOAD, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadEditingFormerResidentAvatarProgress(percentCompleted);
            },
          });
          
          // Lấy URL mới sau khi tải lên thành công
          avatarDownloadURL = response.data.secure_url;
          console.log('Avatar tiền bối tải lên Cloudinary thành công, URL:', avatarDownloadURL);

        } catch (uploadError) {
          console.error('Lỗi khi tải ảnh avatar tiền bối lên Cloudinary:', uploadError);
          setAuthError(`Lỗi khi tải ảnh: ${uploadError.message}`);
          setIsUploadingEditingFormerResidentAvatar(false);
          return; // Dừng hàm nếu tải ảnh lỗi
        } finally {
          setIsUploadingEditingFormerResidentAvatar(false);
        }
      }

      // Bước 3: Cập nhật tài liệu trong Firestore
      const formerResidentDocRef = doc(
        db,
        `artifacts/${currentAppId}/public/data/formerResidents`,
        editingFormerResident.id
      );

      const { id, ...dataToUpdate } = editingFormerResident;

      await updateDoc(formerResidentDocRef, {
        ...dataToUpdate,
        photoURL: avatarDownloadURL, // Lưu URL mới (hoặc cũ nếu không có file mới)
        lastUpdatedBy: userId,
        lastUpdatedAt: serverTimestamp(),
      });

      alert('Đã cập nhật thông tin tiền bối thành công!');
      setEditingFormerResident(null); // Đóng modal
      setEditingFormerResidentAvatarFile(null); // Reset file đã chọn
    } catch (error) {
      console.error('Lỗi khi cập nhật tiền bối:', error);
      setAuthError(`Lỗi khi cập nhật tiền bối: ${error.message}`);
    }
  };

  // Vô hiệu hóa hoặc kích hoạt lại một cư dân
  const handleToggleResidentActiveStatus = async (residentId, residentName, currentStatus) => {
    setAuthError('');
    setBillingError('');
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể chuyển đổi trạng thái
      console.error('Hệ thống chưa sẵn sàng hoặc bạn không có quyền.');
      setAuthError('Bạn không có quyền thực hiện thao tác này.');
      return;
    }

    const residentDocRef = doc(db, `artifacts/${currentAppId}/public/data/residents`, residentId);
    const newStatus = !currentStatus;

    try {
      await setDoc(residentDocRef, { isActive: newStatus }, { merge: true });
      console.log(`Đã cập nhật trạng thái của "${residentName}" thành ${newStatus ? 'Hoạt động' : 'Vô hiệu hóa'}.`);
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái cư dân:', error);
      setAuthError(`Lỗi khi cập nhật trạng thái của ${residentName}: ${error.message}`);
    }
  };

  // Xử lý việc chuyển đổi điểm danh hàng ngày cho một cư dân và ngày cụ thể
  const handleToggleDailyPresence = async (residentId, day) => {
    setAuthError('');
    setBillingError('');
    if (!db || !userId) {
      setAuthError('Hệ thống chưa sẵn sàng. DB hoặc User ID không khả dụng.');
      return;
    }

    // Lấy thông tin chi tiết của người dùng đang đăng nhập
    const currentUserData = allUsersData.find(u => u.id === userId);
    const memberCanTakeAttendance = currentUserData?.canTakeAttendance === true;

    // Thành viên chỉ có thể điểm danh nếu là BẢN THÂN hoặc CÓ QUYỀN ĐẶC BIỆT
    if (userRole === 'member' && !memberCanTakeAttendance && loggedInResidentProfile && residentId !== loggedInResidentProfile.id) {
      setAuthError('Bạn chỉ có thể điểm danh cho bản thân.');
      return;
    }

    // Nếu thành viên chưa có hồ sơ cư dân liên kết
    if (userRole === 'member' && !loggedInResidentProfile) {
      setAuthError('Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.');
      return;
    }

    const dailyPresenceCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/dailyPresence`);

    const fullDate = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    const docId = `${residentId}-${fullDate}`;
    const currentStatus = monthlyAttendanceData[residentId]?.[String(day).padStart(2, '0')] || 0;
    const newStatus = currentStatus === 1 ? 0 : 1;

    try {
      await setDoc(
        doc(dailyPresenceCollectionRef, docId),
        {
          residentId: residentId,
          date: fullDate,
          status: newStatus,
          updatedBy: userId,
          lastUpdated: serverTimestamp(),
        },
        { merge: true },
      );
      console.log(
        `Đã cập nhật trạng thái của ${residents.find((r) => r.id === residentId)?.name} vào ngày ${day}/${selectedMonth} thành ${newStatus === 1 ? 'Có ở' : 'Không ở'}.`,
      );
    } catch (error) {
      console.error('Lỗi khi cập nhật điểm danh hàng ngày:', error);
      setAuthError(`Lỗi khi cập nhật điểm danh hàng ngày: ${error.message}`);
    }
  };

  // Tính hóa đơn
  const calculateBill = async () => {
    setAuthError('');
    setBillingError('');
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể tính hóa đơn
      setAuthError('Hệ thống chưa sẵn sàng hoặc bạn không có quyền.');
      return;
    }
    const elecCurrent = parseFloat(currentElectricityReading);
    const waterCurrent = parseFloat(currentWaterReading);

    // Kiểm tra xem đầu vào có phải là số hợp lệ không
    if (isNaN(elecCurrent) || isNaN(waterCurrent)) {
      console.error('Vui lòng nhập đầy đủ và chính xác các chỉ số điện nước hiện tại.');
      setBillingError('Vui lòng nhập đầy đủ và chính xác các chỉ số điện nước hiện tại.');
      return;
    }

    if (elecCurrent < lastElectricityReading || waterCurrent < lastWaterReading) {
      console.error('Chỉ số hiện tại phải lớn hơn hoặc bằng chỉ số cuối cùng được ghi nhận.');
      setBillingError('Chỉ số hiện tại phải lớn hơn hoặc bằng chỉ số cuối cùng được ghi nhận.');
      return;
    }

    const electricityConsumption = elecCurrent - lastElectricityReading;
    const waterConsumption = currentWaterReading - lastWaterReading; // Sửa lỗi ở đây: dùng waterCurrent

    const currentElectricityCost = electricityConsumption * electricityRate;
    const currentWaterCost = waterConsumption * waterRate;
    const currentTotalCost = currentElectricityCost + currentWaterCost;

    setElectricityCost(currentElectricityCost);
    setWaterCost(currentWaterCost);
    setTotalCost(currentTotalCost);

    // Lưu các chỉ số hiện tại làm chỉ số cuối cùng mới cho chu kỳ tiếp theo
    const meterReadingsDocRef = doc(db, `artifacts/${currentAppId}/public/data/meterReadings`, 'currentReadings');
    const billHistoryCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/billHistory`);

    try {
      await setDoc(
        meterReadingsDocRef,
        {
          electricity: elecCurrent,
          water: waterCurrent,
          lastUpdated: serverTimestamp(),
        },
        { merge: true },
      );

      // Lưu lịch sử hóa đơn
      await addDoc(billHistoryCollectionRef, {
        electricityStartReading: lastElectricityReading,
        electricityEndReading: elecCurrent,
        waterStartReading: lastWaterReading,
        waterEndReading: waterCurrent,
        electricityConsumption: electricityConsumption,
        waterConsumption: waterConsumption,
        electricityCost: currentElectricityCost,
        waterCost: currentWaterCost,
        totalCost: currentTotalCost,
        billDate: serverTimestamp(),
        isPaid: false,
        recordedBy: userId,
        billingMonth: selectedMonth,
      });

      console.log('Đã tính toán chi phí và cập nhật chỉ số đồng hồ thành công!');
    } catch (error) {
      console.error('Lỗi khi lưu chỉ số đồng hồ hoặc lịch sử hóa đơn:', error);
      setBillingError(`Lỗi khi lưu: ${error.message}`);
    }
  };

  // Tính toán số ngày có mặt trong một khoảng thời gian và chi phí cá nhân
  const calculateAttendanceDays = async () => {
    setAuthError('');
    setBillingError('');
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể tính toán điểm danh và chi phí
      setAuthError('Hệ thống chưa sẵn sàng hoặc bạn không có quyền.');
      return;
    }
    if (!startDate || !endDate) {
      setAuthError('Vui lòng chọn ngày bắt đầu và ngày kết thúc để tính toán điểm danh.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      setAuthError('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }

    // Đảm bảo totalCost hợp lệ trước khi tiến hành tính toán chi phí
    if (totalCost <= 0) {
      setBillingError('Vui lòng tính toán tổng chi phí điện nước trước khi chia tiền.');
      return;
    }

    const dailyPresenceCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/dailyPresence`);

    const daysPresentPerResident = {};
    let totalDaysAcrossAllResidentsLocal = 0;
    const individualCalculatedCostsLocal = {}; // Sẽ lưu { residentId: { cost: X, isPaid: false, daysPresent: Z } }

    let calculatedCostPerDayLocal = 0; // <-- Khai báo biến này ở scope rộng hơn
    let calculatedRemainingFund = 0; // <-- Khai báo biến này ở scope rộng hơn

    try {
      // Lấy các bản ghi điểm danh hàng ngày trong khoảng thời gian đã chọn
      const q = query(
        dailyPresenceCollectionRef,
        where('date', '>=', formatDate(start)),
        where('date', '<=', formatDate(end)),
      );
      const querySnapshot = await getDocs(q);

      for (const resident of residents) {
        // Khởi tạo daysPresent cho mỗi cư dân
        daysPresentPerResident[resident.id] = 0;
      }

      // Điền daysPresentPerResident từ snapshot đã lấy
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (residents.some((res) => res.id === data.residentId) && data.status === 1) {
          daysPresentPerResident[data.residentId]++;
        }
      });

      // Tính tổng số ngày trên tất cả các cư dân từ các ngày đã đếm
      for (const residentId in daysPresentPerResident) {
        totalDaysAcrossAllResidentsLocal += daysPresentPerResident[residentId];
      }

      setCalculatedDaysPresent(daysPresentPerResident);
      setTotalCalculatedDaysAllResidents(totalDaysAcrossAllResidentsLocal);

      let totalRoundedIndividualCosts = 0;

      // Tính toán chi phí cá nhân dựa trên totalCost và totalDaysAcrossAllResidents
      if (totalDaysAcrossAllResidentsLocal > 0 && totalCost > 0) {
        calculatedCostPerDayLocal = totalCost / totalDaysAcrossAllResidentsLocal; // Gán vào biến đã khai báo
        setCostPerDayPerPerson(calculatedCostPerDayLocal);
        residents.forEach((resident) => {
          const days = daysPresentPerResident[resident.id] || 0; // Lấy số ngày có mặt
          const rawCost = days * calculatedCostPerDayLocal;
          const roundedCost = Math.round(rawCost / 1000) * 1000;

          // Lưu chi phí, trạng thái đã thanh toán và SỐ NGÀY CÓ MẶT
          individualCalculatedCostsLocal[resident.id] = {
            cost: roundedCost,
            isPaid: false,
            daysPresent: days, // LƯU SỐ NGÀY CÓ MẶT VÀO ĐÂY
          };
          totalRoundedIndividualCosts += roundedCost;
        });
      } else {
        setCostPerDayPerPerson(0);
        residents.forEach((resident) => {
          individualCalculatedCostsLocal[resident.id] = { cost: 0, isPaid: false, daysPresent: 0 }; // Mặc định daysPresent
        });
      }
      setIndividualCosts(individualCalculatedCostsLocal);

      // Lấy số tiền dư/thiếu của tháng hiện tại
      const currentMonthSurplusOrDeficit = totalCost - totalRoundedIndividualCosts;

      // Lấy số tiền quỹ hiện tại (đã có trong state) và cộng dồn
      // Nếu chưa có lịch sử chia tiền, quỹ hiện tại là 0
      const previousRemainingFund = costSharingHistory.length > 0 ? (costSharingHistory[0].remainingFund || 0) : 0;
      calculatedRemainingFund = previousRemainingFund + currentMonthSurplusOrDeficit;

      setRemainingFund(calculatedRemainingFund);
      // Lưu tóm tắt chia sẻ chi phí vào lịch sử bằng cách sử dụng các biến cục bộ
      const costSharingHistoryCollectionRef = collection(
        db,
        `artifacts/${currentAppId}/public/data/costSharingHistory`,
      );
      const newCostSharingDocRef = await addDoc(costSharingHistoryCollectionRef, {
        // Lấy ref của tài liệu mới
        periodStart: startDate,
        periodEnd: endDate,
        totalCalculatedDaysAllResidents: totalDaysAcrossAllResidentsLocal,
        costPerDayPerPerson: calculatedCostPerDayLocal, // Sử dụng biến đã khai báo
        individualCosts: individualCalculatedCostsLocal, // Lưu dưới dạng map các đối tượng {cost, isPaid, daysPresent}
        remainingFund: calculatedRemainingFund, // Sử dụng biến đã khai báo
        calculatedBy: userId,
        calculatedDate: serverTimestamp(),
        relatedTotalBill: totalCost,
      });

      console.log('Đã tính toán số ngày có mặt và chi phí trung bình.');

      // TẠO THÔNG BÁO TIỀN ĐIỆN NƯỚC CHO TỪNG THÀNH VIÊN (Đoạn này đã đúng)
      for (const resident of residents.filter((res) => res.isActive)) {
        const userLinkedToResident = allUsersData.find((user) => user.linkedResidentId === resident.id);
        if (userLinkedToResident) {
          const cost = individualCalculatedCostsLocal[resident.id]?.cost || 0;
          const message = `Bạn có hóa đơn tiền điện nước cần đóng ${cost.toLocaleString('vi-VN')} VND cho kỳ từ ${startDate} đến ${endDate}.`;
          await createNotification(
            userLinkedToResident.id,
            'payment',
            message,
            userId,
            newCostSharingDocRef.id,
            'Hóa đơn tiền điện nước',
          ); // Thêm title
        }
      }
      // Tạo thông báo chung cho admin
      await createNotification(
        'all',
        'payment',
        `Hóa đơn điện nước mới cho kỳ ${startDate} đến ${endDate} đã được tính.`,
        userId,
        newCostSharingDocRef.id,
        'Thông báo hóa đơn chung',
      ); // Thêm title
    } catch (error) {
      console.error('Lỗi khi tính toán ngày có mặt và chi phí:', error);
      setBillingError(`Lỗi khi tính toán: ${error.message}`);
    }
  };

  // Hàm để tạo nhắc nhở thanh toán bằng Gemini API
  const generatePaymentReminder = async () => {
    setAuthError('');
    setBillingError('');
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể tạo nhắc nhở
      setGeneratedReminder('Bạn không có quyền để tạo nhắc nhở.');
      return;
    }
    if (!selectedResidentForReminder) {
      setGeneratedReminder('Vui lòng chọn một người để tạo nhắc nhở.');
      return;
    }
    // Đảm bảo rằng totalCost đã được tính toán và individualCosts có sẵn
    if (totalCost === 0 || totalCalculatedDaysAllResidents === 0 || Object.keys(individualCosts).length === 0) {
      setGeneratedReminder('Vui lòng tính toán chi phí điện nước và ngày có mặt trước.');
      return;
    }

    setIsGeneratingReminder(true);
    setGeneratedReminder('');

    const residentName = residents.find((r) => r.id === selectedResidentForReminder)?.name;
    const formattedTotalCost = totalCost.toLocaleString('vi-VN');
    const period = `${startDate} đến ${endDate}`;

    const prompt = `Bạn là một trợ lý quản lý phòng. Hãy viết một tin nhắn nhắc nhở thanh toán tiền điện nước lịch sự cho ${residentName}.
Tổng tiền điện nước của cả phòng là ${formattedTotalCost} VND.
Số tiền ${residentName} cần đóng là ${individualCosts[selectedResidentForReminder]?.cost.toLocaleString('vi-VN')} VND cho kỳ từ ${period}.
Hãy nhắc nhở họ về số tiền cần thanh toán và thời hạn nếu có (có thể mặc định là cuối tháng).
Tin nhắn nên ngắn gọn, thân thiện và rõ ràng.`;

    let chatHistory = [];
    chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        const text = result.candidates[0].content.parts[0].text;
        setGeneratedReminder(text);
      } else {
        setGeneratedReminder('Không thể tạo nhắc nhở. Vui lòng thử lại.');
        console.error('Cấu trúc phản hồi Gemini API không mong muốn:', result);
      }
    } catch (error) {
      setGeneratedReminder('Lỗi khi kết nối với Gemini API. Vui lòng kiểm tra kết nối mạng.');
      console.error('Lỗi khi gọi Gemini API:', error);
    } finally {
      setIsGeneratingReminder(false);
    }
  };

  // Hàm để chuyển đổi trạng thái đã thanh toán hóa đơn
  const handleToggleBillPaidStatus = async (billId, currentStatus) => {
    setAuthError('');
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể chuyển đổi trạng thái hóa đơn
      setAuthError('Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.');
      return;
    }
    const billDocRef = doc(db, `artifacts/${currentAppId}/public/data/billHistory`, billId);
    try {
      await setDoc(billDocRef, { isPaid: !currentStatus }, { merge: true });
      console.log(`Đã cập nhật trạng thái thanh toán cho hóa đơn ${billId}.`);
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái thanh toán:', error);
      setAuthError(`Lỗi khi cập nhật trạng thái thanh toán: ${error.message}`);
    }
  };

  // Hàm để thêm một công việc vệ sinh
  const handleAddCleaningTask = async () => {
    setAuthError('');
    setBillingError(''); // Đặt lại billingError
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể thêm công việc vệ sinh
      setAuthError('Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.');
      return;
    }
    if (newCleaningTaskName.trim() === '' || !newCleaningTaskDate || !selectedResidentForCleaning) {
      setAuthError('Vui lòng nhập đầy đủ thông tin công việc, ngày và người thực hiện.');
      return;
    }

    const cleaningTasksCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/cleaningTasks`);
    const assignedResident = residents.find((res) => res.id === selectedResidentForCleaning);

    try {
      await addDoc(cleaningTasksCollectionRef, {
        name: newCleaningTaskName.trim(),
        date: newCleaningTaskDate, // Chuỗi בכל-MM-DD
        assignedToResidentId: selectedResidentForCleaning,
        assignedToResidentName: assignedResident ? assignedResident.name : 'Unknown',
        isCompleted: false,
        assignedBy: userId,
        createdAt: serverTimestamp(),
      });
      setNewCleaningTaskName('');
      setNewCleaningTaskDate('');
      setSelectedResidentForCleaning('');
      console.log(`Đã thêm công việc "${newCleaningTaskName}" vào lịch trực.`);
    } catch (error) {
      console.error('Lỗi khi thêm công việc vệ sinh:', error);
      setAuthError(`Lỗi khi thêm công việc vệ sinh: ${error.message}`);
    }
  };

  // Hàm để chuyển đổi trạng thái hoàn thành công việc vệ sinh
  const handleToggleCleaningTaskCompletion = async (taskId, currentStatus) => {
    setAuthError('');
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể chuyển đổi trạng thái công việc vệ sinh
      setAuthError('Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.');
      return;
    }
    const taskDocRef = doc(db, `artifacts/${currentAppId}/public/data/cleaningTasks`, taskId);
    try {
      await setDoc(taskDocRef, { isCompleted: !currentStatus }, { merge: true });
      console.log(`Đã cập nhật trạng thái hoàn thành cho công việc ${taskId}.`);
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái công việc:', error);
      setAuthError(`Lỗi khi cập nhật trạng thái công việc: ${error.message}`);
    }
  };

  // Hàm để xóa một công việc vệ sinh
  const handleDeleteCleaningTask = async (taskId, taskName) => {
    setAuthError('');
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể xóa công việc vệ sinh
      setAuthError('Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.');
      return;
    }
    const taskDocRef = doc(db, `artifacts/${currentAppId}/public/data/cleaningTasks`, taskId);
    try {
      await deleteDoc(taskDocRef);
      console.log(`Đã xóa công việc "${taskName}" khỏi lịch trực.`);
    } catch (error) {
      console.error('Lỗi khi xóa công việc vệ sinh:', error);
      setAuthError(`Lỗi khi xóa công việc vệ sinh: ${error.message}`);
    }
  };

  // Hàm để chuyển đổi trạng thái thanh toán cá nhân trong một bản ghi chia sẻ chi phí
  const handleToggleIndividualPaymentStatus = async (costSharingId, residentId, currentStatus) => {
    setAuthError('');
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể chuyển đổi trạng thái thanh toán
      setAuthError('Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.');
      return;
    }

    const costSharingDocRef = doc(db, `artifacts/${currentAppId}/public/data/costSharingHistory`, costSharingId);

    try {
      const docSnap = await getDoc(costSharingDocRef);
      if (docSnap.exists()) {
        const currentData = docSnap.data();
        const updatedIndividualCosts = JSON.parse(JSON.stringify(currentData.individualCosts || {}));

        if (updatedIndividualCosts[residentId]) {
          // Đảm bảo nó là một đối tượng trước khi đặt isPaid
          if (typeof updatedIndividualCosts[residentId] === 'number') {
            // Trường hợp này có thể xảy ra nếu dữ liệu cũ chỉ lưu cost là number
            updatedIndividualCosts[residentId] = {
              cost: updatedIndividualCosts[residentId],
              isPaid: !currentStatus,
              daysPresent: 0,
            };
          } else {
            updatedIndividualCosts[residentId].isPaid = !currentStatus;
          }
        } else {
          // Nếu residentId không tìm thấy hoặc dữ liệu là null/undefined
          // Trường hợp này lý tưởng là không xảy ra nếu individualCosts được điền đúng cách
          // nhưng được thêm vào để tăng tính mạnh mẽ.
          updatedIndividualCosts[residentId] = { cost: 0, isPaid: !currentStatus, daysPresent: 0 };
        }

        await setDoc(costSharingDocRef, { individualCosts: updatedIndividualCosts }, { merge: true });
        console.log(
          `Đã cập nhật trạng thái thanh toán cá nhân cho ${residentId} trong bản ghi chia tiền ${costSharingId}.`,
        );

        // Cập nhật trạng thái cục bộ của selectedCostSharingDetails để buộc hiển thị lại modal
        setSelectedCostSharingDetails((prevDetails) => {
          if (!prevDetails || prevDetails.id !== costSharingId) return prevDetails;
          return {
            ...prevDetails,
            individualCosts: updatedIndividualCosts,
          };
        });
      } else {
        console.error('Không tìm thấy bản ghi chia tiền để cập nhật.');
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái thanh toán cá nhân:', error);
      setAuthError(`Lỗi khi cập nhật trạng thái thanh toán cá nhân: ${error.message}`);
    }
  };

  // Hàm để gán cư dân vào kệ giày
  const handleAssignShoeRack = async () => {
    setAuthError('');
    setBillingError(''); // Đặt lại billingError
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể gán kệ giày
      setAuthError('Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.');
      return;
    }
    if (!selectedShelfNumber || !selectedResidentForShelf) {
      setAuthError('Vui lòng chọn tầng kệ và người để gán.');
      return;
    }

    const shoeRackDocRef = doc(db, `artifacts/${currentAppId}/public/data/shoeRackAssignments`, selectedShelfNumber);
    const assignedResident = residents.find((res) => res.id === selectedResidentForShelf);

    // Kiểm tra xem kệ đã được gán cho người khác chưa
    const existingAssignment = shoeRackAssignments[selectedShelfNumber];
    if (existingAssignment && existingAssignment.residentId !== selectedResidentForShelf) {
      console.warn(`Tầng kệ ${selectedShelfNumber} đã được gán cho ${existingAssignment.residentName}. Sẽ ghi đè.`);
    }
    // Kiểm tra xem cư dân đã được gán cho kệ khác chưa
    const existingResidentAssignment = Object.entries(shoeRackAssignments).find(
      ([shelf, assignment]) => assignment.residentId === selectedResidentForShelf && shelf !== selectedShelfNumber,
    );
    if (existingResidentAssignment) {
      console.warn(`${assignedResident.name} đã được gán cho tầng kệ ${existingResidentAssignment[0]}. Sẽ di chuyển.`);
      // Xóa gán cũ
      const oldShelfDocRef = doc(
        db,
        `artifacts/${currentAppId}/public/data/shoeRackAssignments`,
        existingResidentAssignment[0],
      );
      await deleteDoc(oldShelfDocRef);
    }

    try {
      await setDoc(shoeRackDocRef, {
        shelfNumber: parseInt(selectedShelfNumber),
        residentId: selectedResidentForShelf,
        residentName: assignedResident ? assignedResident.name : 'Unknown',
        assignedBy: userId,
        assignedAt: serverTimestamp(),
      });
      setSelectedShelfNumber('');
      setSelectedResidentForShelf('');
      console.log(`Đã gán ${assignedResident ? assignedResident.name : 'Unknown'} vào tầng kệ ${selectedShelfNumber}.`);
    } catch (error) {
      console.error('Lỗi khi gán kệ giày:', error);
      setAuthError(`Lỗi khi gán kệ giày: ${error.message}`);
    }
  };

  // Hàm để xóa một phân công kệ giày
  const handleClearShoeRackAssignment = async (shelfNumber) => {
    setAuthError('');
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể xóa kệ giày
      setAuthError('Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.');
      return;
    }
    const shoeRackDocRef = doc(db, `artifacts/${currentAppId}/public/data/shoeRackAssignments`, String(shelfNumber));
    try {
      await deleteDoc(shoeRackDocRef);
      console.log(`Đã xóa việc gán tầng kệ ${shelfNumber}.`); // Sửa lỗi cú pháp string
    } catch (error) {
      console.error('Lỗi khi xóa gán kệ giày:', error);
      setAuthError(`Lỗi khi xóa gán kệ giày: ${error.message}`);
    }
  };

  // Hàm để tạo lịch vệ sinh bằng Gemini API
  const handleGenerateCleaningSchedule = async () => {
    setAuthError('');
    setBillingError('');
    setGeneratedCleaningTasks([]); // Xóa các tác vụ đã tạo trước đó
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể tạo lịch vệ sinh
      setAuthError('Vui lòng đăng nhập hoặc bạn không có quyền để tạo lịch tự động.');
      return;
    }
    const activeResidents = residents.filter((res) => res.isActive !== false);
    if (activeResidents.length === 0) {
      setAuthError('Vui lòng thêm ít nhất một người đang hoạt động vào danh sách để tạo lịch.');
      return;
    }
    if (numDaysForSchedule <= 0) {
      setAuthError('Số ngày tạo lịch phải lớn hơn 0.');
      return;
    }

    setIsGeneratingSchedule(true);

    const residentNames = activeResidents.map((res) => res.name);
    const today = new Date();
    const endDateForPrompt = new Date(today);
    endDateForPrompt.setDate(today.getDate() + parseInt(numDaysForSchedule) - 1);

    const prompt = `Bạn là một trợ lý quản lý phòng. Hãy tạo một lịch trực phòng lau dọn cho các thành viên sau: ${residentNames.join(', ')}.
    Lịch trình nên kéo dài trong ${numDaysForSchedule} ngày, bắt đầu từ hôm nay (${formatDate(today)}).
    Các công việc chính cần phân công luân phiên hàng ngày là:
    Trực phòng

    Hãy đảm bảo mỗi người có ít nhất một công việc trong lịch trình.
    Trả về dưới dạng một mảng JSON, mỗi đối tượng trong mảng có các thuộc tính sau:
    - "taskName": Tên công việc (ví dụ: "Lau sàn")
    - "assignedToResidentName": Tên người được giao (phải là một trong các tên đã cho)
    - "date": Ngày thực hiện công việc (định dạng,"%Y-%m-%d")

    Ví dụ:
    [
      {"taskName": "Lau sàn", "assignedToResidentName": "Nguyễn Minh Hoàng", "date": "2023-10-26"},
      {"taskName": "Đổ rác", "assignedToResidentName": "Nguyễn Tuyên Duy", "date": "2023-10-26"}
    ]
    `;

    let chatHistory = [];
    chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
    const payload = {
      contents: chatHistory,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              taskName: { type: 'STRING' },
              assignedToResidentName: { type: 'STRING' },
              date: { type: 'STRING' },
            },
            required: ['taskName', 'assignedToResidentName', 'date'],
          },
        },
      },
    };
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY; // <-- Sử dụng biến môi trường

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        const jsonText = result.candidates[0].content.parts[0].text;
        const parsedTasks = JSON.parse(jsonText);
        setGeneratedCleaningTasks(parsedTasks);
        console.log('Lịch trực đã tạo bởi Gemini:', parsedTasks);
      } else {
        setAuthError('Không thể tạo lịch trực. Vui lòng thử lại hoặc điều chỉnh yêu cầu.');
        console.error('Cấu trúc phản hồi Gemini API không mong muốn:', result);
      }
    } catch (error) {
      setAuthError('Lỗi khi kết nối với Gemini API. Vui lòng kiểm tra kết nối mạng hoặc API Key.');
      console.error('Lỗi khi gọi Gemini API:', error);
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  // Hàm để lưu các công việc vệ sinh đã tạo vào Firestore
  const handleSaveGeneratedTasks = async () => {
    setAuthError('');
    if (!db || !userId || (userRole !== 'admin' && userId !== 'BJHeKQkyE9VhWCpMfaONEf2N28H2')) {
      // Chỉ admin mới có thể lưu công việc vệ sinh
      setAuthError('Vui lòng đăng nhập hoặc bạn không có quyền để lưu lịch trực.');
      return;
    }
    if (generatedCleaningTasks.length === 0) {
      setAuthError('Không có lịch trực để lưu.');
      return;
    }

    const cleaningTasksCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/cleaningTasks`);

    try {
      for (const task of generatedCleaningTasks) {
        // Tìm residentId dựa trên assignedToResidentName
        const assignedResident = residents.find((res) => res.name === task.assignedToResidentName);
        const residentId = assignedResident ? assignedResident.id : 'unknown';

        await addDoc(cleaningTasksCollectionRef, {
          name: task.taskName,
          date: task.date,
          assignedToResidentId: residentId,
          assignedToResidentName: task.assignedToResidentName,
          isCompleted: false,
          assignedBy: userId,
          createdAt: serverTimestamp(),
        });
      }
      for (const task of generatedCleaningTasks) {
        const assignedResident = residents.find((res) => res.name === task.assignedToResidentName);
        const residentId = assignedResident ? assignedResident.id : 'unknown';

        const newCleaningTaskDocRef = await addDoc(cleaningTasksCollectionRef, {
          // Lấy ref của task mới
          name: task.taskName,
          date: task.date,
          assignedToResidentId: residentId,
          assignedToResidentName: task.assignedToResidentName,
          isCompleted: false,
          assignedBy: userId,
          createdAt: serverTimestamp(),
        });

        // TẠO THÔNG BÁO LỊCH TRỰC CHO NGƯỜI ĐƯỢC PHÂN CÔNG
        const userLinkedToResident = allUsersData.find((user) => user.linkedResidentId === residentId);
        if (userLinkedToResident) {
          const message = `Bạn có công việc trực phòng "${task.taskName}" vào ngày ${task.date}.`;
          await createNotification(userLinkedToResident.id, 'cleaning', message, userId, newCleaningTaskDocRef.id);
        }
      }
      // Tạo thông báo chung cho admin
      await createNotification('all', 'cleaning', `Lịch trực phòng mới đã được tạo và phân công.`, userId);

      setGeneratedCleaningTasks([]); // Xóa các tác vụ đã tạo sau khi lưu
      setShowGenerateScheduleModal(false); // Đóng modal
      console.log('Đã lưu lịch trực tự động thành công!');
    } catch (error) {
      console.error('Lỗi khi lưu lịch trực tự động:', error);
      setAuthError(`Lỗi khi lưu lịch trực tự động: ${error.message}`);
    }
  };

  // Hàm để thành viên đánh dấu đã đóng tiền của họ
  const handleMarkMyPaymentAsPaid = async () => {
    setAuthError('');
    if (!db || !userId || userRole !== 'member' || !loggedInResidentProfile) {
      setAuthError('Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.');
      return;
    }

    // Tìm bản ghi chia tiền gần nhất (hoặc bản ghi đang hiển thị cho thành viên)
    // Để đơn giản, chúng ta sẽ tìm bản ghi chia tiền gần nhất trong lịch sử
    const latestCostSharingRecord = costSharingHistory[0]; // Giả định bản ghi mới nhất là cái cần cập nhật

    if (
      !latestCostSharingRecord ||
      !latestCostSharingRecord.individualCosts ||
      !latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]
    ) {
      setAuthError('Không tìm thấy thông tin chi phí để cập nhật.');
      return;
    }

    const costSharingDocRef = doc(
      db,
      `artifacts/${currentAppId}/public/data/costSharingHistory`,
      latestCostSharingRecord.id,
    );
    const updatedIndividualCosts = JSON.parse(JSON.stringify(latestCostSharingRecord.individualCosts));

    // Đảm bảo chỉ cập nhật trạng thái của người dùng hiện tại
    if (updatedIndividualCosts[loggedInResidentProfile.id]) {
      if (typeof updatedIndividualCosts[loggedInResidentProfile.id] === 'number') {
        updatedIndividualCosts[loggedInResidentProfile.id] = {
          cost: updatedIndividualCosts[loggedInResidentProfile.id],
          isPaid: true,
          daysPresent: 0,
        };
      } else {
        updatedIndividualCosts[loggedInResidentProfile.id].isPaid = true; // Đánh dấu là đã đóng
      }
    }

    try {
      await updateDoc(costSharingDocRef, { individualCosts: updatedIndividualCosts });
      console.log(
        `Người dùng ${loggedInResidentProfile.name} đã đánh dấu đã đóng tiền cho bản ghi ${latestCostSharingRecord.id}.`,
      );
      setAuthError('Đã đánh dấu là đã đóng tiền thành công!');
    } catch (error) {
      console.error('Lỗi khi đánh dấu đã đóng tiền:', error);
      setAuthError(`Lỗi khi đánh dấu đã đóng tiền: ${error.message}`);
    }
  };

  // Hàm lấy số ngày trong tháng đã chọn
  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  // Hàm quản lý loại biểu đồ
  const [chartType, setChartType] = useState('line'); // 'line' hoặc 'bar'

  const currentYear = parseInt(selectedMonth.split('-')[0]);
  const currentMonth = parseInt(selectedMonth.split('-')[1]);
  const daysInSelectedMonth = getDaysInMonth(currentYear, currentMonth);

  // Lọc cư dân dựa trên showInactiveResidents và loggedInResidentProfile
  const displayedResidents = showInactiveResidents // Lọc theo trạng thái vô hiệu hóa (chỉ admin dùng)
    ? residents
    : residents.filter((res) => res.isActive !== false);

  // Hàm renderSection để hiển thị các phần giao diện dựa trên vai trò người dùng
  const renderSection = () => {
    // Nếu chưa đăng nhập hoặc xác thực chưa sẵn sàng, hiển thị thông báo chung
    if (!userId || !isAuthReady) {
      return (
        <div className="text-center p-8 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner">
          <p className="text-xl text-gray-700 dark:text-gray-300 font-semibold mb-4">
            Vui lòng đăng nhập để sử dụng ứng dụng.
          </p>
        </div>
      );
    }
    // NEW: Hiển thị thông báo xác minh email nếu cần
    if (needsEmailVerification) {
      return (
        <div className="p-6 bg-red-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-4">
                Tài khoản của bạn chưa được xác minh!
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
                Vui lòng vào mục "Chỉnh sửa thông tin cá nhân" để thêm và xác minh email cá nhân của bạn.
            </p>
            <button
                onClick={() => setActiveSection('memberProfileEdit')}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
            >
                <i className="fas fa-user-edit mr-2"></i> Đến trang xác minh
            </button>
            {authError && <p className="text-red-500 text-sm mt-4">{authError}</p>}
            {/* Bạn có thể thêm nút "Gửi lại email xác minh" tại đây nếu muốn */}
            {/* <button onClick={handleResendVerificationEmail} className="mt-2 text-indigo-600 dark:text-indigo-400 hover:underline">
                Gửi lại email xác minh
            </button> */}
        </div>
      );
    }

    // Logic cho Admin
    if (userRole === 'admin' || userId === 'BJHeKQkyE9VhWCpMfaONEf2N28H2') {
      switch (activeSection) {
        case 'dashboard': // Dashboard cho Admin
          // Lọc các nhiệm vụ trực phòng sắp tới cho Admin (tất cả các nhiệm vụ chưa hoàn thành)
          const upcomingAdminCleaningTasks = cleaningSchedule
            .filter((task) => !task.isCompleted && new Date(task.date) >= new Date())
            .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sắp xếp theo ngày tăng dần

          // CHUẨN BỊ DỮ LIỆU CHO BIỂU ĐỒ TIÊU THỤ ĐIỆN NƯỚC
          const chartData = Object.entries(monthlyConsumptionStats).map(([month, stats]) => ({
            month: month, // Ví dụ: "2025-06"
            điện: stats.electricity, // Dữ liệu điện
            nước: stats.water, // Dữ liệu nước
            tổng: stats.total, // Dữ liệu tổng tiền
          }));
          // KẾT THÚC: CHUẨN BỊ DỮ LIỆU CHO BIỂU ĐỒ

          return (
            <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-5">Dashboard Tổng quan</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Widget: Số người ở hiện tại */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col items-center justify-center">
                  <i className="fas fa-users text-4xl text-blue-500 mb-3"></i>
                  <p className="text-lg text-gray-700 dark:text-gray-300">Người ở hiện tại</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-300">
                    {residents.filter((res) => res.isActive).length} / 8
                  </p>
                </div>

                {/* Widget: Tổng tiền quỹ */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col items-center justify-center">
                  <i className="fas fa-wallet text-4xl text-green-500 mb-3"></i>
                  <p className="text-lg text-gray-700 dark:text-gray-300">Tổng tiền quỹ</p>
                  <p
                    className={`text-3xl font-bold ${remainingFund >= 0 ? 'text-green-600' : 'text-red-500'} dark:text-green-300`}
                  >
                    {remainingFund.toLocaleString('vi-VN')} VND
                  </p>
                </div>

                {/* Widget: Thông báo chưa đọc */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col items-center justify-center">
                  <i className="fas fa-bell text-4xl text-yellow-500 mb-3"></i>
                  <p className="text-lg text-gray-700 dark:text-gray-300">Thông báo chưa đọc</p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-300">{unreadNotificationsCount}</p>
                </div>

                {/* Widget: Hóa đơn gần nhất */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md col-span-full">
                  <h3 className="text-xl font-bold text-blue-700 dark:text-blue-200 mb-3">Hóa đơn gần nhất</h3>
                  {billHistory.length > 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">
                      <strong>Kỳ tính:</strong> {billHistory[0].billingMonth} - <strong>Tổng:</strong>{' '}
                      {billHistory[0].totalCost?.toLocaleString('vi-VN')} VND
                      <span
                        className={`ml-2 font-semibold ${billHistory[0].isPaid ? 'text-green-600' : 'text-red-500'}`}
                      >
                        ({billHistory[0].isPaid ? 'Đã trả' : 'Chưa trả'})
                      </span>
                    </p>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 italic">Chưa có hóa đơn nào.</p>
                  )}
                </div>

                {/* Widget: Các nhiệm vụ trực phòng sắp tới (Admin thấy tất cả) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md col-span-full">
                  <h3 className="text-xl font-bold text-purple-700 dark:text-purple-200 mb-3">
                    Nhiệm vụ trực phòng sắp tới
                  </h3>
                  {upcomingAdminCleaningTasks.length > 0 ? (
                    <ul className="space-y-2">
                      {upcomingAdminCleaningTasks.slice(0, 5).map(
                        (
                          task, // Chỉ hiển thị 5 nhiệm vụ đầu
                        ) => (
                          <li key={task.id} className="text-gray-700 dark:text-gray-300">
                            <i className="fas fa-check-circle mr-2 text-purple-500"></i>
                            {task.name} ({task.assignedToResidentName}) vào ngày {task.date}
                          </li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 italic">Không có nhiệm vụ sắp tới.</p>
                  )}
                </div>

                {/* Widget: Tóm tắt tiền quỹ (Nếu muốn hiển thị chi tiết hơn) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md col-span-full">
                  <h3 className="text-xl font-bold text-orange-700 dark:text-orange-200 mb-3">
                    Tóm tắt chia tiền gần nhất
                  </h3>
                  {costSharingHistory.length > 0 ? (
                    <div>
                      <p className="text-gray-700 dark:text-gray-300">
                        <strong>Kỳ:</strong> {costSharingHistory[0].periodStart} - {costSharingHistory[0].periodEnd}
                      </p>
                      <p className="text-gray-700 dark:text-gray-300">
                        <strong>Tổng ngày có mặt:</strong> {costSharingHistory[0].totalCalculatedDaysAllResidents} ngày
                      </p>
                      <p className="text-gray-700 dark:text-gray-300">
                        <strong>Tiền/ngày/người:</strong>{' '}
                        {costSharingHistory[0].costPerDayPerPerson?.toLocaleString('vi-VN', {
                          maximumFractionDigits: 0,
                        })}{' '}
                        VND
                      </p>
                      <p className="text-gray-700 dark:text-gray-300">
                        <strong>Quỹ còn lại:</strong> {costSharingHistory[0].remainingFund?.toLocaleString('vi-VN')} VND
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 italic">Chưa có bản chia tiền nào.</p>
                  )}
                </div>

                {/* Các biểu đồ/thống kê trực quan (placeholder) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md col-span-full text-center text-gray-500 dark:text-gray-400">
                  <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-3">
                    Biểu đồ tiêu thụ điện nước
                  </h3>
                  {Object.keys(monthlyConsumptionStats).length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#444' : '#ccc'} />
                        <XAxis dataKey="month" stroke={theme === 'dark' ? '#ddd' : '#333'} />
                        <YAxis stroke={theme === 'dark' ? '#ddd' : '#333'} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="điện" stroke="#8884d8" name="Điện (KW)" />
                        <Line type="monotone" dataKey="nước" stroke="#82ca9d" name="Nước (m³)" />
                        <Line type="monotone" dataKey="tổng" stroke="#ffc658" name="Tổng tiền (VND)" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                      Chưa có dữ liệu thống kê nào để tạo biểu đồ. Vui lòng tính toán hóa đơn.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        //Case quản lý người ở
        case 'residentManagement':
        return (
          <div className="p-6 bg-purple-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-200 mb-5">
              Quản lý người trong phòng
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                value={newResidentName}
                onChange={(e) => {
                  setNewResidentName(e.target.value);
                  setAuthError('');
                }}
                className="flex-1 shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
                placeholder="Nhập tên người trong phòng (tối đa 8 người)"
                maxLength="30"
              />
              <button
                onClick={handleAddResident}
                className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-xl shadow-md hover:bg-purple-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                disabled={residents.filter((res) => res.isActive !== false).length >= 8}
              >
                <i className="fas fa-user-plus mr-2"></i> Thêm
              </button>
            </div>
            {residents.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-inner max-h-screen-1/2 overflow-y-auto border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-semibold text-purple-700 dark:text-purple-200 mb-3">
                  Danh sách người trong phòng:
                </h3>
                <div className="mb-4">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      className="form-checkbox h-5 w-5 text-purple-600 dark:text-purple-400 rounded"
                      checked={showInactiveResidents}
                      onChange={(e) => setShowInactiveResidents(e.target.checked)}
                    />
                    <span className="ml-2 text-gray-700 dark:text-gray-300">Hiển thị người đã vô hiệu hóa</span>
                  </label>
                </div>
                <ul className="space-y-3">
                  {residents.map((resident) => (
                    <li
                      key={resident.id}
                      className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-gray-700 dark:text-gray-300 text-base">
                          {resident.name}
                        </span>
                        {resident.createdAt && typeof resident.createdAt.toDate === 'function' && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Thêm vào: {resident.createdAt.toDate().toLocaleDateString('vi-VN')}
                          </span>
                        )}
                        {resident.isActive === false && (
                          <span className="text-xs text-red-500 dark:text-red-400 mt-1 font-semibold">
                            (Đã vô hiệu hóa)
                          </span>
                        )}
                        {resident.linkedUserId && (
                          <span className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                            (Đã liên kết với Người dùng)
                          </span>
                        )}
                      </div>
                      {resident.isActive ? (
                        <button
                          onClick={() => handleToggleResidentActiveStatus(resident.id, resident.name, true)}
                          className="ml-4 px-3 py-1 bg-red-500 text-white text-sm rounded-lg shadow-sm hover:bg-red-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-400"
                        >
                          Vô hiệu hóa
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleResidentActiveStatus(resident.id, resident.name, false)}
                          className="ml-4 px-3 py-1 bg-green-500 text-white text-sm rounded-lg shadow-sm hover:bg-green-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-400"
                        >
                          Kích hoạt lại
                        </button>
                      )}
                      {resident.isActive && resident.linkedUserId && (
                        <button
                          onClick={() => handleMoveToFormerResidents(resident.id, resident.linkedUserId)}
                          className="ml-2 px-3 py-1 bg-indigo-500 text-white text-sm rounded-lg shadow-sm hover:bg-indigo-600 transition-colors duration-200"
                        >
                          Chuyển tiền bối
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
        //Case điểm danh
        case 'attendanceTracking':
          return (
            <div className="p-6 bg-green-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-5">
                {userRole === 'admin' ? 'Điểm danh theo tháng' : 'Điểm danh của tôi'}
              </h2>
              <div className="mb-6 flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <label htmlFor="monthSelector" className="font-semibold text-gray-700 dark:text-gray-300 text-lg">
                  Chọn tháng:
                </label>
                <input
                  type="month"
                  id="monthSelector"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>

              {/* ===== KHUNG CHỨA CÓ THANH CUỘN NGANG ===== */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                {displayedResidents.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                    Chưa có người ở nào để điểm danh.
                  </p>
                ) : (
                  <table className="min-w-full bg-white dark:bg-gray-800">
                    <thead>
                      <tr>
                        <th className="py-3 px-4 text-left sticky left-0 z-10 bg-green-100 dark:bg-gray-700 border-r border-green-200 dark:border-gray-600 text-green-800 dark:text-green-200 uppercase text-sm font-semibold">
                          Tên
                        </th>
                        {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((day) => (
                          <th
                            key={day}
                            className="py-3 px-2 text-center border-l border-green-200 dark:border-gray-600 text-green-800 dark:text-green-200 uppercase text-sm leading-normal"
                          >
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                      {displayedResidents.map((resident) => {
                        const isMyRow = loggedInResidentProfile && resident.id === loggedInResidentProfile.id;
                        return (
                          <tr
                            key={resident.id}
                            className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                          >
                            <td className="py-3 px-6 text-left whitespace-nowrap font-medium sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-700">
                              {resident.name}
                            </td>
                            {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((day) => {
                              const dayString = String(day).padStart(2, '0');
                              const isPresent = monthlyAttendanceData[resident.id]?.[dayString] === 1;
                              return (
                                <td
                                  key={day}
                                  className="py-3 px-2 text-center border-l border-gray-200 dark:border-gray-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isPresent}
                                    onChange={() => handleToggleDailyPresence(resident.id, day)}
                                    disabled={userRole === 'member' && !isMyRow}
                                    className="form-checkbox h-5 w-5 rounded focus:ring-green-500 cursor-pointer text-green-600 dark:text-green-400 dark:disabled:bg-slate-500 dark:disabled:border-slate-400 dark:disabled:checked:bg-yellow-600 dark:disabled:checked:border-transparent"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        //Case tính tiền điện nước
        case 'billing':
            return (
              // Container chính cho toàn bộ mục, dùng space-y để tạo khoảng cách giữa các khối
              <div className="space-y-8">

                {/* ===== KHỐI 1: TÍNH TIỀN ĐIỆN NƯỚC ===== */}
                <div className="p-6 bg-yellow-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
                  <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-5">Tính tiền điện nước</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Electricity */}
                    <div>
                      <label htmlFor="lastElectricityReading" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                        Chỉ số điện cuối cùng (KW):
                      </label>
                      <input
                        type="number"
                        id="lastElectricityReading"
                        value={lastElectricityReading}
                        readOnly
                        className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="currentElectricityReading" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                        Chỉ số điện hiện tại (KW):
                      </label>
                      <input
                        type="number"
                        id="currentElectricityReading"
                        value={currentElectricityReading}
                        onChange={(e) => { setCurrentElectricityReading(e.target.value); setBillingError(''); }}
                        className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 bg-white dark:bg-gray-700"
                        placeholder="Nhập chỉ số hiện tại"
                      />
                    </div>

                    {/* Water */}
                    <div>
                      <label htmlFor="lastWaterReading" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                        Chỉ số nước cuối cùng (m³):
                      </label>
                      <input
                        type="number"
                        id="lastWaterReading"
                        value={lastWaterReading}
                        readOnly
                        className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="currentWaterReading" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                        Chỉ số nước hiện tại (m³):
                      </label>
                      <input
                        type="number"
                        id="currentWaterReading"
                        value={currentWaterReading}
                        onChange={(e) => { setCurrentWaterReading(e.target.value); setBillingError(''); }}
                        className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 bg-white dark:bg-gray-700"
                        placeholder="Nhập chỉ số hiện tại"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={calculateBill}
                    className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all"
                  >
                    <i className="fas fa-calculator mr-2"></i> Tính toán chi phí
                  </button>

                  {totalCost > 0 && (
                    <div className="mt-6 bg-blue-100 dark:bg-gray-800 p-4 rounded-xl text-lg font-semibold">
                      <p>Tiền điện: <span className="text-blue-700 dark:text-blue-300">{electricityCost.toLocaleString('vi-VN')} VND</span></p>
                      <p>Tiền nước: <span className="text-blue-700 dark:text-blue-300">{waterCost.toLocaleString('vi-VN')} VND</span></p>
                      <p className="border-t pt-3 mt-3 text-xl font-bold">
                        Tổng cộng: <span className="text-blue-800 dark:text-blue-200">{totalCost.toLocaleString('vi-VN')} VND</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* ===== KHỐI 2: CÀI ĐẶT GIÁ ĐIỆN & NƯỚC ===== */}
                <div className="p-6 bg-yellow-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
                  <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-5">
                    Cài đặt giá điện & nước
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                        Giá điện hiện tại (VND/KW):
                      </label>
                      <input
                        type="text"
                        value={`${electricityRate.toLocaleString('vi-VN')} VND`}
                        readOnly
                        className="shadow-sm border rounded-xl w-full py-2 px-4 bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                        Giá nước hiện tại (VND/m³):
                      </label>
                      <input
                        type="text"
                        value={`${waterRate.toLocaleString('vi-VN')} VND`}
                        readOnly
                        className="shadow-sm border rounded-xl w-full py-2 px-4 bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="newElecRate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                        Nhập giá điện mới:
                      </label>
                      <input
                        type="number"
                        id="newElecRate"
                        value={newElectricityRate}
                        onChange={(e) => setNewElectricityRate(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-4 bg-white dark:bg-gray-700"
                        placeholder="Ví dụ: 2600"
                      />
                    </div>
                    <div>
                      <label htmlFor="newWatRate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                        Nhập giá nước mới:
                      </label>
                      <input
                        type="number"
                        id="newWatRate"
                        value={newWaterRate}
                        onChange={(e) => setNewWaterRate(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-4 bg-white dark:bg-gray-700"
                        placeholder="Ví dụ: 4500"
                      />
                    </div>
                  </div>
                  {billingError && <p className="text-red-500 text-sm text-center mb-4">{billingError}</p>}
                  <button
                    onClick={handleUpdateRates}
                    className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-xl shadow-md hover:bg-green-700 transition-all"
                  >
                    Lưu thay đổi giá
                  </button>
                </div>
                {/* ===== KHỐI 3: CÀI ĐẶT MÃ QR THANH TOÁN ===== */}
                <div className="p-6 bg-yellow-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
                  <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-5">
                    Cài đặt QR Thanh toán
                  </h2>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Phần xem trước QR */}
                    <div className="flex-shrink-0">
                      <p className="text-center text-sm font-semibold mb-2">Mã QR hiện tại:</p>
                      {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="Mã QR thanh toán" className="w-40 h-40 object-contain border rounded-lg bg-white"/>
                      ) : (
                        <div className="w-40 h-40 border rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                          Chưa có mã QR
                        </div>
                      )}
                    </div>
                    {/* Phần tải lên */}
                    <div className="flex-1 w-full">
                      <label htmlFor="qrCodeFile" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                        Tải lên mã QR mới:
                      </label>
                      <input
                        type="file"
                        id="qrCodeFile"
                        accept="image/*"
                        onChange={(e) => setNewQrCodeFile(e.target.files[0])}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <button
                        onClick={handleUploadQrCode}
                        className="w-full mt-4 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700"
                        disabled={isUploadingQrCode || !newQrCodeFile}
                      >
                        {isUploadingQrCode ? 'Đang tải lên...' : 'Lưu mã QR mới'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            );
        //Case chia tiền điện nước
        case 'costSharing':
        return (
          <div className="p-6 bg-orange-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-orange-800 dark:text-orange-200 mb-5">
              Tính ngày có mặt & Chia tiền
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label htmlFor="startDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                  Ngày bắt đầu:
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                  Ngày kết thúc:
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>
            </div>
            <button
              onClick={calculateAttendanceDays}
              className="w-full px-6 py-3 bg-orange-600 text-white font-semibold rounded-xl shadow-md hover:bg-orange-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-75 mb-6"
              disabled={residents.length === 0 || totalCost <= 0}
            >
              <i className="fas fa-calendar-check mr-2"></i> Tính ngày có mặt
            </button>

            {totalCalculatedDaysAllResidents > 0 && totalCost > 0 && (
              <div className="bg-orange-100 dark:bg-gray-700 p-4 rounded-xl shadow-inner text-lg font-semibold text-orange-900 dark:text-orange-100 border border-orange-200 dark:border-gray-600">
                <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mb-3">
                  Kết quả điểm danh theo ngày:
                </h3>
                <ul className="space-y-2 mb-3">
                  {residents.map((resident) => (
                    <li
                      key={resident.id}
                      className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                    >
                      <span className="font-medium text-gray-700 dark:text-gray-300">{resident.name}:</span>
                      <span className="text-orange-700 dark:text-orange-300 font-bold">
                        {calculatedDaysPresent[resident.id] || 0} ngày
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="border-t pt-3 mt-3 border-orange-300 dark:border-gray-600 text-xl font-bold">
                  Tổng số ngày có mặt của tất cả:{' '}
                  <span className="text-orange-800 dark:text-orange-200">{totalCalculatedDaysAllResidents} ngày</span>
                </p>

                <>
                  <p className="mt-3 text-xl font-bold">
                    Chi phí trung bình 1 ngày 1 người:{' '}
                    <span className="text-orange-800 dark:text-orange-200">
                      {costPerDayPerPerson.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} VND
                    </span>
                  </p>
                  <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mt-5 mb-3">
                    Số tiền mỗi người cần đóng:
                  </h3>
                  <ul className="space-y-2">
                    {/* Sắp xếp cư dân để hiển thị dựa trên số ngày có mặt và sau đó là chi phí */}
                    {[...residents]
                      .sort((a, b) => {
                        const daysA = calculatedDaysPresent[a.id] || 0;
                        const daysB = calculatedDaysPresent[b.id] || 0;
                        const costA = individualCosts[a.id]?.cost || 0;
                        const costB = individualCosts[b.id]?.cost || 0;

                        if (daysA !== daysB) {
                          return daysB - daysA;
                        }
                        return costB - costA;
                      })
                      .map((resident) => (
                        <li
                          key={resident.id}
                          className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                        >
                          <span className="font-medium text-gray-700 dark:text-gray-300">{resident.name}:</span>
                          <span className="font-bold">
                            {(individualCosts[resident.id]?.cost || 0).toLocaleString('vi-VN')} VND
                          </span>
                        </li>
                      ))}
                  </ul>
                  <p className="border-t pt-3 mt-3 border-orange-300 dark:border-gray-600 text-xl font-bold">
                    Quỹ phòng còn lại:{' '}
                    <span
                      className={`font-bold ${remainingFund >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}
                    >
                      {remainingFund.toLocaleString('vi-VN')} VND
                    </span>
                  </p>

                  {/* ===== KHỐI CẬP NHẬT QUỸ PHÒNG - BẮT ĐẦU ===== */}
                  <div className="mt-6 pt-4 border-t border-dashed border-orange-300 dark:border-gray-600">
                    <h4 className="text-lg font-bold text-orange-800 dark:text-orange-200 mb-2">
                      Cập nhật lại số tiền quỹ
                    </h4>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        value={fundInputValue}
                        onChange={(e) => setFundInputValue(e.target.value)}
                        className="flex-1 shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700"
                        placeholder="Nhập số tiền quỹ mới..."
                      />
                      <button
                        onClick={handleUpdateFundManually}
                        className="px-4 py-2 bg-green-600 text-white font-semibold rounded-xl shadow-md hover:bg-green-700 transition-all duration-300"
                      >
                        Cập nhật
                      </button>
                    </div>
                    {billingError && <p className="text-red-500 text-sm mt-2">{billingError}</p>}
                  </div>
                  {/* ===== KHỐI CẬP NHẬT QUỸ PHÒNG - KẾT THÚC ===== */}

                  {/* ===== KHỐC GHI NHẬN CHI TIÊU QUỸ - BẮT ĐẦU ===== */}
                  <div className="mt-8 pt-6 border-t border-orange-300 dark:border-gray-600">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200">
                        Lịch sử chi tiêu quỹ phòng
                      </h3>
                      <button
                        onClick={() => setShowAddExpenseModal(true)}
                        className="bg-orange-500 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-orange-600 transition"
                        title="Thêm chi tiêu mới"
                      >
                        <i className="fas fa-plus"></i>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {fundExpenses.length > 0 ? (
                        fundExpenses.map(expense => (
                          <div key={expense.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg flex justify-between items-center text-sm">
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-gray-200">{expense.description}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {expense.spentAt?.toDate().toLocaleDateString('vi-VN')}
                              </p>
                            </div>
                            <p className="font-bold text-red-600">
                              - {expense.amount.toLocaleString('vi-VN')} VND
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400 italic text-center">Chưa có chi tiêu nào được ghi nhận.</p>
                      )}
                    </div>
                  </div>
                  {/* ===== KHỐI GHI NHẬN CHI TIÊU QUỸ - KẾT THÚC ===== */}


                  {/* ===== POPUP THÊM CHI TIÊU MỚI ===== */}
                  {showAddExpenseModal && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
                      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">
                          Thêm chi tiêu từ quỹ
                        </h3>
                        <form onSubmit={handleAddFundExpense} className="space-y-4">
                          <div>
                            <label htmlFor="expenseDesc" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                              Nội dung chi tiêu:
                            </label>
                            <input
                              type="text"
                              id="expenseDesc"
                              value={newExpenseDescription}
                              onChange={(e) => setNewExpenseDescription(e.target.value)}
                              className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4"
                              required
                              placeholder="Ví dụ: Mua nước rửa chén, giấy vệ sinh..."
                            />
                          </div>
                          <div>
                            <label htmlFor="expenseAmount" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                              Số tiền:
                            </label>
                            <input
                              type="number"
                              id="expenseAmount"
                              value={newExpenseAmount}
                              onChange={(e) => setNewExpenseAmount(e.target.value)}
                              className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4"
                              required
                              placeholder="Nhập số tiền đã chi..."
                            />
                          </div>
                          {billingError && <p className="text-red-500 text-sm text-center">{billingError}</p>}
                          <div className="flex space-x-4 mt-6">
                            <button
                              type="button"
                              onClick={() => { setShowAddExpenseModal(false); setBillingError(''); }}
                              className="w-1/2 px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400"
                            >
                              Hủy
                            </button>
                            <button
                              type="submit"
                              className="w-1/2 px-6 py-3 bg-orange-600 text-white font-semibold rounded-xl shadow-md hover:bg-orange-700"
                            >
                              Thêm
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </>
              </div>
            )}
          </div>
        );
        //Case lịch sử tính tiền điện nước
        case 'billHistory':
        return (
          <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Lịch sử tiền điện nước</h2>
            {billHistory.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                Chưa có hóa đơn nào được lưu.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-full bg-white dark:bg-gray-800">
                  <thead>
                    <tr>
                      <th className="py-3 px-6 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                        Ngày tính
                      </th>
                      <th className="py-3 px-6 text-right text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                        Tổng tiền
                      </th>
                      <th className="py-3 px-6 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                        Người ghi nhận
                      </th>
                      <th className="py-3 px-6 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                        Trạng thái
                      </th>
                      <th className="py-3 px-6 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                        Chi tiết
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                    {billHistory.map((bill) => (
                      <tr
                        key={bill.id}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        <td className="py-3 px-6 text-left whitespace-nowrap">
                          {bill.billDate && bill.billDate instanceof Date
                            ? bill.billDate.toLocaleDateString('vi-VN')
                            : 'N/A'}
                        </td>
                        <td className="py-3 px-6 text-right whitespace-nowrap font-bold text-blue-700 dark:text-blue-300">
                          {bill.totalCost?.toLocaleString('vi-VN') || 0} VND
                        </td>
                        <td className="py-3 px-6 text-center whitespace-nowrap">{bill.recordedBy || 'N/A'}</td>
                        <td className="py-3 px-6 text-center">
                          <input
                            type="checkbox"
                            checked={bill.isPaid || false}
                            onChange={() => handleToggleBillPaidStatus(bill.id, bill.isPaid || false)}
                            className="form-checkbox h-5 w-5 text-green-600 dark:text-green-400 rounded cursor-pointer"
                          />
                          <span
                            className={`ml-2 font-semibold ${bill.isPaid ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                          >
                            {bill.isPaid ? 'Đã trả' : 'Chưa trả'}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-center">
                          <button
                            onClick={() => setSelectedBillDetails(bill)}
                            className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg shadow-sm hover:bg-blue-600 transition-colors"
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
        //Case lịch sử chia tiền điện nước
        case 'costSharingHistory':
        return (
          <div className="p-6 bg-yellow-50 dark:bg-gray-700 rounded-2xl shadow-lg mt-8 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-5">Lịch sử chia tiền</h2>
            {costSharingHistory.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                Chưa có lịch sử chia tiền nào được lưu.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-full bg-white dark:bg-gray-800">
                  <thead>
                    <tr>
                      <th className="py-3 px-6 text-left text-yellow-800 dark:text-yellow-200 uppercase text-sm leading-normal bg-yellow-100 dark:bg-gray-700">
                        Kỳ tính
                      </th>
                      <th className="py-3 px-6 text-right text-yellow-800 dark:text-yellow-200 uppercase text-sm leading-normal bg-yellow-100 dark:bg-gray-700">
                        Tổng ngày có mặt
                      </th>
                      <th className="py-3 px-6 text-right text-yellow-800 dark:text-yellow-200 uppercase text-sm leading-normal bg-yellow-100 dark:bg-gray-700">
                        Quỹ phòng
                      </th>
                      <th className="py-3 px-6 text-center text-yellow-800 dark:text-yellow-200 uppercase text-sm leading-normal bg-yellow-100 dark:bg-gray-700">
                        Chi tiết
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                    {costSharingHistory.map((summary) => (
                      <tr
                        key={summary.id}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        <td className="py-3 px-6 text-left whitespace-nowrap">
                          {summary.periodStart} đến {summary.periodEnd}
                        </td>
                        <td className="py-3 px-6 text-right whitespace-nowrap">
                          {summary.totalCalculatedDaysAllResidents} ngày
                        </td>
                        <td className="py-3 px-6 text-right whitespace-nowrap">
                          <span
                            className={`font-bold ${summary.remainingFund >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}
                          >
                            {summary.remainingFund?.toLocaleString('vi-VN')} VND
                          </span>
                        </td>
                        <td className="py-3 px-6 text-center">
                          <button
                            onClick={() => setSelectedCostSharingDetails(summary)}
                            className="px-3 py-1 bg-yellow-600 text-white text-xs rounded-lg shadow-sm hover:bg-yellow-700 transition-colors"
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
        //Case quản lý lịch trực phòng
        case 'cleaningSchedule':
        return (
          <div className="p-6 bg-purple-50 dark:bg-gray-700 rounded-2xl shadow-lg mt-8 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-200 mb-5">Lịch trực phòng lau dọn</h2>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                value={newCleaningTaskName}
                onChange={(e) => {
                  setNewCleaningTaskName(e.target.value);
                  setAuthError('');
                }}
                className="flex-1 shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
                placeholder="Tên công việc (ví dụ: Lau sàn)"
              />
              <input
                type="date"
                value={newCleaningTaskDate}
                onChange={(e) => {
                  setNewCleaningTaskDate(e.target.value);
                  setAuthError('');
                }}
                className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
              />
              <select
                value={selectedResidentForCleaning}
                onChange={(e) => {
                  setSelectedResidentForCleaning(e.target.value);
                  setAuthError('');
                }}
                className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
              >
                <option value="">-- Chọn người --</option>
                {residents
                  .filter((res) => res.isActive !== false)
                  .map((resident) => (
                    <option key={resident.id} value={resident.id}>
                      {resident.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={handleAddCleaningTask}
                className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-xl shadow-md hover:bg-purple-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
              >
                <i className="fas fa-plus mr-2"></i> Thêm công việc
              </button>
            </div>
            <button
              onClick={() => setShowGenerateScheduleModal(true)} // Nút để mở modal tạo lịch
              className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 transition-all duration-300"
              disabled={residents.filter((res) => res.isActive !== false).length === 0} // Vô hiệu hóa nếu không có cư dân hoạt động
            >
              ✨ Tạo lịch tự động
            </button>
            {cleaningSchedule.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                Chưa có công việc lau dọn nào được lên lịch.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-700">
                <h3 className="text-xl font-semibold text-purple-700 dark:text-purple-200 mb-3">
                  Lịch trực hiện có:
                </h3>
                <ul className="space-y-2">
                  {cleaningSchedule.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {task.name} ({task.assignedToResidentName})
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ngày: {task.date}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={task.isCompleted || false}
                          onChange={() => handleToggleCleaningTaskCompletion(task.id, task.isCompleted || false)}
                          className="form-checkbox h-5 w-5 text-green-600 dark:text-green-400 rounded focus:ring-green-500 cursor-pointer"
                        />
                        <button
                          onClick={() => handleDeleteCleaningTask(task.id, task.name)}
                          className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg shadow-sm hover:bg-red-600 transition-colors"
                        >
                          Xóa
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
        //Case quản lý kệ giày
        case 'shoeRackManagement':
        return (
          <div className="p-6 bg-yellow-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-5">Quản lý kệ giày</h2>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <select
                value={selectedShelfNumber}
                onChange={(e) => {
                  setSelectedShelfNumber(e.target.value);
                  setAuthError('');
                }}
                className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700"
              >
                <option value="">-- Chọn tầng kệ --</option>
                {[...Array(8)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Tầng {i + 1}
                  </option>
                ))}
              </select>
              <select
                value={selectedResidentForShelf}
                onChange={(e) => {
                  setSelectedResidentForShelf(e.target.value);
                  setAuthError('');
                }}
                className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700"
              >
                <option value="">-- Chọn người --</option>
                {residents
                  .filter((res) => res.isActive !== false)
                  .map((resident) => (
                    <option key={resident.id} value={resident.id}>
                      {resident.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={handleAssignShoeRack}
                className="px-6 py-2 bg-yellow-600 text-white font-semibold rounded-xl shadow-md hover:bg-yellow-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-75"
                disabled={!selectedShelfNumber || !selectedResidentForShelf}
              >
                <i className="fas fa-shoe-prints mr-2"></i> Gán kệ
              </button>
            </div>
            {Object.keys(shoeRackAssignments).length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                Chưa có kệ giày nào được gán.
              </p>
            ) : (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-semibold text-yellow-700 dark:text-yellow-200 mb-3">
                  Phân công kệ giày:
                </h3>
                <ul className="space-y-3">
                  {[...Array(8)].map((_, i) => {
                    const shelfNum = i + 1;
                    const assignment = shoeRackAssignments[shelfNum];
                    const isMyShelf =
                      loggedInResidentProfile && assignment && assignment.residentId === loggedInResidentProfile.id;
                    return (
                      <li
                        key={shelfNum}
                        className={`flex items-center justify-between p-3 rounded-lg shadow-sm border ${isMyShelf ? 'bg-yellow-200 dark:bg-yellow-900 border-yellow-400' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}
                      >
                        <span
                          className={`font-medium ${isMyShelf ? 'text-yellow-900 dark:text-yellow-100' : 'text-gray-700 dark:text-gray-300'}`}
                        >
                          Tầng {shelfNum}:
                        </span>
                        {assignment ? (
                          <span
                            className={`font-bold ${isMyShelf ? 'text-yellow-800 dark:text-yellow-200' : 'text-yellow-700 dark:text-yellow-300'}`}
                          >
                            {assignment.residentName}
                            {userRole === 'admin' && ( // Chỉ hiển thị nút xóa cho admin
                              <button
                                onClick={() => handleClearShoeRackAssignment(shelfNum)}
                                className="ml-3 px-2 py-1 bg-red-500 text-white text-xs rounded-lg shadow-sm hover:bg-red-600 transition-colors"
                              >
                                Xóa
                              </button>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 italic">Trống</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
        //Case thông tin của phòng
        case 'commonRoomInfo':
          // Phân quyền hiển thị ngay tại đây
          if (userRole === 'admin') {
            // ===== GIAO DIỆN "THẺ THÀNH VIÊN" CHO ADMIN =====
            return (
              <div className="p-4 md:p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg w-full">
                <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">
                  Thông tin phòng chung
                </h2>
                {residents.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                    Chưa có người ở nào trong danh sách.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {residents.map((resident) => {
                      const linkedUser = allUsersData.find((user) => user.linkedResidentId === resident.id);
                      return (
                        <div key={resident.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 flex flex-col justify-between transition-transform transform hover:scale-105 duration-300">
                          {/* Phần Header của Thẻ */}
                          <div className="flex items-start mb-4">
                            <div className="relative group"> {/* Thêm 'group' để tạo hiệu ứng hover */}
                              {linkedUser?.photoURL ? (
                                <img src={linkedUser.photoURL} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"/>
                              ) : (
                                <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-3xl text-gray-400">
                                  <i className="fas fa-user-circle"></i>
                                </div>
                              )}
                              <span className={`absolute bottom-0 right-0 block h-4 w-4 rounded-full border-2 border-white dark:border-gray-800 ${resident.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                              
                              {/* ===== NÚT THAY ĐỔI AVATAR ĐƯỢC THÊM VÀO ĐÂY ===== */}
                              {linkedUser && (
                                <button 
                                  onClick={() => setSelectedResidentForAvatarUpload(linkedUser)}
                                  className="absolute inset-0 w-16 h-16 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                  title="Thay đổi ảnh đại diện"
                                >
                                  <i className="fas fa-camera text-xl"></i>
                                </button>
                              )}
                            </div>
                            <div className="ml-4">
                              <p className="font-bold text-lg text-gray-900 dark:text-white break-words">{linkedUser?.fullName || resident.name}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{linkedUser?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</p>
                            </div>
                          </div>
                          {/* Phần Thân của Thẻ - Chi tiết */}
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center text-gray-700 dark:text-gray-300">
                              <i className="fas fa-id-badge w-5 text-center mr-2 text-blue-500"></i>
                              <span>{linkedUser?.studentId || 'N/A'}</span>
                            </div>
                            <div className="flex items-center text-gray-700 dark:text-gray-300">
                              <i className="fas fa-envelope w-5 text-center mr-2 text-blue-500"></i>
                              <span>{linkedUser?.email || 'N/A'}</span>
                            </div>
                            <div className="flex items-center text-gray-700 dark:text-gray-300">
                              <i className="fas fa-phone w-5 text-center mr-2 text-blue-500"></i>
                              <span>{linkedUser?.phoneNumber || 'N/A'}</span>
                            </div>
                          </div>
                          {/* Phần Footer của Thẻ - Hành động (Admin) */}
                          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end space-x-2">
                            {linkedUser && linkedUser.role === 'member' && (
                                <button
                                  onClick={() => handleToggleAttendancePermission(linkedUser.id, linkedUser.canTakeAttendance || false)}
                                  className={`px-3 py-1 text-white text-xs rounded-lg shadow-sm ${
                                    linkedUser.canTakeAttendance 
                                    ? 'bg-red-500 hover:bg-red-600' 
                                    : 'bg-green-500 hover:bg-green-600'
                                  }`}
                                  title={linkedUser.canTakeAttendance ? 'Thu hồi quyền điểm danh' : 'Trao quyền điểm danh'}
                                >
                                  <i className="fas fa-tasks"></i>
                                </button>
                            )}
                            <button
                              onClick={() => handleEditCommonResidentDetails(resident)}
                              className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg shadow-sm hover:bg-blue-600"
                              title="Điều chỉnh thông tin"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            {/* NÚT NÂNG CẤP VAI TRÒ */}
                            {linkedUser && linkedUser.role === 'member' && (
                                <button
                                  onClick={() => handleUpgradeToAdmin(linkedUser.id)}
                                  className="px-3 py-1 bg-green-500 text-white text-xs rounded-lg shadow-sm hover:bg-green-600"
                                  title="Nâng cấp vai trò"
                                >
                                  <i className="fas fa-user-shield"></i>
                                </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          } else {
            // ===== GIAO DIỆN BẢNG TRUYỀN THỐNG CHO MEMBER =====
            return (
              <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Thông tin phòng chung</h2>
                {residents.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                    Chưa có người ở nào trong danh sách.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full bg-white dark:bg-gray-800">
                      <thead>
                        <tr>
                          <th className="py-3 px-4 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Avatar</th>
                          <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Họ tên</th>
                          <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Email</th>
                          <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">SĐT</th>
                          <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">MSSV</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                        {residents.map((resident) => {
                          const linkedUser = allUsersData.find((user) => user.linkedResidentId === resident.id);
                          return (
                            <tr key={resident.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                              <td className="py-3 px-4 text-center">
                                {linkedUser?.photoURL ? (
                                  <img src={linkedUser.photoURL} alt="Avatar" className="w-10 h-10 rounded-full object-cover mx-auto"/>
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 text-xl mx-auto">
                                    <i className="fas fa-user-circle"></i>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.fullName || resident.name}</td>
                              <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.email || 'N/A'}</td>
                              <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.phoneNumber || 'N/A'}</td>
                              <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.studentId || 'N/A'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          }
          //Case kỷ niệm    
        case 'roomMemories':
          return (
            <div className="p-6 bg-yellow-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              {/* ===== TIÊU ĐỀ VÀ NÚT BẤM MỚI ===== */}
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">Kỷ niệm phòng</h2>
                <button
                  onClick={() => setShowAddMemoryModal(true)}
                  className="bg-yellow-500 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-yellow-600 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  title="Đăng kỷ niệm mới"
                >
                  <i className="fas fa-plus text-xl"></i>
                </button>
              </div>

              {/* Phần lọc và tìm kiếm */}
              <div className="mb-4 flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0 sm:space-x-4">
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên sự kiện..."
                  value={searchTermMemory}
                  onChange={(e) => setSearchTermMemory(e.target.value)}
                  className="flex-grow shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full sm:w-auto py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
                <select
                  value={filterUploaderMemory}
                  onChange={(e) => setFilterUploaderMemory(e.target.value)}
                  className="shadow-sm border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700"
                >
                  <option value="all">Tất cả người đăng</option>
                  {allUsersData
                    .filter((user) => user.role === 'member' || user.role === 'admin')
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName || user.email}
                      </option>
                    ))}
                </select>
              </div>

              {/* Danh sách kỷ niệm */}
              {memories.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                  Chưa có kỷ niệm nào được thêm.
                </p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {memories.map((memory) => (
                      <div
                        key={memory.id}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-transform transform hover:scale-105 duration-200"
                        onClick={() => setSelectedMemoryDetails(memory)}
                      >
                        <div className="relative aspect-video bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          {memory.files && memory.files.length > 0 ? (
                            <>
                              {memory.files[0].fileType === 'image' ? (
                                <img
                                  src={memory.files[0].fileUrl}
                                  alt={memory.eventName}
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => setSelectedMemoryForLightbox(memory)}
                                />
                              ) : (
                                <video
                                  src={memory.files[0].fileUrl}
                                  controls
                                  className="w-full h-full object-cover"
                                  onClick={() => setSelectedMemoryForLightbox(memory)}
                                />
                              )}
                              {memory.files.length > 1 && (
                                <span className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
                                  {memory.files.length} ảnh/video
                                </span>
                              )}
                            </>
                          ) : (
                            <div className="text-gray-500 dark:text-gray-400">Không có ảnh</div>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-2 truncate">
                            {memory.eventName}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                            Ngày chụp: {memory.photoDate}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                            Đăng bởi:{' '}
                            <span className="font-medium">
                              {memory.uploadedByName ||
                                allUsersData.find((u) => u.id === memory.uploadedBy)?.fullName ||
                                'Người dùng ẩn danh'}
                            </span>
                          </p>
                          {(userRole === 'admin' || userId === memory.uploadedBy) && (
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleEditMemory(memory)}
                                className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors"
                              >
                                Chỉnh sửa
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteMemory(memory.id, memory.files, memory.uploadedBy)
                                }
                                className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors"
                              >
                                Xóa
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pagination Controls */}
              {totalMemoriesCount > itemsPerPageMemories && (
                <div className="flex justify-center items-center space-x-4 mt-8">
                  <button
                    onClick={() => setCurrentPageMemories((prev) => Math.max(1, prev - 1))}
                    disabled={currentPageMemories === 1}
                    className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Trang trước
                  </button>
                  <span className="text-gray-800 dark:text-gray-200 font-medium">
                    Trang {currentPageMemories} / {totalPagesMemories}
                  </span>
                  <button
                    onClick={() => setCurrentPageMemories((prev) => Math.min(totalPagesMemories, prev + 1))}
                    disabled={currentPageMemories === totalPagesMemories}
                    className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Trang sau
                  </button>
                </div>
              )}

              {/* POPUP ĐĂNG KỶ NIỆM MỚI */}
              {showAddMemoryModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">
                      Đăng Kỷ niệm mới
                    </h3>
                    <form onSubmit={handleAddMemory} className="space-y-4">
                      <div>
                        <label htmlFor="eventName" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                          Tên sự kiện:
                        </label>
                        <input
                          type="text"
                          id="eventName"
                          value={newMemoryEventName}
                          onChange={(e) => setNewMemoryEventName(e.target.value)}
                          className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700"
                          placeholder="Ví dụ: Sinh nhật Duy, Chuyến đi Vũng Tàu"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="photoDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                          Ngày chụp/quay:
                        </label>
                        <input
                          type="date"
                          id="photoDate"
                          value={newMemoryPhotoDate}
                          onChange={(e) => setNewMemoryPhotoDate(e.target.value)}
                          className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="memoryImageFile" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                          Chọn ảnh/video:
                        </label>
                        <input
                          type="file"
                          id="memoryImageFile"
                          accept="image/*,video/*"
                          multiple
                          onChange={(e) => setNewMemoryImageFile(Array.from(e.target.files))}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                          required
                        />
                        {isUploadingMemory && (
                          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                            <div className="bg-yellow-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                        )}
                        {uploadProgress > 0 && uploadProgress < 100 && (
                          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 text-right">{uploadProgress}% tải lên</p>
                        )}
                      </div>
                      {memoryError && <p className="text-red-500 text-sm text-center mt-4">{memoryError}</p>}
                      <div className="flex space-x-4 mt-6">
                          <button
                            type="button"
                            onClick={() => setShowAddMemoryModal(false)}
                            className="w-1/2 px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-300"
                          >
                            Hủy
                          </button>
                          <button
                            type="submit"
                            className="w-1/2 px-6 py-3 bg-yellow-600 text-white font-semibold rounded-xl shadow-md hover:bg-yellow-700 transition-all duration-300"
                            disabled={isUploadingMemory}
                          >
                            {isUploadingMemory ? <i className="fas fa-spinner fa-spin"></i> : 'Đăng'}
                          </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          );
          //Case thông tin tiền bối         
        case 'formerResidents':
            const filteredFormerResidents = formerResidents.filter(resident =>
              (resident.name?.toLowerCase().includes(searchTermFormerResident.toLowerCase())) ||
              (resident.studentId?.toLowerCase().includes(searchTermFormerResident.toLowerCase()))
            );
            return (
              <div className="p-6 bg-purple-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
                {/* ===== TIÊU ĐỀ VÀ NÚT BẤM MỚI ===== */}
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-200">Thông tin Tiền bối</h2>
                  {userRole === 'admin' && (
                    <button
                      onClick={() => setShowAddFormerResidentModal(true)}
                      className="bg-purple-500 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-purple-600 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                      title="Thêm tiền bối mới"
                    >
                      <i className="fas fa-user-plus text-xl"></i>
                    </button>
                  )}
                </div>

                {/* Phần tìm kiếm (giữ nguyên) */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Tìm kiếm theo tên hoặc MSSV..."
                    value={searchTermFormerResident}
                    onChange={(e) => setSearchTermFormerResident(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>

                {/* Danh sách tiền bối */}
                <div className="space-y-4">
                  {filteredFormerResidents.map((resident) => (
                    <div key={resident.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex justify-between items-center">
                      <div className="flex items-center">
                        {/* Avatar */}
                        <div className="flex-shrink-0 mr-4">
                          {resident.photoURL ? (
                            <img
                              src={resident.photoURL}
                              alt={`Avatar của ${resident.name}`}
                              className="w-16 h-16 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 text-3xl">
                              <i className="fas fa-user-circle"></i>
                            </div>
                          )}
                        </div>
                        {/* Thông tin chữ */}
                        <div>
                          <p className="font-bold text-gray-800 dark:text-white">{resident.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">MSSV: {resident.studentId}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Liên hệ: {resident.contact}</p>
                          {resident.notes && <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">Ghi chú: {resident.notes}</p>}
                        </div>
                      </div>
                      {userRole === 'admin' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditFormerResident (resident)}
                            className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteFormerResident(resident.id)}
                            className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600"
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* ===== POPUP THÊM TIỀN BỐI MỚI ===== */}
                {showAddFormerResidentModal && (
                  <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
                      <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">
                        Thêm Tiền bối
                      </h3>
                      <form onSubmit={handleAddFormerResidentManually} className="space-y-4">
                        <div>
                          <label htmlFor="formerResidentName" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                            Họ tên:
                          </label>
                          <input
                            type="text"
                            id="formerResidentName"
                            value={newFormerResidentName}
                            onChange={(e) => setNewFormerResidentName(e.target.value)}
                            className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="formerResidentStudentId" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                            Mã số sinh viên:
                          </label>
                          <input
                            type="text"
                            id="formerResidentStudentId"
                            value={newFormerResidentStudentId}
                            onChange={(e) => setNewFormerResidentStudentId(e.target.value)}
                            className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="formerResidentContact" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                            Thông tin liên hệ:
                          </label>
                          <input
                            type="text"
                            id="formerResidentContact"
                            value={newFormerResidentContact}
                            onChange={(e) => setNewFormerResidentContact(e.target.value)}
                            className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700"
                            placeholder="SĐT, Facebook, Zalo..."
                          />
                        </div>
                        <div>
                          <label htmlFor="formerResidentNotes" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                            Ghi chú:
                          </label>
                          <textarea
                            id="formerResidentNotes"
                            value={newFormerResidentNotes}
                            onChange={(e) => setNewFormerResidentNotes(e.target.value)}
                            className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700"
                            rows="3"
                            placeholder="Ví dụ: Khóa, chuyên ngành, công ty hiện tại..."
                          ></textarea>
                        </div>
                        <div>
                          <label htmlFor="formerResidentAvatar" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                            Chọn avatar:
                          </label>
                          <input
                            type="file"
                            id="formerResidentAvatar"
                            accept="image/*"
                            onChange={(e) => setNewFormerResidentAvatarFile(e.target.files && e.target.files.length > 0 ? e.target.files : null)}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                          />
                          {isUploadingFormerResidentAvatar && (
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                              <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${uploadFormerResidentAvatarProgress}%` }}></div>
                            </div>
                          )}
                          {uploadFormerResidentAvatarProgress > 0 && uploadFormerResidentAvatarProgress < 100 && (
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 text-right">{uploadFormerResidentAvatarProgress}% tải lên</p>
                          )}
                        </div>
                        <div className="flex space-x-4 mt-6">
                          <button
                            type="button"
                            onClick={() => setShowAddFormerResidentModal(false)}
                            className="w-1/2 px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400"
                          >
                            Hủy
                          </button>
                          <button
                            type="submit"
                            className="w-1/2 px-6 py-3 bg-purple-600 text-white font-semibold rounded-xl shadow-md hover:bg-purple-700"
                          >
                            Thêm
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            );
        //Case thiết kế thông báo
        case 'customNotificationDesign':
          return (
            <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              {/* ===== TIÊU ĐỀ VÀ NÚT BẤM MỚI ===== */}
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200">Quản lý Thông báo</h2>
                <button
                  onClick={() => setShowAddNotificationModal(true)}
                  className="bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-blue-600 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  title="Soạn thông báo mới"
                >
                  <i className="fas fa-plus text-xl"></i>
                </button>
              </div>

              {/* ===== DANH SÁCH THÔNG BÁO ĐÃ GỬI/NHẬN (ĐÃ SỬA LẠI) ===== */}
              <div className="mt-8 pt-6 border-t border-gray-300 dark:border-gray-600">
                <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-5">
                  Danh sách thông báo đã gửi/nhận
                </h3>
                {notificationError && <p className="text-red-500 text-sm text-center mb-4">{notificationError}</p>}
                {notifications.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có thông báo nào.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full bg-white dark:bg-gray-800">
                      <thead>
                        <tr>
                          <th className="py-3 px-4 text-left ...">Nội dung tóm tắt</th>
                          <th className="py-3 px-4 text-left ...">Loại</th>
                          <th className="py-3 px-4 text-left ...">Người nhận</th>
                          <th className="py-3 px-4 text-left ...">Thời gian</th>
                          <th className="py-3 px-4 text-center ...">Trạng thái</th>
                          <th className="py-3 px-4 text-center ...">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                        {notifications.map((notification) => (
                          <tr key={notification.id} className={`border-b ... ${!notification.isRead ? 'font-semibold' : ''}`}>
                            <td className="py-3 px-4 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">{notification.message}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{notification.type}</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {notification.recipientId === 'all'
                                ? 'Tất cả'
                                : allUsersData.find((u) => u.id === notification.recipientId)?.fullName || 'N/A'}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {notification.createdAt instanceof Date
                                ? notification.createdAt.toLocaleDateString('vi-VN')
                                : 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs ...`}>
                                {notification.isRead ? 'Đã đọc' : 'Chưa đọc'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => deleteNotification(notification.id)}
                                className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg shadow-sm hover:bg-red-600"
                              >
                                Xóa
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ===== POPUP SOẠN THÔNG BÁO MỚI ===== */}
              {showAddNotificationModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg">
                    <h3 className="text-2xl font-bold text-blue-700 dark:text-blue-200 mb-4 text-center">Soạn thông báo mới</h3>
                    <form onSubmit={handleSendCustomNotification} className="space-y-4">
                      {/* Tiêu đề thông báo */}
                      <div>
                        <label htmlFor="notificationTitle" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Tiêu đề (Tùy chọn):</label>
                        <input
                          type="text"
                          id="notificationTitle"
                          value={newNotificationTitle}
                          onChange={(e) => setNewNotificationTitle(e.target.value)}
                          className="shadow-sm appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Ví dụ: Thông báo khẩn về tiền điện"
                        />
                      </div>

                      {/* Người nhận */}
                      <div>
                        <label htmlFor="notificationRecipient" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Gửi đến:</label>
                        <select
                          id="notificationRecipient"
                          value={newNotificationRecipient}
                          onChange={(e) => setNewNotificationRecipient(e.target.value)}
                          className="shadow-sm appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="all">Tất cả thành viên</option>
                          {residents.filter(res => res.isActive).map(resident => {
                            const linkedUser = allUsersData.find(user => user.linkedResidentId === resident.id);
                            if (linkedUser) {
                              return <option key={linkedUser.id} value={linkedUser.id}>{linkedUser.fullName || resident.name}</option>;
                            }
                            return null;
                          })}
                        </select>
                      </div>

                      {/* Nội dung thông báo */}
                      <div>
                        <label htmlFor="notificationMessage" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Nội dung thông báo:</label>
                        <textarea
                          id="notificationMessage"
                          value={newNotificationMessage}
                          onChange={(e) => setNewNotificationMessage(e.target.value)}
                          rows="5"
                          className="shadow-sm appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500 resize-y"
                          placeholder="Nhập nội dung thông báo..."
                        ></textarea>
                      </div>

                      {customNotificationError && <p className="text-red-500 text-sm text-center mt-4">{customNotificationError}</p>}
                      {customNotificationSuccess && <p className="text-green-600 text-sm text-center mt-4">{customNotificationSuccess}</p>}
                      
                      <div className="flex space-x-4 mt-6">
                          <button
                            type="button"
                            onClick={() => setShowAddNotificationModal(false)}
                            className="w-1/2 px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400"
                          >
                            Hủy
                          </button>
                          <button
                            type="submit"
                            className="w-1/2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700"
                          >
                            <i className="fas fa-paper-plane mr-2"></i> Gửi
                          </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          );
        //Case chỉnh sửa thông tin cá nhân admin
        case 'myProfileDetails':
          return (
            <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Hồ sơ của tôi</h2>
              <div className="space-y-4">
                {/* Các trường thông tin cá nhân */}
                <div>
                  <label
                    htmlFor="editFullName"
                    className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                  >
                    Họ tên đầy đủ:
                  </label>
                  <input
                    type="text"
                    id="editFullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="editPhoneNumber"
                    className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                  >
                    Số điện thoại:
                  </label>
                  <input
                    type="text"
                    id="editPhoneNumber"
                    value={memberPhoneNumber}
                    onChange={(e) => setMemberPhoneNumber(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="editStudentId"
                    className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                  >
                    Mã số sinh viên:
                  </label>
                  <input
                    type="text"
                    id="editStudentId"
                    value={memberStudentId}
                    onChange={(e) => setMemberStudentId(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="editBirthday"
                    className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                  >
                    Ngày sinh:
                  </label>
                  <input
                    type="date"
                    id="editBirthday"
                    value={memberBirthday}
                    onChange={(e) => setMemberBirthday(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="editDormEntryDate"
                    className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                  >
                    Ngày nhập KTX:
                  </label>
                  <input
                    type="date"
                    id="editDormEntryDate"
                    value={memberDormEntryDate}
                    onChange={(e) => setMemberDormEntryDate(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="editAcademicLevel"
                    className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                  >
                    Email trường:
                  </label>
                  <input
                    type="text"
                    id="editAcademicLevel"
                    value={memberAcademicLevel}
                    onChange={(e) => setMemberAcademicLevel(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>

                {/* Phần tải ảnh đại diện */}
                <div className="mt-8 pt-6 border-t border-gray-300 dark:border-gray-600">
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Ảnh đại diện</h3>
                  <div className="flex items-center space-x-4 mb-4">
                    {userAvatarUrl ? (
                      <img
                        src={userAvatarUrl}
                        alt="Avatar"
                        className="w-24 h-24 rounded-full object-cover shadow-lg border-2 border-gray-200 dark:border-gray-700"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 text-5xl">
                        <i className="fas fa-user-circle"></i>
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          setNewAvatarFile(e.target.files[0]);
                          setAvatarError('');
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {isUploadingAvatar && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full"
                            style={{ width: `${avatarUploadProgress}%` }}
                          ></div>
                        </div>
                      )}
                      {avatarError && <p className="text-red-500 text-sm mt-2">{avatarError}</p>}
                      <button
                        onClick={handleUploadMyAvatar}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
                        disabled={isUploadingAvatar || !newAvatarFile}
                      >
                        {isUploadingAvatar ? (
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                        ) : (
                          <i className="fas fa-upload mr-2"></i>
                        )}
                        Tải ảnh đại diện
                      </button>
                    </div>
                  </div>
                </div>

                {authError && <p className="text-red-500 text-sm text-center mt-4">{authError}</p>}
                <button
                  onClick={handleSaveUserProfile}
                  className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
                >
                  <i className="fas fa-save mr-2"></i> Lưu thông tin
                </button>
              </div>
            </div>
          );
        //Case đổi mật khẩu
        case 'passwordSettings':
          return (
            <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Đổi mật khẩu</h2>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="oldPassword"
                    className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                  >
                    Mật khẩu cũ:
                  </label>
                  <input
                    type="password"
                    id="oldPassword"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    placeholder="Nhập mật khẩu cũ"
                  />
                </div>
                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                  >
                    Mật khẩu mới:
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirmNewPassword"
                    className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                  >
                    Xác nhận mật khẩu mới:
                  </label>
                  <input
                    type="password"
                    id="confirmNewPassword"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    placeholder="Xác nhận mật khẩu mới"
                  />
                </div>
                {passwordChangeMessage && (
                  <p
                    className={`text-sm text-center mt-4 ${passwordChangeMessage.includes('thành công') ? 'text-green-600' : 'text-red-500'}`}
                  >
                    {passwordChangeMessage}
                  </p>
                )}
                <button
                  onClick={handleChangePassword}
                  className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-xl shadow-md hover:bg-red-700 transition-all duration-300"
                >
                  <i className="fas fa-key mr-2"></i> Đổi mật khẩu
                </button>
              </div>
            </div>
          );
        //Case admin tạo tài khoản
        case 'adminCreateAccount':
              return (
                  <div className="p-6 bg-purple-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
                      <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-200 mb-5">
                          Tạo tài khoản mới cho Thành viên
                      </h2>
                      <div className="space-y-4">
                          <div>
                              <label htmlFor="newAccFullName" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                                  Họ tên đầy đủ:
                              </label>
                              <input
                                  type="text"
                                  id="newAccFullName"
                                  value={newAccountFullName}
                                  onChange={(e) => setNewAccountFullName(e.target.value)}
                                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
                                  placeholder="Họ tên đầy đủ của thành viên"
                              />
                          </div>
                          <div>
                              <label htmlFor="newAccStudentId" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                                  Mã số sinh viên:
                              </label>
                              <input
                                  type="text"
                                  id="newAccStudentId"
                                  value={newAccountStudentId}
                                  onChange={(e) => setNewAccountStudentId(e.target.value)}
                                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
                                  placeholder="MSSV (dùng làm tên đăng nhập)"
                              />
                          </div>
                          <div>
                              <label htmlFor="newAccPersonalEmail" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                                  Email cá nhân (Tùy chọn ban đầu):
                              </label>
                              <input
                                  type="email"
                                  id="newAccPersonalEmail"
                                  value={newAccountPersonalEmail}
                                  onChange={(e) => setNewAccountPersonalEmail(e.target.value)}
                                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
                                  placeholder="Email cá nhân (Nếu có, để xác minh)"
                              />
                          </div>
                          <div>
                              <label htmlFor="newAccPassword" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                                  Mật khẩu:
                              </label>
                              <input
                                  type="password"
                                  id="newAccPassword"
                                  value={newAccountPassword}
                                  onChange={(e) => setNewAccountPassword(e.target.value)}
                                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
                                  placeholder="Mật khẩu (ít nhất 6 ký tự)"
                              />
                          </div>
                          {authError && <p className="text-red-500 text-sm text-center mt-4">{authError}</p>}
                          <button
                              onClick={handleAdminCreateAccount}
                              className="w-full px-6 py-3 bg-purple-600 text-white font-semibold rounded-xl shadow-md hover:bg-purple-700 transition-all duration-300"
                          >
                              <i className="fas fa-user-plus mr-2"></i> Tạo tài khoản
                          </button>
                      </div>
                  </div>
              );
        //Case thống kê tiêu thụ
        case 'consumptionStats':
  return (
    <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200">
          Thống kê tiêu thụ
        </h2>
        {/* Nút chuyển đổi biểu đồ */}
        <div className="flex items-center bg-gray-200 dark:bg-gray-800 rounded-lg p-1 space-x-1 mt-3 sm:mt-0">
          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
              chartType === 'line' ? 'bg-white dark:bg-gray-600 text-blue-600 shadow' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <i className="fas fa-chart-line mr-2"></i>Đường
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
              chartType === 'bar' ? 'bg-white dark:bg-gray-600 text-blue-600 shadow' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <i className="fas fa-chart-bar mr-2"></i>Cột
          </button>
        </div>
      </div>

      {/* Kiểm tra dữ liệu một lần duy nhất */}
      {Object.keys(monthlyConsumptionStats).length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
          Chưa có dữ liệu thống kê nào. Vui lòng tính toán hóa đơn trước.
        </p>
      ) : (
        // Nếu có dữ liệu, hiển thị cả biểu đồ và bảng
        <>
          {/* Biểu đồ */}
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="điện" stroke="#8884d8" name="Điện (KW)" />
                  <Line type="monotone" dataKey="nước" stroke="#82ca9d" name="Nước (m³)" />
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="điện" fill="#8884d8" name="Điện (KW)" />
                  <Bar dataKey="nước" fill="#82ca9d" name="Nước (m³)" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Bảng dữ liệu chi tiết */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full bg-white dark:bg-gray-800">
              <thead>
                <tr>
                  <th className="py-3 px-6 text-left ...">Tháng</th>
                  <th className="py-3 px-6 text-right ...">Điện (KW)</th>
                  <th className="py-3 px-6 text-right ...">Nước (m³)</th>
                  <th className="py-3 px-6 text-right ...">Tổng tiền (VND)</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                {Object.entries(monthlyConsumptionStats).map(([month, stats]) => (
                  <tr key={month} className="border-b ...">
                    <td className="py-3 px-6 text-left">{month}</td>
                    <td className="py-3 px-6 text-right">{stats.electricity.toLocaleString('vi-VN')}</td>
                    <td className="py-3 px-6 text-right">{stats.water.toLocaleString('vi-VN')}</td>
                    <td className="py-3 px-6 text-right font-bold ...">{stats.total.toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
        // Case gửi góp ý
        case 'feedback':
        // Giao diện cho Admin: Xem tất cả góp ý
        if (userRole === 'admin') {
          return (
            // Container chính, bỏ các style riêng để dùng chung layout
            <div className="p-4 md:p-6">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                Hộp thư góp ý
              </h2>
              {allFeedback.length > 0 ? (
                // Sử dụng grid layout để hiển thị các thẻ góp ý
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allFeedback.map(fb => (
                    <div
                      key={fb.id}
                      // CSS cho thẻ góp ý, đồng bộ với các thẻ khác và thêm hiệu ứng
                      className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                      onClick={() => setSelectedFeedbackDetails(fb)}
                    >
                      <div>
                        {/* Nội dung góp ý, giới hạn 3 dòng để không làm vỡ layout */}
                        <p className="text-gray-700 dark:text-gray-300 line-clamp-3">
                          {fb.content}
                        </p>
                      </div>
                      {/* Thông tin người gửi ở dưới cùng */}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Gửi bởi: <span className="font-medium text-gray-600 dark:text-gray-300">{fb.submittedByName}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Ngày: {fb.submittedAt?.toDate().toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Giao diện khi không có góp ý nào
                <div className="flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-xl shadow-md">
                  <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                  <p className="text-gray-500 dark:text-gray-400 italic text-center mt-4">
                    Chưa có góp ý nào trong hộp thư.
                  </p>
                </div>
              )}
            </div>
          );
        }
        // Case kiểm tra lượt đăng nhập
        case 'loginHistory':
          return (
            <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-5">Lịch sử đăng nhập</h2>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {loginHistory.length > 0 ? (
                  loginHistory.map(log => (
                    <div key={log.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {log.userName}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Thời gian: {log.loginAt?.toDate().toLocaleString('vi-VN')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate" title={log.userAgent}>
                        Thiết bị: {log.userAgent}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic text-center">Chưa có lịch sử đăng nhập nào.</p>
                )}
              </div>
            </div>
          );
        default:
        return (
          <div className="text-center p-8 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner">
            <p className="text-xl text-gray-700 dark:text-gray-300 font-semibold mb-4">
              Chào mừng Admin! Vui lòng chọn một mục từ thanh điều hướng.
            </p>
          </div>
        );
      }
    }
    // Logic cho Thành viên
    if (userRole === 'member') {
      // Lọc các nhiệm vụ trực phòng sắp tới của riêng thành viên
      const upcomingMyCleaningTasks = cleaningSchedule
        .filter(
          (task) =>
            loggedInResidentProfile &&
            !task.isCompleted &&
            task.assignedToResidentId === loggedInResidentProfile.id &&
            new Date(task.date) >= new Date(),
        )
        .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sắp xếp theo ngày tăng dần

      // Lấy chi phí cá nhân gần nhất của thành viên
      const myLatestCost =
        costSharingHistory.length > 0 && loggedInResidentProfile
          ? costSharingHistory[0].individualCosts?.[loggedInResidentProfile.id]?.cost || 0
          : 0;
      const myLatestCostIsPaid =
        costSharingHistory.length > 0 && loggedInResidentProfile
          ? costSharingHistory[0].individualCosts?.[loggedInResidentProfile.id]?.isPaid || false
          : false;
      const myLatestCostPeriod =
        costSharingHistory.length > 0
          ? `${costSharingHistory[0].periodStart} - ${costSharingHistory[0].periodEnd}`
          : 'N/A';
      switch (activeSection) {
        //Case trang chủ của thành viên
        case 'dashboard':
          return (
            <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-5">Dashboard Tổng quan</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Widget: Thông báo chưa đọc */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col items-center justify-center">
                  <i className="fas fa-bell text-4xl text-yellow-500 mb-3"></i>
                  <p className="text-lg text-gray-700 dark:text-gray-300">Thông báo chưa đọc</p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-300">{unreadNotificationsCount}</p>
                </div>

                {/* Widget: Chi phí cần đóng gần nhất */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col items-center justify-center">
                  <i className="fas fa-money-bill-wave text-4xl text-orange-500 mb-3"></i>
                  <p className="text-lg text-gray-700 dark:text-gray-300">Tiền cần đóng</p>
                  <p
                    className={`text-3xl font-bold ${myLatestCostIsPaid ? 'text-green-600' : 'text-red-500'} dark:text-green-300`}
                  >
                    {myLatestCost.toLocaleString('vi-VN')} VND
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {myLatestCostIsPaid ? 'Đã đóng' : `Chưa đóng (Kỳ: ${myLatestCostPeriod})`}
                  </p>
                </div>

                {/* Widget: Nhiệm vụ trực phòng sắp tới của tôi */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md col-span-full">
                  <h3 className="text-xl font-bold text-purple-700 dark:text-purple-200 mb-3">
                    Nhiệm vụ trực phòng sắp tới
                  </h3>
                  {upcomingMyCleaningTasks.length > 0 ? (
                    <ul className="space-y-2">
                      {upcomingMyCleaningTasks.slice(0, 3).map(
                        (
                          task, // Chỉ hiển thị 3 nhiệm vụ đầu
                        ) => (
                          <li key={task.id} className="text-gray-700 dark:text-gray-300">
                            <i className="fas fa-check-circle mr-2 text-purple-500"></i>
                            {task.name} vào ngày {task.date}
                          </li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 italic">Bạn không có nhiệm vụ trực phòng sắp tới.</p>
                  )}
                </div>

                {/* Widget: Tổng số ngày có mặt của tôi trong tháng này */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md col-span-full">
                  <h3 className="text-xl font-bold text-green-700 dark:text-green-200 mb-3">
                    Điểm danh tháng này ({selectedMonth})
                  </h3>
                  {loggedInResidentProfile && monthlyAttendanceData[loggedInResidentProfile.id] ? (
                    <p className="text-gray-700 dark:text-gray-300 text-lg">
                      Bạn đã có mặt:{' '}
                      <span className="font-bold text-green-600">
                        {
                          Object.values(monthlyAttendanceData[loggedInResidentProfile.id]).filter(
                            (status) => status === 1,
                          ).length
                        }
                      </span>{' '}
                      / {daysInSelectedMonth} ngày
                    </p>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 italic">Chưa có dữ liệu điểm danh tháng này.</p>
                  )}
                </div>
              </div>
            </div>
          );
        //Case điểm danh của thành viên (cho chính mình và người khác (nếu được ủy quyền))
        case 'attendanceTracking':{
          const currentUserData = allUsersData.find(u => u.id === userId);
          const memberCanTakeAttendance = currentUserData?.canTakeAttendance === true;
          return (
            <div className="p-6 bg-green-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-5">
                {userRole === 'admin' ? 'Điểm danh theo tháng' : 'Điểm danh của tôi'}
              </h2>
              <div className="mb-6 flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <label htmlFor="monthSelector" className="font-semibold text-gray-700 dark:text-gray-300 text-lg">
                  Chọn tháng:
                </label>
                <input
                  type="month"
                  id="monthSelector"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>

              {/* ===== KHUNG CHỨA CÓ THANH CUỘN NGANG ===== */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                {displayedResidents.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                    Chưa có người ở nào để điểm danh.
                  </p>
                ) : (
                  <table className="min-w-full bg-white dark:bg-gray-800">
                    <thead>
                      <tr>
                        <th className="py-3 px-4 text-left sticky left-0 z-10 bg-green-100 dark:bg-gray-700 border-r border-green-200 dark:border-gray-600 text-green-800 dark:text-green-200 uppercase text-sm font-semibold">
                          Tên
                        </th>
                        {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((day) => (
                          <th
                            key={day}
                            className="py-3 px-2 text-center border-l border-green-200 dark:border-gray-600 text-green-800 dark:text-green-200 uppercase text-sm leading-normal"
                          >
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                      {displayedResidents.map((resident) => {
                        const isMyRow = loggedInResidentProfile && resident.id === loggedInResidentProfile.id;
                        return (
                          <tr
                            key={resident.id}
                            className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                          >
                            <td className="py-3 px-6 text-left whitespace-nowrap font-medium sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-700">
                              {resident.name}
                            </td>
                            {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((day) => {
                              const dayString = String(day).padStart(2, '0');
                              const isPresent = monthlyAttendanceData[resident.id]?.[dayString] === 1;
                              return (
                                <td
                                  key={day}
                                  className="py-3 px-2 text-center border-l border-gray-200 dark:border-gray-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isPresent}
                                    onChange={() => handleToggleDailyPresence(resident.id, day)}
                                    disabled={!isMyRow && !memberCanTakeAttendance} 
                                    className=" form-checkbox h-5 w-5 rounded focus:ring-green-500 cursor-pointer 
                                                text-green-600 
                                                disabled:checked:bg-red-500 
                                                dark:text-green-400 
                                                dark:disabled:bg-slate-700 
                                                dark:disabled:checked:bg-yellow-600 
                                                dark:disabled:checked:border-transparent"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ); 
        }       
        //Xem tiền điện nước cần đóng và thanh toán
        case 'memberCostSummary':
          const latestCostSharingRecord = costSharingHistory[0];
          return (
            <div className="p-6 bg-orange-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-orange-800 dark:text-orange-200 mb-5">Chi phí của tôi</h2>
              {!loggedInResidentProfile ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                  Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.
                </p>
              ) : !latestCostSharingRecord ||
                !latestCostSharingRecord.individualCosts ||
                !latestCostSharingRecord.individualCosts[loggedInResidentProfile.id] ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                  Chưa có thông tin chi phí nào cho bạn.
                </p>
              ) : (
                <div>
                  {/* Khối hiển thị thông tin chi phí */}
                  <div className="bg-orange-100 dark:bg-gray-800 p-6 rounded-xl shadow-inner text-lg font-semibold text-orange-900 dark:text-orange-100 border border-orange-200 dark:border-gray-600">
                    {/* ... (Phần hiển thị Kỳ tính, Số ngày, Số tiền, Trạng thái) ... */}
                    <p className="mb-2"><strong>Kỳ tính:</strong> {latestCostSharingRecord.periodStart} đến {latestCostSharingRecord.periodEnd}</p>
                    <p className="mb-2"><strong>Số ngày có mặt:</strong> {latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]?.daysPresent || 0} ngày</p>
                    <p className="mb-2 text-xl font-bold border-t pt-3 mt-3 border-orange-300 dark:border-gray-600">
                      Số tiền cần đóng:{' '}
                      <span className="text-orange-800 dark:text-orange-200">
                        {(latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]?.cost || 0).toLocaleString('vi-VN')} VND
                      </span>
                    </p>
                    <p className="text-lg font-bold">Trạng thái:{' '}
                        <span className={ latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]?.isPaid ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400' }>
                            {latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]?.isPaid ? 'Đã đóng' : 'Chưa đóng'}
                        </span>
                    </p>
                    {!latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]?.isPaid && (
                      <button
                        onClick={handleMarkMyPaymentAsPaid}
                        className="w-full mt-4 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700"
                      >
                        <i className="fas fa-check-circle mr-2"></i> Đánh dấu đã đóng
                      </button>
                    )}
                  </div>
                  {/* Nút hiển thị mã QR để thanh toán */}
                  {qrCodeUrl && (
                    <button
                      onClick={() => setShowQrCodeModal(true)}
                      className="w-full mt-4 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl shadow-md hover:bg-green-700 transition-all"
                    >
                      <i className="fas fa-qrcode mr-2"></i>
                      Thanh toán bằng mã QR
                    </button>
                  )}
                  {/* ===== POPUP HIỂN THỊ QR (PHIÊN BẢN GỐC) ===== */}
                  {showQrCodeModal && latestCostSharingRecord && loggedInResidentProfile && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowQrCodeModal(false)}>
                      {(() => {
                        // --- Logic tạo URL VietQR (giữ nguyên) ---
                        const amountToPay = latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]?.cost || 0;
                        const bankId = "970415"; // Vietinbank
                        const accountNumber = "101877135020";
                        const accountName = "NGUYEN HUYNH PHUC KHANG";
                        const billPeriod = latestCostSharingRecord.periodStart || new Date().toISOString().slice(0, 7);
                        const billMonth = billPeriod.split('-')[1];
                        const billYear = billPeriod.split('-')[0];
                        const description = `CK ${fullName.split(' ').slice(-1).join('')} KTX T${billMonth}-${billYear}`;
                        const vietQR_imageUrl = `https://img.vietqr.io/image/${bankId}-${accountNumber}-print.png?amount=${amountToPay}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`;

                        return (
                          <div className="bg-white p-6 rounded-lg text-center" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-xl font-bold mb-2">Quét mã để thanh toán</h3>
                            <p className="text-gray-700 mb-4">
                              Số tiền cần thanh toán: <strong className="text-red-600">{amountToPay.toLocaleString('vi-VN')} VND</strong>
                            </p>

                            <div className="p-2 border rounded-lg inline-block">
                              <img 
                                src={vietQR_imageUrl} 
                                alt="VietQR Code"
                                width="256"
                                height="256"
                              />
                            </div>

                            <button onClick={() => setShowQrCodeModal(false)} className="w-full mt-4 p-2 bg-gray-200 rounded-lg hover:bg-gray-300">
                              Đóng
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        //Xem lịch trực của thành viên
        case 'memberCleaningSchedule':
          // Hiển thị lịch trực nhưng chỉ những nhiệm vụ được giao cho thành viên đó
          const myCleaningTasks = cleaningSchedule.filter(
            (task) => loggedInResidentProfile && task.assignedToResidentId === loggedInResidentProfile.id,
          );
          return (
            <div className="p-6 bg-purple-50 dark:bg-gray-700 rounded-2xl shadow-lg mt-8 max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-200 mb-5">Lịch trực của tôi</h2>
              {!loggedInResidentProfile ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                  Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.
                </p>
              ) : myCleaningTasks.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                  Bạn chưa có công việc lau dọn nào được giao.
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-700">
                  <ul className="space-y-2">
                    {myCleaningTasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{task.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ngày: {task.date}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`ml-2 text-sm font-semibold ${task.isCompleted ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                          >
                            {task.isCompleted ? 'Đã hoàn thành' : 'Chưa hoàn thành'}
                          </span>
                          {/* Thành viên chỉ xem, không được chỉnh sửa trạng thái trực tiếp */}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        //Xem kệ giày của thành viên
        case 'shoeRackManagement':
          return (
            <div className="p-6 bg-yellow-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-5">Thông tin kệ giày</h2>
              {!loggedInResidentProfile ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                  Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.
                </p>
              ) : (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-yellow-700 dark:text-yellow-200 mb-3">
                    Phân công kệ giày của bạn:
                  </h3>
                  <ul className="space-y-3">
                    {[...Array(8)].map((_, i) => {
                      const shelfNum = i + 1;
                      const assignment = shoeRackAssignments[shelfNum];
                      const isMyShelf =
                        loggedInResidentProfile && assignment && assignment.residentId === loggedInResidentProfile.id;
                      return (
                        <li
                          key={shelfNum}
                          className={`flex items-center justify-between p-3 rounded-lg shadow-sm border ${isMyShelf ? 'bg-yellow-200 dark:bg-yellow-900 border-yellow-400' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}
                        >
                          <span
                            className={`font-medium ${isMyShelf ? 'text-yellow-900 dark:text-yellow-100' : 'text-gray-700 dark:text-gray-300'}`}
                          >
                            Tầng {shelfNum}:
                          </span>
                          {isMyShelf ? (
                            <span
                              className={`font-bold ${isMyShelf ? 'text-yellow-800 dark:text-yellow-200' : 'text-yellow-700 dark:text-yellow-300'}`}
                            >
                              {assignment.residentName} (Kệ của bạn)
                            </span>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400 italic">Trống / Người khác</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        //Xem thông tin của phòng
        case 'commonRoomInfo':
          return (
            <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Thông tin phòng chung</h2>
              {residents.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                  Chưa có người ở nào trong danh sách.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full bg-white dark:bg-gray-800">
                    <thead>
                      <tr>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          Họ tên
                        </th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          Email
                        </th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          SĐT
                        </th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          MSSV
                        </th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          Ngày sinh
                        </th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          Ngày nhập KTX
                        </th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          Email trường
                        </th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          Trạng thái
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                      {residents.map((resident) => {
                        const linkedUser = allUsersData.find((user) => user.linkedResidentId === resident.id);
                        return (
                          <tr
                            key={resident.id}
                            className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                          >
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.fullName || resident.name}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.email || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.phoneNumber || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.studentId || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.birthday || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.dormEntryDate || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.academicLevel || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`font-semibold ${resident.isActive ? 'text-green-600' : 'text-red-500'}`}
                              >
                                {resident.isActive ? 'Hoạt động' : 'Vô hiệu hóa'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        //Xem thông tin cá nhân
        case 'myProfileDetails':
            return (
              <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Hồ sơ của tôi</h2>
                <div className="space-y-4">
                  {/* Các trường thông tin cá nhân */}
                  <div>
                    <label
                      htmlFor="editFullName"
                      className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                    >
                      Họ tên đầy đủ:
                    </label>
                    <input
                      type="text"
                      id="editFullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="editPhoneNumber"
                      className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                    >
                      Số điện thoại:
                    </label>
                    <input
                      type="text"
                      id="editPhoneNumber"
                      value={memberPhoneNumber}
                      onChange={(e) => setMemberPhoneNumber(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="editStudentId"
                      className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                    >
                      Mã số sinh viên:
                    </label>
                    <input
                      type="text"
                      id="editStudentId"
                      value={memberStudentId}
                      onChange={(e) => setMemberStudentId(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="editBirthday"
                      className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                    >
                      Ngày sinh:
                    </label>
                    <input
                      type="date"
                      id="editBirthday"
                      value={memberBirthday}
                      onChange={(e) => setMemberBirthday(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="editDormEntryDate"
                      className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                    >
                      Ngày nhập KTX:
                    </label>
                    <input
                      type="date"
                      id="editDormEntryDate"
                      value={memberDormEntryDate}
                      onChange={(e) => setMemberDormEntryDate(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="editAcademicLevel"
                      className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                    >
                      Email trường:
                    </label>
                    <input
                      type="text"
                      id="editAcademicLevel"
                      value={memberAcademicLevel}
                      onChange={(e) => setMemberAcademicLevel(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>

                  {/* Phần tải ảnh đại diện */}
                  <div className="mt-8 pt-6 border-t border-gray-300 dark:border-gray-600">
                    <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Ảnh đại diện</h3>
                    <div className="flex items-center space-x-4 mb-4">
                      {userAvatarUrl ? (
                        <img
                          src={userAvatarUrl}
                          alt="Avatar"
                          className="w-24 h-24 rounded-full object-cover shadow-lg border-2 border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 text-5xl">
                          <i className="fas fa-user-circle"></i>
                        </div>
                      )}
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            setNewAvatarFile(e.target.files[0]);
                            setAvatarError('');
                          }}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {isUploadingAvatar && (
                          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                            <div
                              className="bg-blue-600 h-2.5 rounded-full"
                              style={{ width: `${avatarUploadProgress}%` }}
                            ></div>
                          </div>
                        )}
                        {avatarError && <p className="text-red-500 text-sm mt-2">{avatarError}</p>}
                        <button
                          onClick={handleUploadMyAvatar}
                          className="mt-3 px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
                          disabled={isUploadingAvatar || !newAvatarFile}
                        >
                          {isUploadingAvatar ? (
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                          ) : (
                            <i className="fas fa-upload mr-2"></i>
                          )}
                          Tải ảnh đại diện
                        </button>
                      </div>
                    </div>
                  </div>

                  {authError && <p className="text-red-500 text-sm text-center mt-4">{authError}</p>}
                  <button
                    onClick={handleSaveUserProfile}
                    className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
                  >
                    <i className="fas fa-save mr-2"></i> Lưu thông tin
                  </button>
                </div>
              </div>
            );
        //Đổi mật khẩu tài khoản
        case 'passwordSettings':
            return (
              <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Đổi mật khẩu</h2>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="oldPassword"
                      className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                    >
                      Mật khẩu cũ:
                    </label>
                    <input
                      type="password"
                      id="oldPassword"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                      placeholder="Nhập mật khẩu cũ"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="newPassword"
                      className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                    >
                      Mật khẩu mới:
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                      placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="confirmNewPassword"
                      className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                    >
                      Xác nhận mật khẩu mới:
                    </label>
                    <input
                      type="password"
                      id="confirmNewPassword"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                      placeholder="Xác nhận mật khẩu mới"
                    />
                  </div>
                  {passwordChangeMessage && (
                    <p
                      className={`text-sm text-center mt-4 ${passwordChangeMessage.includes('thành công') ? 'text-green-600' : 'text-red-500'}`}
                    >
                      {passwordChangeMessage}
                    </p>
                  )}
                  <button
                    onClick={handleChangePassword}
                    className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-xl shadow-md hover:bg-red-700 transition-all duration-300"
                  >
                    <i className="fas fa-key mr-2"></i> Đổi mật khẩu
                  </button>
                </div>
              </div>
            );
        //Đăng và xem kỷ niệm phòng
        case 'roomMemories':
              return (
                <div className="p-6 bg-yellow-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
                  {/* ===== TIÊU ĐỀ VÀ NÚT BẤM MỚI ===== */}
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">Kỷ niệm phòng</h2>
                    <button
                      onClick={() => setShowAddMemoryModal(true)}
                      className="bg-yellow-500 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-yellow-600 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                      title="Đăng kỷ niệm mới"
                    >
                      <i className="fas fa-plus text-xl"></i>
                    </button>
                  </div>

                  {/* Phần lọc và tìm kiếm */}
                  <div className="mb-4 flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0 sm:space-x-4">
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo tên sự kiện..."
                      value={searchTermMemory}
                      onChange={(e) => setSearchTermMemory(e.target.value)}
                      className="flex-grow shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full sm:w-auto py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                    <select
                      value={filterUploaderMemory}
                      onChange={(e) => setFilterUploaderMemory(e.target.value)}
                      className="shadow-sm border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700"
                    >
                      <option value="all">Tất cả người đăng</option>
                      {allUsersData
                        .filter((user) => user.role === 'member' || user.role === 'admin')
                        .map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.fullName || user.email}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Danh sách kỷ niệm */}
                  {memories.length === 0 ? (
                    <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                      Chưa có kỷ niệm nào được thêm.
                    </p>
                  ) : (
                    <div className="max-h-[600px] overflow-y-auto p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {memories.map((memory) => (
                          <div
                            key={memory.id}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-transform transform hover:scale-105 duration-200"
                            onClick={() => setSelectedMemoryDetails(memory)}
                          >
                            <div className="relative aspect-video bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              {memory.files && memory.files.length > 0 ? (
                                <>
                                  {memory.files[0].fileType === 'image' ? (
                                    <img
                                      src={memory.files[0].fileUrl}
                                      alt={memory.eventName}
                                      className="w-full h-full object-cover cursor-pointer"
                                      onClick={() => setSelectedMemoryForLightbox(memory)}
                                    />
                                  ) : (
                                    <video
                                      src={memory.files[0].fileUrl}
                                      controls
                                      className="w-full h-full object-cover"
                                      onClick={() => setSelectedMemoryForLightbox(memory)}
                                    />
                                  )}
                                  {memory.files.length > 1 && (
                                    <span className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
                                      {memory.files.length} ảnh/video
                                    </span>
                                  )}
                                </>
                              ) : (
                                <div className="text-gray-500 dark:text-gray-400">Không có ảnh</div>
                              )}
                            </div>
                            <div className="p-4">
                              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-2 truncate">
                                {memory.eventName}
                              </h3>
                              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                                Ngày chụp: {memory.photoDate}
                              </p>
                              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                                Đăng bởi:{' '}
                                <span className="font-medium">
                                  {memory.uploadedByName ||
                                    allUsersData.find((u) => u.id === memory.uploadedBy)?.fullName ||
                                    'Người dùng ẩn danh'}
                                </span>
                              </p>
                              {(userRole === 'admin' || userId === memory.uploadedBy) && (
                                <div className="flex justify-end space-x-2">
                                  <button
                                    onClick={() => handleEditMemory(memory)}
                                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors"
                                  >
                                    Chỉnh sửa
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteMemory(memory.id, memory.files, memory.uploadedBy)
                                    }
                                    className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors"
                                  >
                                    Xóa
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {totalMemoriesCount > itemsPerPageMemories && (
                    <div className="flex justify-center items-center space-x-4 mt-8">
                      <button
                        onClick={() => setCurrentPageMemories((prev) => Math.max(1, prev - 1))}
                        disabled={currentPageMemories === 1}
                        className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Trang trước
                      </button>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">
                        Trang {currentPageMemories} / {totalPagesMemories}
                      </span>
                      <button
                        onClick={() => setCurrentPageMemories((prev) => Math.min(totalPagesMemories, prev + 1))}
                        disabled={currentPageMemories === totalPagesMemories}
                        className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Trang sau
                      </button>
                    </div>
                  )}

                  {/* POPUP ĐĂNG KỶ NIỆM MỚI */}
                  {showAddMemoryModal && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
                      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">
                          Đăng Kỷ niệm mới
                        </h3>
                        <form onSubmit={handleAddMemory} className="space-y-4">
                          <div>
                            <label htmlFor="eventName" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                              Tên sự kiện:
                            </label>
                            <input
                              type="text"
                              id="eventName"
                              value={newMemoryEventName}
                              onChange={(e) => setNewMemoryEventName(e.target.value)}
                              className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700"
                              placeholder="Ví dụ: Sinh nhật Duy, Chuyến đi Vũng Tàu"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor="photoDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                              Ngày chụp/quay:
                            </label>
                            <input
                              type="date"
                              id="photoDate"
                              value={newMemoryPhotoDate}
                              onChange={(e) => setNewMemoryPhotoDate(e.target.value)}
                              className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor="memoryImageFile" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                              Chọn ảnh/video:
                            </label>
                            <input
                              type="file"
                              id="memoryImageFile"
                              accept="image/*,video/*"
                              multiple
                              onChange={(e) => setNewMemoryImageFile(Array.from(e.target.files))}
                              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                              required
                            />
                            {isUploadingMemory && (
                              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                                <div className="bg-yellow-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                              </div>
                            )}
                            {uploadProgress > 0 && uploadProgress < 100 && (
                              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 text-right">{uploadProgress}% tải lên</p>
                            )}
                          </div>
                          {memoryError && <p className="text-red-500 text-sm text-center mt-4">{memoryError}</p>}
                          <div className="flex space-x-4 mt-6">
                              <button
                                type="button"
                                onClick={() => setShowAddMemoryModal(false)}
                                className="w-1/2 px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-300"
                              >
                                Hủy
                              </button>
                              <button
                                type="submit"
                                className="w-1/2 px-6 py-3 bg-yellow-600 text-white font-semibold rounded-xl shadow-md hover:bg-yellow-700 transition-all duration-300"
                                disabled={isUploadingMemory}
                              >
                                {isUploadingMemory ? <i className="fas fa-spinner fa-spin"></i> : 'Đăng'}
                              </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              );          
        //Xem thông tin tiền bối
        case 'formerResidents':
          return (
            <div className="p-6 bg-green-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-5">Thông tin tiền bối</h2>

              {/* Không hiển thị form thêm tiền bối thủ công cho thành viên */}
              {/* Không hiển thị nút "Chuyển người dùng sang tiền bối" cho thành viên */}

              <h3 className="text-xl font-bold text-green-700 dark:text-green-200 mb-4">Danh sách tiền bối</h3>
              {formerResidents.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                  Chưa có thông tin tiền bối nào được lưu.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {formerResidents.map((resident) => (
                    <div
                      key={resident.id}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                    >
                      {/* HIỂN THỊ AVATAR */}
                      {resident.photoURL ? ( // Dùng resident.photoURL trực tiếp từ object
                        <img
                          src={resident.photoURL}
                          alt={`Avatar của ${resident.name}`}
                          className="w-full h-48 object-cover cursor-pointer"
                          onClick={() =>
                            setSelectedImageToZoom({
                              fileUrl: resident.photoURL,
                              fileType: 'image',
                              eventName: `Avatar của ${resident.name}`,
                            })
                          }
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 text-6xl">
                          <i className="fas fa-user-circle"></i>
                        </div>
                      )}
                      <div className="p-4">
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{resident.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <i className="fas fa-envelope mr-2"></i>Email: {resident.email || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <i className="fas fa-phone mr-2"></i>SĐT: {resident.phoneNumber || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <i className="fas fa-id-badge mr-2"></i>MSSV: {resident.studentId || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <i className="fas fa-birthday-cake mr-2"></i>Ngày sinh: {resident.birthday || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <i className="fas fa-calendar-alt mr-2"></i>Ngày nhập KTX: {resident.dormEntryDate || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <i className="fas fa-graduation-cap mr-2"></i>Cấp: {resident.academicLevel || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <i className="fas fa-door-open mr-2"></i>Ngày ra khỏi phòng:{' '}
                          {resident.deactivatedAt && typeof resident.deactivatedAt.toLocaleDateString === 'function'
                            ? resident.deactivatedAt.toLocaleDateString('vi-VN')
                            : resident.deactivatedAt || 'N/A'}
                        </p>
                        {/* Không hiển thị nút chỉnh sửa/xóa cho thành viên */}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        //Xem thông báo tới thành viên
        case 'notifications':
          return (
            <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Thông báo của tôi</h2>
              {notificationError && <p className="text-red-500 text-sm text-center mb-4">{notificationError}</p>}
              {notifications.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa có thông báo nào.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full bg-white dark:bg-gray-800">
                    <thead>
                      <tr>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          Nội dung tóm tắt
                        </th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          Loại
                        </th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          Thời gian
                        </th>
                        <th className="py-3 px-4 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          Trạng thái
                        </th>
                        <th className="py-3 px-4 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">
                          Chi tiết
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                      {notifications.map((notification) => (
                        <tr
                          key={notification.id}
                          className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${!notification.isRead ? 'font-semibold' : ''}`}
                        >
                          <td className="py-3 px-4 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                            {notification.message}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">{notification.type}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {notification.createdAt instanceof Date
                              ? notification.createdAt.toLocaleDateString('vi-VN')
                              : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${notification.isRead ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}
                            >
                              {notification.isRead ? 'Đã đọc' : 'Chưa đọc'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedNotificationDetails(notification);
                                markNotificationAsRead(notification.id);
                              }}
                              className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg shadow-sm hover:bg-blue-600 transition-colors"
                            >
                              Xem
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        //Chỉnh sửa thông tin cá nhân
        case 'memberProfileEdit':
          return (
            <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Chỉnh sửa thông tin cá nhân</h2>
              {!loggedInResidentProfile ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">
                  Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.
                </p>
              ) : (
                <div className="space-y-4">
                  {authError && <p className="text-red-500 text-sm text-center mt-4">{authError}</p>}
                  <button
                    onClick={handleSaveUserProfile}
                    className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
                  >
                    <i className="fas fa-save mr-2"></i> Lưu thông tin
                  </button>
                  <button
                    onClick={() => setEditProfileMode(false)}
                    className="w-full mt-2 px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-300"
                  >
                    Hủy
                  </button>
                </div>
              )}

              {/* Phần đổi mật khẩu */}
              <div className="mt-10 pt-6 border-t border-gray-300 dark:border-gray-600">
                <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Đổi mật khẩu</h3>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="oldPasswordMember"
                      className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                    >
                      Mật khẩu cũ:
                    </label>
                    <input
                      type="password"
                      id="oldPasswordMember"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nhập mật khẩu cũ"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="newPasswordMember"
                      className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                    >
                      Mật khẩu mới:
                    </label>
                    <input
                      type="password"
                      id="newPasswordMember"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="confirmNewPasswordMember"
                      className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                    >
                      Xác nhận mật khẩu mới:
                    </label>
                    <input
                      type="password"
                      id="confirmNewPasswordMember"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Xác nhận mật khẩu mới"
                    />
                  </div>
                  {passwordChangeMessage && (
                    <p
                      className={`text-sm text-center mt-4 ${passwordChangeMessage.includes('thành công') ? 'text-green-600' : 'text-red-500'}`}
                    >
                      {passwordChangeMessage}
                    </p>
                  )}
                  <button
                    onClick={handleChangePassword}
                    className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-xl shadow-md hover:bg-red-700 transition-all duration-300"
                  >
                    <i className="fas fa-key mr-2"></i> Đổi mật khẩu
                  </button>
                </div>
              </div>
            </div>
          );
        //Gửi góp ý cho admin
        case 'feedback':
            if (userRole === 'member') {
              return (
              <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-5">Gửi góp ý cho chúng mình</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Mọi ý kiến đóng góp của bạn đều rất quý giá để giúp ứng dụng ngày càng tốt hơn. Cảm ơn bạn!
                </p>
                <form onSubmit={handleSendFeedback}>
                  <textarea
                    value={feedbackContent}
                    onChange={(e) => setFeedbackContent(e.target.value)}
                    rows="6"
                    className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập nội dung góp ý của bạn ở đây..."
                  ></textarea>
                  <button
                    type="submit"
                    className="w-full mt-4 p-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                  >
                    Gửi góp ý
                  </button>
                </form>
              </div>
            );
        }
        default:
        return (
          <div className="text-center p-8 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner">
            <p className="text-xl text-gray-700 dark:text-gray-300 font-semibold mb-4">
              Chào mừng Thành viên! Vui lòng chọn một mục từ thanh điều hướng.
            </p>
          </div>
        );
      }
    }

    // Trường hợp không có vai trò hoặc không xác định (hiển thị khi chưa đăng nhập)
    return (
      <div className="text-center p-8 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner">
        <p className="text-xl text-gray-700 dark:text-gray-300 font-semibold mb-4">Đang đăng nhập...</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 dark:from-gray-900 dark:to-gray-700 flex flex-col font-inter overflow-hidde">
      <div className="seasonal-effect">
        {seasonalEffectElements.map((el, index) => React.cloneElement(el, { key: index }))}
      </div>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center sticky top-0 z-30">
        {/* KHỐI BÊN TRÁI: Chứa nút toggle và tiêu đề */}
        <div className="flex items-center space-x-4">
          <button
            className="lg:hidden p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <i className="fas fa-bars text-xl"></i>
          </button>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Quản lý phòng</h1>
        </div>

        {/* Khối bên phải */}
          <div className="flex items-center space-x-4">
            {/* Nút thông báo */}
            {userId && (
                <button
                  onClick={() => setShowNotificationsModal(true)}
                  className="relative p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-md hover:shadow-lg transition-all duration-300"
                >
                  <i className="fas fa-bell text-lg"></i>
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>
            )}
            
            {/* Nút đổi theme */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-md hover:shadow-lg transition-all duration-300"
            >
              {theme === 'light' ? <i className="fas fa-moon text-lg"></i> : <i className="fas fa-sun text-lg"></i>}
            </button>
            
            {/* ===== AVATAR VÀ POPOVER PROFILE (BẰNG TAILWIND CSS) ===== */}
            {userId && (
              <div className="relative">
                {/* Nút Avatar */}
                <button onClick={handleProfileClick} className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full">
                  {userAvatarUrl ? (
                    <img
                      src={userAvatarUrl}
                      alt="Avatar"
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 text-2xl border-2 border-gray-300 dark:border-gray-600">
                      <i className="fas fa-user-circle"></i>
                    </div>
                  )}
                </button>
                
                {/* Popover Paper tự tạo bằng div */}
                {Boolean(profilePopoverAnchor) && (
                  <div 
                    ref={popoverRef}
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-40"
                  >
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="user-menu-button">
                      <button
                        onClick={() => { setActiveSection('myProfileDetails'); handleProfileClose(); }}
                        className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                      >
                        <i className="fas fa-user-circle mr-3"></i>
                        Hồ sơ của tôi
                      </button>
                      <button
                        onClick={() => { setActiveSection('passwordSettings'); handleProfileClose(); }}
                        className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                      >
                        <i className="fas fa-key mr-3"></i>
                        Mật khẩu
                      </button>
                      <div className="border-t border-gray-200 dark:border-gray-600"></div>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-700"
                        role="menuitem"
                      >
                        <i className="fas fa-sign-out-alt mr-3"></i>
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
      </header>
      {/* Container chính cho sidebar và nội dung - thêm "relative group" */}
      <div className="relative group flex flex-1 h-full">
          {/* Sidebar */}
          <aside
              className={`flex-shrink-0 fixed inset-y-0 left-0 bg-white dark:bg-gray-800 shadow-lg transform ${
                  isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              } lg:relative lg:translate-x-0 transition-all duration-300 ease-in-out z-20 h-full flex flex-col ${
                  isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
              }`}
          >
              {/* Khối nội dung chính của sidebar, có thể cuộn */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  <div className="flex justify-end lg:hidden p-4">
                      <button onClick={() => setIsSidebarOpen(false)} className="p-2 rounded-md text-gray-700 dark:text-gray-300">
                          <i className="fas fa-times text-xl"></i>
                      </button>
                  </div>
                  
                  {/* Khối thông tin cá nhân */}
                  <div className={`flex items-center p-4 border-b border-gray-200 dark:border-gray-700 mb-4 ${isSidebarCollapsed && 'lg:justify-center'}`}>
                      <div className="flex-shrink-0">
                          {userAvatarUrl ? (
                              <img src={userAvatarUrl} alt="Avatar" className="w-14 h-14 rounded-full object-cover"/>
                          ) : (
                              <div className="w-14 h-14 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 text-3xl">
                                  <i className="fas fa-user-circle"></i>
                              </div>
                          )}
                      </div>
                      {!isSidebarCollapsed && (
                          <div className="ml-4">
                              <p className="font-bold text-gray-800 dark:text-white break-words">{fullName}</p>
                              {memberStudentId && (<p className="text-sm text-gray-600 dark:text-gray-400">{memberStudentId}</p>)}
                              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">{userRole === 'admin' ? 'Quản trị viên' : 'Thành viên'}</p>
                          </div>
                      )}
                  </div>

                  {/* Nav */}
                  <nav className="space-y-1 px-4">
                      {/* ===== ĐIỀU HƯỚNG CỦA ADMIN ===== */}
                      {userId && userRole === 'admin' && (
                        <>
                          {/* --- Nhóm Cá Nhân --- */}
                          <div>
                            {!isSidebarCollapsed && <h3 className="sidebar-group-title">Cá Nhân</h3>}
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'dashboard'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('dashboard'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-tachometer-alt"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Dashboard</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'customNotificationDesign'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('customNotificationDesign'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-bullhorn"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Quản lý Thông báo</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'feedback'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('feedback'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-lightbulb"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Hộp thư góp ý</span>}
                            </button>
                          </div>

                          {/* --- Nhóm Quản Lý Chung --- */}
                          <div className="pt-2">
                            {!isSidebarCollapsed && <h3 className="sidebar-group-title">Quản Lý Chung</h3>}
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'residentManagement'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('residentManagement'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-users"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Quản lý người ở</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'attendanceTracking'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('attendanceTracking'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-calendar-alt"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Điểm danh hàng ngày</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'billing'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('billing'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-file-invoice-dollar"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Tính tiền điện nước</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'costSharing'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('costSharing'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-handshake"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Chia tiền & Nhắc nhở</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'cleaningSchedule'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('cleaningSchedule'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-broom"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Lịch trực phòng</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'shoeRackManagement'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('shoeRackManagement'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-shoe-prints"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Quản lý kệ giày</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'adminCreateAccount'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('adminCreateAccount'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-user-plus"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Tạo tài khoản mới</span>}
                            </button>
                          </div>

                          {/* --- Nhóm Sinh Hoạt & Lưu Trữ --- */}
                          <div className="pt-2">
                            {!isSidebarCollapsed && <h3 className="sidebar-group-title">Sinh Hoạt & Lưu Trữ</h3>}
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'commonRoomInfo'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('commonRoomInfo'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-info-circle"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Thông tin phòng chung</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'roomMemories'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('roomMemories'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-camera"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Kỷ niệm phòng</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'formerResidents'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('formerResidents'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-user-graduate"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Thông tin tiền bối</span>}
                            </button>
                          </div>

                          {/* --- Nhóm Báo Cáo & Thống Kê --- */}
                          <div className="pt-2">
                            {!isSidebarCollapsed && <h3 className="sidebar-group-title">Báo Cáo & Thống Kê</h3>}
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'billHistory'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('billHistory'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-history"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Lịch sử hóa đơn</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'costSharingHistory'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('costSharingHistory'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-receipt"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Lịch sử chia tiền</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'loginHistory'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('loginHistory'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-history"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Lịch sử đăng nhập</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'consumptionStats'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('consumptionStats'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-chart-bar"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Thống kê tiêu thụ</span>}
                            </button>
                          </div>
                        </>
                      )}

                      {/* ===== ĐIỀU HƯỚNG CỦA MEMBER ===== */}
                      {userId && userRole === 'member' && (
                        <>
                          {/* --- Nhóm Cá Nhân --- */}
                          <div>
                            {!isSidebarCollapsed && <h3 className="sidebar-group-title">Cá Nhân</h3>}
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'dashboard'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('dashboard'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-tachometer-alt"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Dashboard</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'notifications'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('notifications'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-bell"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Thông báo của tôi</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'memberCostSummary'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('memberCostSummary'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-money-bill-wave"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Chi phí của tôi</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'memberCleaningSchedule'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('memberCleaningSchedule'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-broom"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Lịch trực của tôi</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'feedback'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('feedback'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-lightbulb"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Hộp thư góp ý</span>}
                            </button>
                          </div>
                          
                          {/* --- Nhóm Sinh Hoạt Chung --- */}
                          <div className="pt-2">
                            {!isSidebarCollapsed && <h3 className="sidebar-group-title">Sinh Hoạt Chung</h3>}
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'attendanceTracking'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('attendanceTracking'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-calendar-alt"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Điểm danh</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'shoeRackManagement'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('shoeRackManagement'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-shoe-prints"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Thông tin kệ giày</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'commonRoomInfo'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('commonRoomInfo'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-info-circle"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Thông tin phòng chung</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'roomMemories'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('roomMemories'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-camera"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Kỷ niệm phòng</span>}
                            </button>
                            <button
                              className={`w-full flex items-center py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${isSidebarCollapsed && 'justify-center'} ${
                                activeSection === 'formerResidents'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => { setActiveSection('formerResidents'); setIsSidebarOpen(false); }}
                            >
                              <i className="fas fa-user-graduate"></i>
                              {!isSidebarCollapsed && <span className="ml-3">Thông tin tiền bối</span>}
                            </button>
                          </div>
                        </>
                      )}
                  </nav>
              </div>
              
              {/* Copyright */}
              <div className={`p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 ${isSidebarCollapsed && 'hidden'}`}>
                  <div className="text-center text-gray-500 dark:text-gray-400 text-xs">
                      © Bản quyền thuộc về Nguyễn Huỳnh Phúc Khang 2025
                  </div>
              </div>
          </aside>
          
          {/* ===== NÚT THU GỌN MỚI - NẰM NGOÀI SIDEBAR ===== */}
          <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
              className={`hidden lg:block absolute top-1/2 -translate-y-1/2 z-30
                          bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 
                          border border-gray-200 dark:border-gray-600 rounded-full 
                          w-8 h-8 flex items-center justify-center
                          opacity-0 group-hover:opacity-100 transition-all duration-300
                          ${isSidebarCollapsed ? 'left-16' : 'left-60'}`}
              style={{ transform: 'translateY(-50%)' }}
          >
              <i className={`fas ${isSidebarCollapsed ? 'fa-angle-right' : 'fa-angle-left'}`}></i>
          </button>

          {/* Lớp phủ */}
          {isSidebarOpen && (
              <div
                  onClick={() => setIsSidebarOpen(false)}
                  className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
                  aria-hidden="true"
              ></div>
          )}

          {/* Main Content Area */}
          <main className={`h-full p-4 transition-all duration-300 ease-in-out overflow-y-auto w-full ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
              {userId ? (
                  renderSection()
              ) : (
                <div className="mb-8 p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg mx-auto max-w-lg">
                  {/* Tab Navigation */}
                  <div className="flex justify-center mb-6 border-b border-gray-300 dark:border-gray-600">
                    <button
                      className={`px-4 py-2 text-lg font-semibold ${authMode === 'login' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-blue-500'}`}
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError('');
                      }}>
                      Đăng nhập
                    </button>
                    <button
                      className={`px-4 py-2 text-lg font-semibold ${authMode === 'register' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-blue-500'}`}
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError('');
                      }}>
                      Đăng ký
                    </button>
                  </div>

                  {!isAuthReady ? (
                    <p className="text-blue-600 dark:text-blue-300 text-center text-lg">Đang kết nối Firebase...</p>
                  ) : (
                    <>
                      {/* FORM ĐĂNG NHẬP */}
                      {authMode === 'login' && (
                        <div className="flex flex-col space-y-4">
                          <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 text-center">Đăng nhập tài khoản</h2>
                          <div>
                            <label htmlFor="studentIdLogin" className="sr-only">Mã số sinh viên</label>
                            <input
                              type="text"
                              id="studentIdLogin"
                              placeholder="Mã số sinh viên"
                              value={studentIdForLogin}
                              onChange={(e) => setStudentIdForLogin(e.target.value)}
                              className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                            />
                          </div>
                          <div>
                            <label htmlFor="passwordLogin" className="sr-only">Mật khẩu</label>
                            <input
                              type="password"
                              id="passwordLogin"
                              placeholder="Mật khẩu"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                            />
                          </div>
                          {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
                          <button
                            onClick={handleSignIn}
                            className="w-full px-6 py-2 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
                          >
                            Đăng nhập
                          </button>
                          <button
                            onClick={() => setShowForgotPasswordModal(true)}
                            className="w-full mt-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-semibold"
                          >
                            Quên mật khẩu?
                          </button>
                        </div>
                      )}

                      {/* FORM ĐĂNG KÝ */}
                      {authMode === 'register' && (
                        <div className="flex flex-col space-y-4">
                          <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 text-center">Tạo tài khoản mới</h2>
                          <div>
                            <label htmlFor="fullNameRegister" className="sr-only">Họ tên đầy đủ</label>
                            <input
                              type="text"
                              id="fullNameRegister"
                              placeholder="Họ tên đầy đủ"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                            />
                          </div>
                          <div>
                            <label htmlFor="studentIdRegister" className="sr-only">Mã số sinh viên</label>
                            <input
                              type="text"
                              id="studentIdRegister"
                              placeholder="Mã số sinh viên (dùng để đăng nhập)"
                              value={newStudentIdForAuth}
                              onChange={(e) => setNewStudentIdForAuth(e.target.value)}
                              className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                            />
                          </div>
                          {/* ===== TRƯỜNG EMAIL MỚI ĐƯỢC THÊM VÀO ĐÂY ===== */}
                          <div>
                            <label htmlFor="emailRegister" className="sr-only">Email cá nhân</label>
                            <input
                              type="email"
                              id="emailRegister"
                              placeholder="Email cá nhân (để xác minh tài khoản)"
                              value={personalEmailForRegister}
                              onChange={(e) => setPersonalEmailForRegister(e.target.value)}
                              className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                            />
                          </div>
                          {/* ===== KẾT THÚC TRƯỜNG EMAIL MỚI ===== */}
                          <div>
                            <label htmlFor="passwordRegister" className="sr-only">Mật khẩu</label>
                            <input
                              type="password"
                              id="passwordRegister"
                              placeholder="Mật khẩu (ít nhất 6 ký tự)"
                              value={password}
                              onChange={(e) => setPassword(e.targe.value)}
                              className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                            />
                          </div>
                          {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
                          <button
                            onClick={handleRegister}
                            className="w-full px-6 py-2 bg-purple-600 text-white font-semibold rounded-xl shadow-md hover:bg-purple-700 transition-all duration-300"
                          >
                            Đăng ký
                          </button>
                        </div>
                      )}                
                      </>
                  )}
                </div>
              )}
          </main>
      </div>

      {/* MODAL CHI TIẾT HÓA ĐƠN ĐIỆN NƯỚC */}
      {selectedBillDetails &&
        userRole === 'admin' && ( // Chỉ hiển thị chi tiết hóa đơn cho admin
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">Chi tiết hóa đơn</h3>
              <div className="space-y-3 text-gray-700 dark:text-gray-300">
                <p>
                  <strong>Tháng:</strong> {selectedBillDetails.billingMonth || 'N/A'}
                </p>
                <p>
                  <strong>Ngày tính:</strong>{' '}
                  {selectedBillDetails.billDate && selectedBillDetails.billDate instanceof Date
                    ? selectedBillDetails.billDate.toLocaleDateString('vi-VN')
                    : 'N/A'}
                </p>
                <p>
                  <strong>Người ghi nhận:</strong> {selectedBillDetails.recordedBy}
                </p>
                <p>
                  <strong>Điện (Đầu):</strong> {selectedBillDetails.electricityStartReading} KW
                </p>
                <p>
                  <strong>Điện (Cuối):</strong> {selectedBillDetails.electricityEndReading} KW
                </p>
                <p>
                  <strong>Tiêu thụ điện:</strong> {selectedBillDetails.electricityConsumption} KW
                </p>
                <p>
                  <strong>Tiền điện:</strong> {selectedBillDetails.electricityCost?.toLocaleString('vi-VN')} VND
                </p>
                <p>
                  <strong>Nước (Đầu):</strong> {selectedBillDetails.waterStartReading} m³
                </p>
                <p>
                  <strong>Nước (Cuối):</strong> {selectedBillDetails.waterEndReading} m³
                </p>
                <p>
                  <strong>Tiêu thụ nước:</strong> {selectedBillDetails.waterConsumption} m³
                </p>
                <p>
                  <strong>Tiền nước:</strong> {selectedBillDetails.waterCost?.toLocaleString('vi-VN')} VND
                </p>
                <p className="text-xl font-bold border-t pt-3 mt-3 border-gray-300 dark:border-gray-600">
                  Tổng cộng: {selectedBillDetails.totalCost?.toLocaleString('vi-VN')} VND
                </p>
                <p className="text-lg font-bold">
                  Trạng thái:{' '}
                  <span
                    className={
                      selectedBillDetails.isPaid
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-500 dark:text-red-400'
                    }
                  >
                    {selectedBillDetails.isPaid ? 'Đã trả' : 'Chưa trả'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedBillDetails(null)}
                className="mt-6 w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
              >
                Đóng
              </button>
            </div>
          </div>
      )}

      {/* ===== MODAL CHI TIẾT BÀI ĐĂNG KỶ NIỆM ===== */}
      {selectedMemoryDetails && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedMemoryDetails(null)} // Đóng khi bấm ra ngoài
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()} // Ngăn không cho popup tự đóng khi bấm vào bên trong
          >
            {/* Header của Popup */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                {selectedMemoryDetails.eventName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Ngày chụp: {selectedMemoryDetails.photoDate}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Đăng bởi: {selectedMemoryDetails.uploadedByName || 'N/A'}
              </p>
            </div>

            {/* Nội dung hình ảnh/video */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="grid grid-cols-1 gap-4">
                {selectedMemoryDetails.files && selectedMemoryDetails.files.map((file, index) => (
                  <div key={index}>
                    {file.fileType === 'image' ? (
                      <img src={file.fileUrl} alt={`File ${index + 1}`} className="w-full h-auto rounded-lg object-contain" />
                    ) : (
                      <video src={file.fileUrl} controls className="w-full h-auto rounded-lg"></video>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer của Popup */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setSelectedMemoryDetails(null)}
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL CHỈNH SỬA BÀI ĐĂNG KỶ NIỆM ===== */}
      {editingMemory && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">Chỉnh sửa kỷ niệm</h3>
            <form onSubmit={handleUpdateMemory} className="space-y-4">
              <div>
                <label
                  htmlFor="editEventName"
                  className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                >
                  Sự kiện:
                </label>
                <input
                  type="text"
                  id="editEventName"
                  value={editMemoryEventName}
                  onChange={(e) => setEditMemoryEventName(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label
                  htmlFor="editPhotoDate"
                  className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                >
                  Ngày chụp/quay:
                </label>
                <input
                  type="date"
                  id="editPhotoDate"
                  value={editMemoryPhotoDate}
                  onChange={(e) => setEditMemoryPhotoDate(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>
              {/* Hiển thị các ảnh/video hiện có và tùy chọn xóa */}
              <div className="border p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">File hiện có:</p>
                {editingMemory.files && editingMemory.files.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {editingMemory.files.map((file, index) => (
                      <div key={index} className="relative group">
                        {file.fileType === 'video' ? (
                          <video src={file.fileUrl} controls className="w-full h-24 object-cover rounded-lg"></video>
                        ) : (
                          <img
                            src={file.fileUrl}
                            alt={`Memory ${index}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const updatedFiles = editingMemory.files.filter((_, i) => i !== index);
                            setEditingMemory({ ...editingMemory, files: updatedFiles });
                            // Xóa file khỏi Cloudinary (cần Cloud Function)
                            if (file.publicId) {
                              alert(`Chức năng xóa file Cloudinary cho ${file.publicId} cần Cloud Function.`);
                            }
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">Không có file nào.</p>
                )}
              </div>
              {/* Thêm file mới */}
              <div>
                <label htmlFor="editNewFiles" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                  Thêm file mới (ảnh/video):
                </label>
                <input
                  type="file"
                  id="editNewFiles"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => setEditMemoryNewFiles(Array.from(e.target.files))}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              {isUploadingEditMemory && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${editMemoryUploadProgress}%` }}
                  ></div>
                </div>
              )}
              {editMemoryError && <p className="text-red-500 text-sm text-center mt-4">{editMemoryError}</p>}
              <button
                type="submit"
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                disabled={isUploadingEditMemory}
              >
                {isUploadingEditMemory ? (
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                ) : (
                  <i className="fas fa-save mr-2"></i>
                )}
                Lưu thay đổi
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingMemory(null);
                  setEditMemoryError('');
                }}
                className="w-full mt-2 px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-300"
              >
                Hủy
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL TRÌNH XEM ẢNH/VIDEO KỶ NIỆM ===== */}
      {selectedMemoryForLightbox && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedMemoryForLightbox(null)} // Đóng modal khi nhấp ra ngoài
        >
          <div
            className="relative max-w-full max-h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedMemoryForLightbox.files && selectedMemoryForLightbox.files.length > 0 && (
              <>
                {selectedMemoryForLightbox.files[currentLightboxIndex].fileType === 'video' ? (
                  <video
                    src={selectedMemoryForLightbox.files[currentLightboxIndex].fileUrl}
                    controls
                    autoPlay
                    loop
                    className="max-w-full max-h-[90vh] object-contain shadow-lg rounded-lg"
                  ></video>
                ) : (
                  <img
                    src={selectedMemoryForLightbox.files[currentLightboxIndex].fileUrl}
                    alt={`${selectedMemoryForLightbox.eventName} - ${currentLightboxIndex + 1}`}
                    className="max-w-full max-h-[90vh] object-contain shadow-lg rounded-lg"
                  />
                )}

                {/* Nút điều hướng Previous */}
                {selectedMemoryForLightbox.files.length > 1 && (
                  <button
                    onClick={() =>
                      setCurrentLightboxIndex((prev) =>
                        prev === 0 ? selectedMemoryForLightbox.files.length - 1 : prev - 1,
                      )
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl bg-gray-800 bg-opacity-50 rounded-full w-12 h-12 flex items-center justify-center hover:bg-opacity-75 transition-colors"
                  >
                    &#10094;
                  </button>
                )}

                {/* Nút điều hướng Next */}
                {selectedMemoryForLightbox.files.length > 1 && (
                  <button
                    onClick={() =>
                      setCurrentLightboxIndex((prev) =>
                        prev === selectedMemoryForLightbox.files.length - 1 ? 0 : prev + 1,
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl bg-gray-800 bg-opacity-50 rounded-full w-12 h-12 flex items-center justify-center hover:bg-opacity-75 transition-colors"
                  >
                    &#10095;
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => setSelectedMemoryForLightbox(null)}
              className="absolute top-4 right-4 text-white text-3xl bg-gray-800 bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition-colors"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/*  ===== MODAL HIỂN THỊ ẢNH/VIDEO PHÓNG TO (THU NHỎ) ===== */}
      {selectedImageToZoom && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImageToZoom(null)}
        >
          <div
            className="relative max-w-full max-h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {' '}
            {/* Ngăn chặn sự kiện nổi bọt trên nội dung */}
            {selectedImageToZoom.fileType === 'video' ? ( // Hiển thị video nếu là video
              <video
                src={selectedImageToZoom.fileUrl}
                controls
                autoPlay
                loop
                className="max-w-full max-h-[90vh] object-contain shadow-lg rounded-lg"
              ></video>
            ) : (
              // Hiển thị ảnh nếu là ảnh hoặc loại khác
              <img
                src={selectedImageToZoom.fileUrl}
                alt={selectedImageToZoom.eventName || 'Phóng to kỷ niệm'}
                className="max-w-full max-h-[90vh] object-contain shadow-lg rounded-lg"
              />
            )}
            <button
              onClick={() => setSelectedImageToZoom(null)}
              className="absolute top-4 right-4 text-white text-3xl bg-gray-800 bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition-colors"
            >
              &times; {/* Dấu X để đóng */}
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL CHI TIẾT CHIA TIỀN ===== */}
      {selectedCostSharingDetails && (userRole === 'admin') && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[95vh]">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center flex-shrink-0">
              Chi tiết chia tiền
            </h3>

            {(() => {
              // --- Bắt đầu khối tính toán ---
              const individualCostsMap = selectedCostSharingDetails.individualCosts || {};
              const totalBillAmount = selectedCostSharingDetails.relatedTotalBill || 0;

              const totalPaidAmount = Object.values(individualCostsMap)
                .filter(details => details.isPaid)
                .reduce((sum, details) => sum + (details.cost || 0), 0);
                
              const amountRemaining = totalBillAmount - totalPaidAmount;
              
              const paidPercentage = totalBillAmount > 0 ? (totalPaidAmount / totalBillAmount) * 100 : 0;
              // --- Kết thúc khối tính toán ---

              return (
                <>
                  {/* ===== KHỐI TIẾN ĐỘ THANH TOÁN MỚI ===== */}
                  <div className="mb-4 border-b pb-4 border-gray-200 dark:border-gray-700">
                    <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Tiến độ thanh toán
                    </h4>
                    <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-600 relative overflow-hidden">
                      <div
                        className="bg-green-500 h-4 rounded-full text-center text-white text-xs leading-4 flex items-center justify-center transition-all duration-500"
                        style={{ width: `${paidPercentage}%` }}
                      >
                        {Math.round(paidPercentage)}%
                      </div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2">
                      <span>Đã đóng: <strong>{totalPaidAmount.toLocaleString('vi-VN')} VND</strong></span>
                      <span>Còn lại: <strong>{amountRemaining.toLocaleString('vi-VN')} VND</strong></span>
                    </div>
                  </div>

                  {/* Phần hiển thị chi tiết */}
                  <div className="flex-grow overflow-y-auto">
                    <div className="space-y-3 text-gray-700 dark:text-gray-300">
                      <p><strong>Kỳ tính:</strong> {selectedCostSharingDetails.periodStart} đến {selectedCostSharingDetails.periodEnd}</p>
                      <p><strong>Ngày tính:</strong> {selectedCostSharingDetails.calculatedDate?.toLocaleDateString('vi-VN') || 'N/A'}</p>
                      <p><strong>Tổng ngày có mặt:</strong> {selectedCostSharingDetails.totalCalculatedDaysAllResidents} ngày</p>
                      <p><strong>Chi phí TB 1 ngày/người:</strong> {selectedCostSharingDetails.costPerDayPerPerson?.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} VND</p>
                      
                      <p className="text-xl font-bold border-t pt-3 mt-3 border-gray-300 dark:border-gray-600">
                        Số tiền mỗi người cần đóng:
                      </p>
                      
                      <div className="max-h-40 overflow-y-auto pr-2 border rounded-lg border-gray-200 dark:border-gray-700">
                        <ul className="space-y-2 py-2">
                          {Object.entries(individualCostsMap).map(([residentId, data]) => {
                            const residentName = residents.find(res => res.id === residentId)?.name || residentId;
                            return (
                              <li key={residentId} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded-lg">
                                <span>{residentName}:</span>
                                <div className="flex items-center">
                                    <span className="font-bold mr-2">{data.cost?.toLocaleString('vi-VN')} VND</span>
                                    <input
                                      type="checkbox"
                                      checked={data.isPaid || false}
                                      onChange={() => handleToggleIndividualPaymentStatus(selectedCostSharingDetails.id, residentId, data.isPaid || false)}
                                      className="form-checkbox h-5 w-5 text-green-600 dark:text-green-400 rounded cursor-pointer"
                                    />
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      <p className="text-lg font-bold border-t pt-3 mt-3 border-gray-300 dark:border-gray-600">
                        Quỹ phòng còn lại: 
                        <span className={`font-bold ${selectedCostSharingDetails.remainingFund >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                          {' '}{selectedCostSharingDetails.remainingFund?.toLocaleString('vi-VN')} VND
                        </span>
                      </p>
                    </div>
                    {/* ===== KHỐI NÚT BẤM MỚI - BẮT ĐẦU ===== */}
                    <div className="mt-6 flex-shrink-0 flex flex-col space-y-2">
                      {/* Nút Thanh toán Online */}
                      <button
                        onClick={() => window.open('https://tracuu.hcmue.edu.vn/ktx', '_blank')} // <-- THAY ĐỔI LINK Ở ĐÂY
                        className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-xl shadow-md hover:bg-green-700 transition-all"
                      >
                        <i className="fas fa-external-link-alt mr-2"></i>
                        Đi đến trang Thanh toán
                      </button>
                    </div>
                    {/* ===== KHỐI NÚT BẤM MỚI - KẾT THÚC ===== */}
                  </div>
                </>
              );
            })()}
            
            <button
              onClick={() => setSelectedCostSharingDetails(null)}
              className="mt-6 w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 flex-shrink-0"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL UPLOAD THAY ĐỔI AVATAR THÀNH VIÊN ===== */}
      {selectedResidentForAvatarUpload && userRole === 'admin' && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">
              Cập nhật ảnh đại diện cho {selectedResidentForAvatarUpload.fullName}
            </h3>
            <div className="flex flex-col items-center space-y-4">
              {selectedResidentForAvatarUpload.photoURL ? (
                <img
                  src={selectedResidentForAvatarUpload.photoURL}
                  alt="Current Avatar"
                  className="w-32 h-32 rounded-full object-cover shadow-lg border border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 text-6xl">
                  <i className="fas fa-user-circle"></i>
                </div>
              )}
              <div>
                <label htmlFor="avatarUploadModalInput" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                  Chọn ảnh mới:
                </label>
                <input
                  type="file"
                  id="avatarUploadModalInput"
                  accept="image/*"
                  onChange={(e) => {
                    setAvatarUploadModalFile(e.target.files[0]);
                    setAvatarUploadModalError('');
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              {isUploadingAvatarModal && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${avatarUploadModalProgress}%` }}
                  ></div>
                </div>
              )}
              {avatarUploadModalError && (
                <p className="text-red-500 text-sm text-center mt-2">{avatarUploadModalError}</p>
              )}
              <button
                onClick={() => handleUploadResidentAvatar(selectedResidentForAvatarUpload.id)}
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
                disabled={isUploadingAvatarModal || !avatarUploadModalFile}
              >
                {isUploadingAvatarModal ? (
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                ) : (
                  <i className="fas fa-upload mr-2"></i>
                )}
                Tải lên
              </button>
              <button
                onClick={() => {
                  setSelectedResidentForAvatarUpload(null);
                  setAvatarUploadModalFile(null);
                  setAvatarUploadModalError('');
                }}
                className="w-full px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-300"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL CRUD LỊCH TRÌNH CỦA ADMIN ===== */}
      {showGenerateScheduleModal &&
        userRole === 'admin' && ( // Chỉ hiển thị modal lịch trình cho admin
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">
                Tạo lịch trực phòng tự động
              </h3>
              <div className="space-y-4">
                <label
                  htmlFor="numDaysForSchedule"
                  className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                >
                  Số ngày bạn muốn tạo lịch:
                </label>
                <input
                  type="number"
                  id="numDaysForSchedule"
                  value={numDaysForSchedule}
                  onChange={(e) => setNumDaysForSchedule(parseInt(e.target.value) || 0)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700"
                  min="1"
                />
                <button
                  onClick={() => handleGenerateCleaningSchedule()}
                  className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 transition-all duration-300"
                  disabled={residents.filter((res) => res.isActive !== false).length === 0} // Vô hiệu hóa nếu không có cư dân hoạt động
                >
                  {isGeneratingSchedule ? (
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                  ) : (
                    <i className="fas fa-magic mr-2"></i>
                  )}
                  Tạo lịch
                </button>

                {generatedCleaningTasks.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">
                      Lịch đã tạo (Xem trước):
                    </h4>
                    <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-700">
                      <ul className="space-y-2">
                        {generatedCleaningTasks.map((task, index) => (
                          <li key={index} className="text-gray-700 dark:text-gray-300">
                            <strong>{task.date}:</strong> {task.taskName} - {task.assignedToResidentName}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={handleSaveGeneratedTasks}
                      className="w-full mt-4 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl shadow-md hover:bg-green-700 transition-all duration-300"
                    >
                      <i className="fas fa-save mr-2"></i> Lưu lịch đã tạo
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowGenerateScheduleModal(false);
                    setGeneratedCleaningTasks([]);
                    setAuthError('');
                  }}
                  className="w-full mt-4 px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-300"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
      )}

      {/* ===== MODAL CRUD THÔNG BÁO ===== */}
      {showNotificationsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">Thông báo</h3>
            {notificationError && <p className="text-red-500 text-sm text-center mb-4">{notificationError}</p>}
            {notifications.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa có thông báo nào.</p>
            ) : (
              <ul className="space-y-4">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`p-4 rounded-xl shadow-sm border ${notification.isRead ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600' : 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700'} flex justify-between items-start cursor-pointer transition-all duration-200`}
                    onClick={() => !notification.isRead && markNotificationAsRead(notification.id)} // Đánh dấu đã đọc khi nhấp vào
                  >
                    <div className="flex-1">
                      <p
                        className={`font-semibold ${notification.isRead ? 'text-gray-800 dark:text-gray-300' : 'text-blue-800 dark:text-blue-200'}`}
                      >
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <i className="fas fa-clock mr-1"></i>
                        {notification.createdAt instanceof Date
                          ? notification.createdAt.toLocaleString('vi-VN')
                          : 'Đang tải...'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Loại: {notification.type}</p>
                    </div>
                    {userRole === 'admin' && ( // Chỉ admin mới có nút xóa
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }} // Ngăn chặn sự kiện nổi bọt
                        className="ml-4 p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-800 rounded-full transition-colors"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setShowNotificationsModal(false)}
              className="mt-6 w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL XEM CHI TIẾT THÔNG BÁO ===== */}
      {selectedNotificationDetails && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">Chi tiết thông báo</h3>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <p>
                <strong>Tiêu đề:</strong> {selectedNotificationDetails.title || 'Không có tiêu đề'}
              </p>{' '}
              {/* Có thể có title nếu bạn thêm vào hàm createNotification */}
              <p>
                <strong>Nội dung:</strong> {selectedNotificationDetails.message}
              </p>
              <p>
                <strong>Loại:</strong> {selectedNotificationDetails.type}
              </p>
              <p>
                <strong>Người gửi:</strong> {selectedNotificationDetails.createdBy || 'Hệ thống'}
              </p>{' '}
              {/* Bạn có thể cần tìm tên người gửi nếu cần */}
              <p>
                <strong>Người nhận:</strong>{' '}
                {selectedNotificationDetails.recipientId === 'all'
                  ? 'Tất cả'
                  : allUsersData.find((u) => u.id === selectedNotificationDetails.recipientId)?.fullName ||
                    selectedNotificationDetails.recipientId}
              </p>
              <p>
                <strong>Thời gian:</strong>{' '}
                {selectedNotificationDetails.createdAt instanceof Date
                  ? selectedNotificationDetails.createdAt.toLocaleString('vi-VN')
                  : 'N/A'}
              </p>
              <p>
                <strong>Trạng thái:</strong>
                <span
                  className={`ml-2 px-2 py-1 rounded-full text-sm ${selectedNotificationDetails.isRead ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}
                >
                  {selectedNotificationDetails.isRead ? 'Đã đọc' : 'Chưa đọc'}
                </span>
              </p>
            </div>
            <button
              onClick={() => setSelectedNotificationDetails(null)}
              className="mt-6 w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL CHỈNH SỬA THÔNG TIN CÁ NHÂN CỦA THÀNH VIÊN ===== */}
      {editingCommonResidentData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">
              Điều chỉnh thông tin thành viên
            </h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="editCommonFullNameInput"
                  className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                >
                  Họ tên:
                </label>
                <input
                  type="text"
                  id="editCommonFullNameInput"
                  value={editCommonFullName}
                  onChange={(e) => setEditCommonFullName(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>
              {editingCommonResidentUserLinkedData && ( // Chỉ hiển thị nếu có user liên kết
                <div>
                  <label
                    htmlFor="editCommonEmailInput"
                    className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                  >
                    Email (Tài khoản):
                  </label>
                  <input
                    type="email"
                    id="editCommonEmailInput"
                    value={editCommonEmail}
                    readOnly // Thường không cho phép chỉnh sửa email tài khoản ở đây
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                  />
                </div>
              )}
              <div>
                <label
                  htmlFor="editCommonPhoneNumber"
                  className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                >
                  Số điện thoại:
                </label>
                <input
                  type="text"
                  id="editCommonPhoneNumber"
                  value={editCommonPhoneNumber}
                  onChange={(e) => setEditCommonPhoneNumber(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label
                  htmlFor="editCommonAcademicLevel"
                  className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                >
                  Email trường:
                </label>
                <input
                  type="text"
                  id="editCommonAcademicLevel"
                  value={editCommonAcademicLevel}
                  onChange={(e) => setEditCommonAcademicLevel(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label
                  htmlFor="editCommonDormEntryDate"
                  className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                >
                  Ngày nhập KTX:
                </label>
                <input
                  type="date"
                  id="editCommonDormEntryDate"
                  value={editCommonDormEntryDate}
                  onChange={(e) => setEditCommonDormEntryDate(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label
                  htmlFor="editCommonBirthday"
                  className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                >
                  Ngày sinh:
                </label>
                <input
                  type="date"
                  id="editCommonBirthday"
                  value={editCommonBirthday}
                  onChange={(e) => setEditCommonBirthday(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label
                  htmlFor="editCommonStudentId"
                  className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                >
                  Mã số sinh viên:
                </label>
                <input
                  type="text"
                  id="editCommonStudentId"
                  value={editCommonStudentId}
                  onChange={(e) => setEditCommonStudentId(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>
              {/* Thông báo lỗi */}
              {authError && <p className="text-red-500 text-sm text-center mt-4">{authError}</p>}
              {/* Thông báo thành công */}
              {updateSuccessMessage && <p className="text-green-600 text-sm text-center mt-4">{updateSuccessMessage}</p>}
              <div className="flex justify-between space-x-4 mt-6">
                <button
                  onClick={handleUpdateCommonResidentDetails}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
                >
                  <i className="fas fa-save mr-2"></i> Lưu thay đổi
                </button>
                <button
                  onClick={handleCancelCommonResidentEdit}
                  className="flex-1 px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-300"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL CHỈNH SỬA THÔNG TIN CÁ NHÂN CỦA TIỀN BỐI ===== */}
      {editingFormerResident && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">
              Chỉnh sửa thông tin tiền bối
            </h3>
            <div className="flex-1 overflow-y-auto pr-2">
              <form onSubmit={handleUpdateFormerResident} className="space-y-4">
                <div>
                  <label htmlFor="editFormerName" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Họ tên:</label>
                  <input
                    type="text"
                    id="editFormerName"
                    value={editingFormerResident.name}
                    onChange={(e) => setEditingFormerResident({ ...editingFormerResident, name: e.target.value })}
                    className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="editFormerEmail" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Email:</label>
                  <input
                    type="email"
                    id="editFormerEmail"
                    value={editingFormerResident.email}
                    onChange={(e) => setEditingFormerResident({ ...editingFormerResident, email: e.target.value })}
                    className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="editFormerPhone" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">SĐT:</label>
                  <input
                    type="text"
                    id="editFormerPhone"
                    value={editingFormerResident.phoneNumber}
                    onChange={(e) => setEditingFormerResident({ ...editingFormerResident, phoneNumber: e.target.value })}
                    className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="editFormerStudentId" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">MSSV:</label>
                  <input
                    type="text"
                    id="editFormerStudentId"
                    value={editingFormerResident.studentId}
                    onChange={(e) => setEditingFormerResident({ ...editingFormerResident, studentId: e.target.value })}
                    className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="editFormerBirthday" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày sinh:</label>
                  <input
                    type="date"
                    id="editFormerBirthday"
                    value={editingFormerResident.birthday}
                    onChange={(e) => setEditingFormerResident({ ...editingFormerResident, birthday: e.target.value })}
                    className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="editFormerDormEntryDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày nhập KTX:</label>
                  <input
                    type="date"
                    id="editFormerDormEntryDate"
                    value={editingFormerResident.dormEntryDate}
                    onChange={(e) => setEditingFormerResident({ ...editingFormerResident, dormEntryDate: e.target.value })}
                    className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="editFormerAcademicLevel" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Cấp:</label>
                  <input
                    type="text"
                    id="editFormerAcademicLevel"
                    value={editingFormerResident.academicLevel}
                    onChange={(e) => setEditingFormerResident({ ...editingFormerResident, academicLevel: e.target.value })}
                    className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="editFormerDeactivatedDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày ra khỏi phòng:</label>
                  <input
                    type="date"
                    id="editFormerDeactivatedDate"
                    value={editingFormerResident.deactivatedAt}
                    onChange={(e) => setEditingFormerResident({ ...editingFormerResident, deactivatedAt: e.target.value })}
                    className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="editFormerContact" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Thông tin liên hệ:</label>
                  <input
                    type="text"
                    id="editFormerContact"
                    value={editingFormerResident.contact}
                    onChange={(e) => setEditingFormerResident({ ...editingFormerResident, contact: e.target.value })}
                    className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="editFormerNotes" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ghi chú:</label>
                  <textarea
                    id="editFormerNotes"
                    value={editingFormerResident.notes}
                    onChange={(e) => setEditingFormerResident({ ...editingFormerResident, notes: e.target.value })}
                    className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                  ></textarea>
                </div>

                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 mr-4">
                    {editingFormerResident?.photoURL ? (
                      <img
                        src={editingFormerResident.photoURL}
                        alt="Avatar hiện tại"
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 text-2xl">
                        <i className="fas fa-user-circle"></i>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">Avatar hiện tại</p>
                  </div>
                  <div>
                    <label htmlFor="editFormerAvatar" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                      Chọn avatar mới (tùy chọn):
                    </label>
                    <input
                      type="file"
                      id="editFormerAvatar"
                      accept="image/*"
                      onChange={(e) => setEditingFormerResidentAvatarFile(e.target.files && e.target.files.length > 0 ? e.target.files : null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {isUploadingEditingFormerResidentAvatar && (
                      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadEditingFormerResidentAvatarProgress}%` }}></div>
                      </div>
                    )}
                    {uploadEditingFormerResidentAvatarProgress > 0 && uploadEditingFormerResidentAvatarProgress < 100 && (
                      <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 text-right">{uploadEditingFormerResidentAvatarProgress}% tải lên</p>
                    )}
                  </div>
                </div>

                {authError && <p className="text-red-500 text-sm text-center mt-4">{authError}</p>}
                
                <div className="flex justify-between space-x-4 mt-6">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700"
                  >
                    <i className="fas fa-save mr-2"></i> Lưu thay đổi
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingFormerResident(null); setAuthError(''); }}
                    className="flex-1 px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL QUÊN MẬT KHẨU ===== */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">Quên mật khẩu</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-center">
              Nhập email của bạn để nhận liên kết đặt lại mật khẩu.
            </p>
            <input
              type="email"
              placeholder="Email của bạn"
              value={forgotPasswordEmail}
              onChange={(e) => setForgotPasswordEmail(e.target.value)}
              className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 mb-4"
            />
            {forgotPasswordMessage && (
              <p
                className={`text-sm text-center mb-4 ${forgotPasswordMessage.includes('Lỗi') ? 'text-red-500' : 'text-green-600'}`}
              >
                {forgotPasswordMessage}
              </p>
            )}
            <button
              onClick={handleForgotPassword}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 mb-4"
            >
              Gửi liên kết đặt lại
            </button>
            <button
              onClick={() => {
                setShowForgotPasswordModal(false);
                setForgotPasswordMessage('');
                setForgotPasswordEmail('');
              }}
              className="w-full px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-300"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL CHI TIẾT GÓP Ý (ADMIN) ===== */}
      {selectedFeedbackDetails && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedFeedbackDetails(null)} // Đóng khi bấm ra ngoài
        >
          <div 
            className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()} // Ngăn không cho popup tự đóng khi bấm vào bên trong
          >
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex-shrink-0">
              Chi tiết góp ý
            </h3>
            
            {/* Khung nội dung có thể cuộn */}
            <div className="flex-1 overflow-y-auto pr-2 border-t border-b py-4 border-gray-200 dark:border-gray-700">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {selectedFeedbackDetails.content}
              </p>
            </div>
            
            {/* Thông tin người gửi */}
            <div className="mt-4 pt-4 text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
              <p><strong>Người gửi:</strong> {selectedFeedbackDetails.submittedByName}</p>
              <p><strong>Thời gian:</strong> {selectedFeedbackDetails.submittedAt?.toDate().toLocaleString('vi-VN')}</p>
            </div>
            
            <button 
              onClick={() => setSelectedFeedbackDetails(null)}
              className="w-full mt-6 p-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex-shrink-0"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Font Awesome for icons */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css" />
    </div>
  );
}

export default App;