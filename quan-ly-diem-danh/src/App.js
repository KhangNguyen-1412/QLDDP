import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword
} from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, query, addDoc, serverTimestamp, deleteDoc, getDocs, where, getDoc, updateDoc, orderBy  } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'; // Thêm imports cho Firebase Storage
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Firebase Config - Moved outside the component to be a constant
const firebaseConfig = {
  apiKey: "AIzaSyBMx17aRieYRxF2DiUfVzC7iJPXOJwNiy0",
  authDomain: "qlddv2.firebaseapp.com",
  projectId: "qlddv2",
  storageBucket: "qlddv2.firebasestorage.app",
  messagingSenderId: "946810652108",
  appId: "1:946810652108:web:a4b75fe67c41ba132c0969",
  measurementId: "G-0G06LXY4D8"
};

// currentAppId should consistently be the projectId - Moved outside the component
const currentAppId = firebaseConfig.projectId;

function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loggedInResidentProfile, setLoggedInResidentProfile] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [residents, setResidents] = useState([]);
  const [newResidentName, setNewResidentName] = useState('');
  const [showInactiveResidents, setShowInactiveResidents] = useState(false);

  const [currentElectricityReading, setCurrentElectricityReading] = useState('');
  const [currentWaterReading, setCurrentWaterReading] = useState('');

  const [lastElectricityReading, setLastElectricityReading] = useState(0);
  const [lastWaterReading, setLastWaterReading] = useState(0);

  const [electricityCost, setElectricityCost] = useState(0);
  const [waterCost, setWaterCost] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

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

  // New states for member's editable profile
  const [memberPhoneNumber, setMemberPhoneNumber] = useState('');
  const [memberAcademicLevel, setMemberAcademicLevel] = useState('');
  const [memberDormEntryDate, setMemberDormEntryDate] = useState('');
  const [memberBirthday, setMemberBirthday] = useState('');
  const [memberStudentId, setMemberStudentId] = useState('');
  const [editProfileMode, setEditProfileMode] = useState(false);

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

  // State for Room Memories
  const [memories, setMemories] = useState([]);
  const [newMemoryEventName, setNewMemoryEventName] = useState('');
  const [newMemoryPhotoDate, setNewMemoryPhotoDate] = useState('');
  const [newMemoryImageFile, setNewMemoryImageFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingMemory, setIsUploadingMemory] = useState(false);
  const [memoryError, setMemoryError] = useState('');

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
  const [activeSection, setActiveSection] = useState('residentManagement');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const hasInitialized = useRef(false);

  const [selectedNotificationDetails, setSelectedNotificationDetails] = useState(null); // Mới: Để hiển thị chi tiết thông báo

  // New state for Image Lightbox/Zoom
  const [selectedImageToZoom, setSelectedImageToZoom] = useState(null); // Lưu URL của ảnh muốn phóng to


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
      console.log("Firebase đã được khởi tạo trước đó. Bỏ qua.");
      return;
    }
    hasInitialized.current = true;
    console.log("Bắt đầu khởi tạo Firebase...");

    try {
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error("Cấu hình Firebase bị thiếu hoặc rỗng. Vui lòng kiểm tra lại cấu hình.");
        setIsAuthReady(true);
        return;
      }

      let app;
      if (getApps().length === 0) { // Kiểm tra nếu chưa có ứng dụng Firebase nào được khởi tạo
        app = initializeApp(firebaseConfig);
        console.log("2. Firebase app đã được khởi tạo:", app.name);
      } else {
        app = getApp(); // Lấy ứng dụng Firebase đã tồn tại
        console.log("2. Đã sử dụng Firebase app hiện có:", app.name);
      }

      const firestoreDb = getFirestore(app);
      console.log("3. Firestore đã được thiết lập.");

      const firebaseAuth = getAuth(app);
      console.log("4. Firebase Auth đã được thiết lập.");

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      // Add these logs to verify initialization
      console.log("DEBUG INIT: db object after setDb:", firestoreDb);
      console.log("DEBUG INIT: auth object after setAuth:", firebaseAuth);

      console.log("5. setDb và setAuth đã được gọi. Đang chờ onAuthStateChanged...");

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        console.log("6. onAuthStateChanged đã được kích hoạt. Người dùng hiện tại:", user ? user.uid : 'null');
        if (user) {
          setUserId(user.uid);
          console.log("7. Người dùng đã xác thực (UID):", user.uid);

          // Lấy vai trò người dùng và fullName từ Firestore
          const userDocRef = doc(firestoreDb, `artifacts/${currentAppId}/public/data/users`, user.uid);
          const userDocSnap = await getDoc(userDocRef);
          let fetchedRole = 'member'; // Mặc định là member
          let fetchedFullName = user.email; // Mặc định là email nếu không có fullName
          let linkedResidentId = null; // ID cư dân được liên kết

          // New fields
          let fetchedPhoneNumber = '';
          let fetchedAcademicLevel = '';
          let fetchedDormEntryDate = '';
          let fetchedBirthday = '';
          let fetchedStudentId = '';


          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.role) {
              fetchedRole = userData.role;
            }
            if (userData.fullName) {
              fetchedFullName = userData.fullName;
            }
            if (userData.linkedResidentId) {
              linkedResidentId = userData.linkedResidentId;
            }
            // Fetch new fields
            fetchedPhoneNumber = userData.phoneNumber || '';
            fetchedAcademicLevel = userData.academicLevel || '';
            fetchedDormEntryDate = userData.dormEntryDate || '';
            fetchedBirthday = userData.birthday || '';
            fetchedStudentId = userData.studentId || '';

          } else {
            // Nếu tài liệu người dùng không tồn tại, tạo nó với vai trò mặc định
            await setDoc(userDocRef, { email: user.email, fullName: user.email, role: 'member', createdAt: serverTimestamp() }, { merge: true });
          }
          setUserRole(fetchedRole);
          setFullName(fetchedFullName); // Cập nhật fullName cho state
          console.log("8. Vai trò người dùng:", fetchedRole);

          // Set states for editable profile fields
          setMemberPhoneNumber(fetchedPhoneNumber);
          setMemberAcademicLevel(fetchedAcademicLevel);
          setMemberDormEntryDate(fetchedDormEntryDate);
          setMemberBirthday(fetchedBirthday);
          setMemberStudentId(fetchedStudentId);


          // Tìm hồ sơ cư dân được liên kết
          const residentsCollectionRef = collection(firestoreDb, `artifacts/${currentAppId}/public/data/residents`);
          let currentLoggedInResidentProfile = null;

          if (linkedResidentId) {
            // Ưu tiên tìm theo linkedResidentId đã lưu trong tài liệu người dùng
            const residentDoc = await getDoc(doc(residentsCollectionRef, linkedResidentId));
            if (residentDoc.exists()) {
              currentLoggedInResidentProfile = { id: residentDoc.id, ...residentDoc.data() };
              console.log("9. Hồ sơ cư dân được liên kết (từ linkedResidentId):", currentLoggedInResidentProfile.name);
            } else {
              console.log("9. linkedResidentId trong tài liệu người dùng không hợp lệ hoặc cư dân không tồn tại.");
              linkedResidentId = null; // Đặt lại nếu không tìm thấy
            }
          }

          if (!currentLoggedInResidentProfile && fetchedFullName) {
            // Nếu chưa có hồ sơ cư dân liên kết, thử tìm theo tên đầy đủ
            const qResidentByName = query(residentsCollectionRef, where("name", "==", fetchedFullName));
            const residentSnapByName = await getDocs(qResidentByName);

            if (!residentSnapByName.empty) {
              const matchedResident = residentSnapByName.docs[0];
              // Chỉ liên kết nếu cư dân chưa được liên kết với người dùng khác
              if (!matchedResident.data().linkedUserId || matchedResident.data().linkedUserId === user.uid) {
                // Cập nhật tài liệu người dùng để lưu linkedResidentId
                await updateDoc(userDocRef, { linkedResidentId: matchedResident.id });
                currentLoggedInResidentProfile = { id: matchedResident.id, ...matchedResident.data() };
                console.log("9. Đã tìm và liên kết hồ sơ cư dân theo tên:", currentLoggedInResidentProfile.name);
              } else {
                console.log(`Cư dân "${fetchedFullName}" đã được liên kết với một người dùng khác.`);
              }
            } else {
              console.log(`Không tìm thấy hồ sơ cư dân có tên "${fetchedFullName}".`);
            }
          }
          setLoggedInResidentProfile(currentLoggedInResidentProfile);
          console.log(`DEBUG AUTH: User ID: ${user.uid}, User Role: ${fetchedRole}, Linked Resident: ${currentLoggedInResidentProfile ? currentLoggedInResidentProfile.name : 'None'}`);
        } else {
          setUserId(null);
          setUserRole(null); // Xóa vai trò khi đăng xuất
          setLoggedInResidentProfile(null); // Xóa hồ sơ cư dân liên kết
          setActiveSection('dashboard'); // Đặt lại phần hoạt động
          // Reset profile edit states
          setFullName('');
          setEmail('');
          setPassword('');
          setMemberPhoneNumber('');
          setMemberAcademicLevel('');
          setMemberDormEntryDate('');
          setMemberBirthday('');
          setMemberStudentId('');
        }
        setIsAuthReady(true);
        console.log("9. Trạng thái xác thực Firebase đã sẵn sàng: ", true);
      });

      return () => {
        console.log("Hủy đăng ký lắng nghe trạng thái xác thực.");
        unsubscribe();
      };
    } catch (error) {
      console.error("Lỗi nghiêm trọng khi khởi tạo Firebase (tổng thể):", error);
      setIsAuthReady(true);
    }
  }, []); // Không cần userRole trong dependency array này vì nó được xử lý nội bộ

  // ... (các hàm xử lý khác của bạn, ví dụ: createNotification) ...

// Mới: Hàm để admin gửi thông báo tùy chỉnh
const handleSendCustomNotification = async (e) => {
  e.preventDefault();
  setCustomNotificationError('');
  setCustomNotificationSuccess('');

  if (!db || !userId || userRole !== 'admin') {
      setCustomNotificationError("Bạn không có quyền gửi thông báo tùy chỉnh.");
      return;
  }
  if (!newNotificationMessage.trim()) {
      setCustomNotificationError("Nội dung thông báo không được để trống.");
      return;
  }
  if (newNotificationRecipient !== 'all' && !allUsersData.find(u => u.id === newNotificationRecipient)) {
      setCustomNotificationError("Người nhận không hợp lệ. Vui lòng chọn lại.");
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
          notificationTitle // Truyền title vào đây
      );

      setCustomNotificationSuccess("Thông báo đã được gửi thành công!");
      setNewNotificationTitle('');
      setNewNotificationMessage('');
      setNewNotificationRecipient('all');
      setNewNotificationType('general');
  } catch (error) {
      console.error("Lỗi khi gửi thông báo tùy chỉnh:", error);
      setCustomNotificationError(`Lỗi khi gửi thông báo: ${error.message}`);
  }
};

  // --- Các hàm xác thực ---
  const handleSignUp = async () => {
    setAuthError('');
    if (!auth || !db) { // Đảm bảo db cũng sẵn sàng
      setAuthError("Hệ thống xác thực chưa sẵn sàng.");
      return;
    }
    if (email.trim() === '' || password.trim() === '' || fullName.trim() === '') { // Validate full name
      setAuthError("Vui lòng nhập Email, Mật khẩu và Họ tên đầy đủ.");
      return;
    }
    try {
      // Kiểm tra xem tên đầy đủ đã được liên kết với một cư dân khác chưa
      const residentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/residents`);
      const qResidentByName = query(residentsCollectionRef, where("name", "==", fullName.trim()));
      const residentSnapByNameCheck = await getDocs(qResidentByName);

      if (!residentSnapByNameCheck.empty) {
        const matchedResidentCheck = residentSnapByNameCheck.docs[0];
        if (matchedResidentCheck.data().linkedUserId) {
          setAuthError(`Họ tên "${fullName.trim()}" đã được liên kết với một tài khoản khác. Vui lòng sử dụng họ tên khác hoặc liên hệ quản trị viên.`);
          return;
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("Đăng ký thành công!");

      // Sau khi đăng ký thành công, tạo tài liệu người dùng trong Firestore
      await setDoc(doc(db, `artifacts/${currentAppId}/public/data/users`, userCredential.user.uid), {
        email: userCredential.user.email,
        fullName: fullName.trim(), // Save full name
        role: 'member', // Vai trò mặc định cho người đăng ký mới
        createdAt: serverTimestamp()
      });

      // Cố gắng liên kết với một cư dân hiện có theo tên (lần nữa, sau khi đã kiểm tra)
      // Lần này chỉ để cập nhật linkedUserId trong tài liệu cư dân nếu nó chưa được liên kết
      if (!residentSnapByNameCheck.empty) { // Nếu tìm thấy cư dân trùng tên
        const matchedResident = residentSnapByNameCheck.docs[0];
        await updateDoc(doc(db, `artifacts/${currentAppId}/public/data/users`, userCredential.user.uid), { linkedResidentId: matchedResident.id });
        console.log(`Đã liên kết cư dân "${fullName.trim()}" với người dùng mới đăng ký.`);
      } else {
        console.log(`Không tìm thấy cư dân có tên "${fullName.trim()}". Admin có thể cần thêm/liên kết thủ công.`);
      }

      setUserRole('member'); // Đặt vai trò ngay lập lập tức trong trạng thái
    } catch (error) {
      console.error("Lỗi đăng ký:", error.code, error.message);
      setAuthError(`Lỗi đăng ký: ${error.message}`);
    }
  };

  const handleSignIn = async () => {
    setAuthError('');
    if (!auth) {
      setAuthError("Hệ thống xác thực chưa sẵn sàng.");
      return;
    }
    if (email.trim() === '' || password.trim() === '') {
      setAuthError("Vui lòng nhập Email và Mật khẩu.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("Đăng nhập thành công!");
      // Vai trò và hồ sơ cư dân sẽ được lấy bởi trình lắng nghe onAuthStateChanged
    } catch (error) {
      console.error("Lỗi đăng nhập:", error.code, error.message);
      setAuthError(`Lỗi đăng nhập: ${error.message}`);
    }
  };

  const handleSignOut = async () => {
    setAuthError('');
    if (!auth) return;
    try {
      await signOut(auth);
      console.log("Đăng xuất thành công!");
      setUserId(null); // Đảm bảo userId cũng được đặt lại
      setUserRole(null); // Xóa vai trò khi đăng xuất
      setLoggedInResidentProfile(null); // Xóa hồ sơ cư dân liên kết
      setActiveSection('dashboard'); // Đặt lại phần hoạt động
    } catch (error) {
      console.error("Lỗi đăng xuất:", error.code, error.message);
      setAuthError(`Lỗi đăng xuất: ${error.message}`);
    }
  };

  // New: Handle forgot password
  const handleForgotPassword = async () => {
    setForgotPasswordMessage('');
    if (!auth) {
      setForgotPasswordMessage("Hệ thống xác thực chưa sẵn sàng.");
      return;
    }
    if (forgotPasswordEmail.trim() === '') {
      setForgotPasswordMessage("Vui lòng nhập Email của bạn.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, forgotPasswordEmail.trim());
      setForgotPasswordMessage("Đã gửi liên kết đặt lại mật khẩu đến email của bạn. Vui lòng kiểm tra hộp thư đến.");
      setForgotPasswordEmail(''); // Clear email input
    } catch (error) {
      console.error("Lỗi quên mật khẩu:", error.code, error.message);
      setForgotPasswordMessage(`Lỗi: ${error.message}`);
    }
  };

  // New: Handle saving user profile (for both member and admin)
  const handleSaveUserProfile = async () => {
    setAuthError('');
    // Kiểm tra cơ bản
    if (!db || !userId) {
      setAuthError("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      return;
    }

    const userDocRef = doc(db, `artifacts/${currentAppId}/public/data/users`, userId);
    let residentDocRef = null;

    // Nếu có hồ sơ cư dân liên kết (áp dụng cho cả member và admin có liên kết)
    if (loggedInResidentProfile) {
      residentDocRef = doc(db, `artifacts/${currentAppId}/public/data/residents`, loggedInResidentProfile.id);
    }

    try {
      // 1. Cập nhật thông tin cá nhân của người dùng trong tài liệu user
      const userDataToUpdate = {
        fullName: fullName.trim(),
        phoneNumber: memberPhoneNumber.trim(),
        academicLevel: memberAcademicLevel.trim(),
        dormEntryDate: memberDormEntryDate.trim(),
        birthday: memberBirthday.trim(),
        studentId: memberStudentId.trim()
      };
      await updateDoc(userDocRef, userDataToUpdate);
      console.log("Đã cập nhật tài liệu người dùng thành công!");

      // 2. Cập nhật tên trong tài liệu resident nếu là Admin VÀ có linkedResidentProfile
      // Chỉ admin mới có quyền ghi vào residents, và chỉ khi có hồ sơ cư dân liên kết
      if (userRole === 'admin' && residentDocRef && loggedInResidentProfile.name !== fullName.trim()) {
         await updateDoc(residentDocRef, { name: fullName.trim() });
         console.log("Đã cập nhật tên cư dân liên kết thành công!");
      }

      setAuthError("Thông tin cá nhân đã được cập nhật thành công!");
      setEditProfileMode(false); // Thoát chế độ chỉnh sửa (nếu đang ở chế độ thành viên)

      // Cập nhật trạng thái loggedInResidentProfile cục bộ nếu tên cư dân đã thay đổi
      // Điều này quan trọng để UI phản ánh ngay lập tức thay đổi tên
      if (loggedInResidentProfile && loggedInResidentProfile.name !== fullName.trim()) {
          setLoggedInResidentProfile(prevProfile => ({
              ...prevProfile,
              name: fullName.trim()
          }));
      }

    } catch (error) {
      console.error("Lỗi khi cập nhật thông tin cá nhân:", error);
      setAuthError(`Lỗi khi cập nhật thông tin cá nhân: ${error.message}`);
    }
  };

  // Mới: Hàm để thêm một kỷ niệm mới
// Trong hàm handleAddMemory
const handleAddMemory = async (e) => {
  e.preventDefault();
  setMemoryError('');
  if (!db || !auth || !newMemoryEventName || !newMemoryPhotoDate || !newMemoryImageFile) {
    setMemoryError("Vui lòng điền đầy đủ thông tin và chọn ảnh.");
    return;
  }
  if (!userId) {
    setMemoryError("Bạn cần đăng nhập để đăng kỷ niệm.");
    return;
  }

  setIsUploadingMemory(true); // Bắt đầu trạng thái đang tải lên
  setUploadProgress(0); // Đặt lại tiến trình

  try {
    // ===============================================
    // BẮT ĐẦU: UPLOAD LÊN CLOUDINARY BẰNG AXIOS
    // ===============================================
    const CLOUDINARY_CLOUD_NAME = "dzvcgfkxs"; // Thay bằng Cloud Name của bạn
    const CLOUDINARY_UPLOAD_PRESET = "qun_ly_phong"; // Thay bằng Upload Preset của bạn
    const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

    const formData = new FormData();
    formData.append('file', newMemoryImageFile); // newMemoryImageFile là File object
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await axios.post(CLOUDINARY_API_URL, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percentCompleted);
      },
    });

    const imageUrl = response.data.secure_url; // URL ảnh từ Cloudinary
    const publicId = response.data.public_id; // Public ID từ Cloudinary (quan trọng để xóa)
    console.log('Ảnh có sẵn tại:', imageUrl, 'Public ID:', publicId);
    // ===============================================
    // KẾT THÚC: UPLOAD LÊN CLOUDINARY BẰNG AXIOS
    // ===============================================

    // Tiếp tục lưu metadata vào Firestore như cũ
    const memoriesCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/memories`);
    await addDoc(memoriesCollectionRef, {
      eventName: newMemoryEventName.trim(),
      photoDate: newMemoryPhotoDate,
      imageUrl: imageUrl, // Sử dụng URL từ Cloudinary
      publicId: publicId, // LƯU publicId VÀO FIRESTORE
      uploadedBy: userId,
      uploadedAt: serverTimestamp(),
      uploadedByName: loggedInResidentProfile ? loggedInResidentProfile.name : (allUsersData.find(u => u.id === userId)?.fullName || 'Người dùng ẩn danh')
    });

    // Reset form và trạng thái
    setNewMemoryEventName('');
    setNewMemoryPhotoDate('');
    setNewMemoryImageFile(null);
    setUploadProgress(0);
    setIsUploadingMemory(false);
    setMemoryError(''); // Xóa lỗi sau khi thành công
    alert("Đã thêm kỷ niệm mới thành công!");
    console.log("Đã thêm kỷ niệm mới thành công!");

  } catch (error) {
    console.error("Lỗi khi thêm kỷ niệm (tổng thể):", error);
    setMemoryError(`Lỗi khi thêm kỷ niệm: ${error.message}`);
    setIsUploadingMemory(false);
  }
};

  // Mới: Hàm để xóa một kỷ niệm (chỉ admin)
// Trong hàm handleDeleteMemory
const handleDeleteMemory = async (memoryId, imageUrl, publicId) => { // Giữ publicId
  setMemoryError('');
  if (!db || !userId || userRole !== 'admin') {
      setMemoryError("Bạn không có quyền xóa kỷ niệm.");
      return;
  }
  if (!window.confirm("Bạn có chắc chắn muốn xóa kỷ niệm này không?")) {
      return;
  }

  try {
      // Xóa tài liệu Firestore trước
      await deleteDoc(doc(db, `artifacts/${currentAppId}/public/data/memories`, memoryId));

      // ===============================================
      // BẮT ĐẦU: XÓA ẢNH TỪ CLOUDINARY QUA CLOUD FUNCTION (KHUYẾN NGHỊ)
      // ===============================================
      if (publicId) {
          console.log(`Đang cố gắng xóa ảnh Cloudinary với publicId: ${publicId}`);
          // Đây là placeholder cho việc gọi Cloud Function của bạn
          // Bạn cần tạo một Cloud Function để xử lý việc xóa ảnh Cloudinary an toàn
          // Ví dụ: await axios.post('/api/deleteCloudinaryImage', { publicId: publicId, userId: userId });
          alert("Chức năng xóa ảnh trên Cloudinary yêu cầu triển khai Cloud Function. Ảnh đã được xóa khỏi danh sách.");
      }
      // ===============================================
      // KẾT THÚC: XÓA ẢNH TỪ CLOUDINARY QUA CLOUD FUNCTION
      // ===============================================

      console.log(`Đã xóa kỷ niệm ${memoryId} và ảnh liên quan (nếu có).`);
  } catch (error) {
      console.error("Lỗi khi xóa kỷ niệm:", error);
      setMemoryError(`Lỗi khi xóa kỷ niệm: ${error.message}`);
  }
};

  // Mới: Hàm để chuyển một người dùng/cư dân sang danh sách tiền bối (chỉ admin)
  const handleMoveToFormerResidents = async (residentId, userIdToDeactivate) => {
    setAuthError(''); // Reset authError
    if (!db || !userId || userRole !== 'admin') {
        setAuthError("Bạn không có quyền thực hiện thao tác này.");
        return;
    }

    if (!window.confirm("Bạn có chắc chắn muốn vô hiệu hóa người này và chuyển họ vào danh sách tiền bối không?")) {
        return;
    }

    try {
        // Lấy thông tin người dùng và cư dân
        const userDocRef = userIdToDeactivate ? doc(db, `artifacts/${currentAppId}/public/data/users`, userIdToDeactivate) : null;
        const residentDocRef = doc(db, `artifacts/${currentAppId}/public/data/residents`, residentId);

        let residentData = null;
        const residentSnap = await getDoc(residentDocRef);
        if (residentSnap.exists()) {
            residentData = residentSnap.data();
        } else {
            setAuthError("Không tìm thấy hồ sơ cư dân để chuyển đổi.");
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
                deactivatedAt: serverTimestamp()
            });
            console.log(`Đã vô hiệu hóa tài khoản người dùng ${userData.email}`);
        }

        // 2. Vô hiệu hóa hồ sơ cư dân hiện tại
        await updateDoc(residentDocRef, {
            isActive: false,
            linkedUserId: null // Hủy liên kết người dùng
        });
        console.log(`Đã vô hiệu hóa hồ sơ cư dân ${residentData.name}`);


        // 3. Chuyển thông tin vào collection 'formerResidents'
        const formerResidentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/formerResidents`);
        await setDoc(doc(formerResidentsCollectionRef, residentId), { // Dùng residentId làm doc ID
            name: residentData.name,
            email: userData?.email || null, // Lấy email từ user data nếu có
            phoneNumber: userData?.phoneNumber || null,
            studentId: userData?.studentId || null,
            birthday: userData?.birthday || null,
            dormEntryDate: userData?.dormEntryDate || null,
            academicLevel: userData?.academicLevel || null,
            originalUserId: userIdToDeactivate,
            deactivatedAt: serverTimestamp(),
            reasonForDeparture: 'Đã chuyển đi' // Có thể thêm input cho lý do
        }, { merge: true }); // Dùng merge để không ghi đè nếu đã tồn tại

        setAuthError(`Đã chuyển ${residentData.name} sang danh sách tiền bối.`);
        console.log(`Đã chuyển ${residentData.name} sang danh sách tiền bối.`);

    } catch (error) {
        console.error("Lỗi khi chuyển người dùng sang tiền bối:", error);
        setAuthError(`Lỗi: ${error.message}`);
    }
  };


  // Mới: Hàm để thêm tiền bối thủ công (KHÔNG CÒN XỬ LÝ HÌNH ẢNH)
  const handleAddFormerResidentManually = async (e) => {
      e.preventDefault(); // Ngăn form submit mặc định
      if (!db || !auth || userRole !== 'admin') {
          alert("Bạn không có quyền thêm tiền bối thủ công.");
          return;
      }
      // Đã bỏ newFormerResidentImageFile khỏi điều kiện kiểm tra
      if (!newFormerResidentName || !newFormerResidentEmail || !newFormerResidentDeactivatedDate) {
          alert("Vui lòng điền đầy đủ Họ tên, Email, Ngày ra khỏi phòng.");
          return;
      }

      // Các dòng liên quan đến trạng thái upload ảnh tiền bối đã được xóa:
      // setIsUploadingFormerResident(true);
      // setFormerResidentUploadProgress(0);

      try {
          // Toàn bộ logic nén và upload ảnh ĐÃ ĐƯỢC XÓA BỎ Ở ĐÂY

          const formerResidentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/formerResidents`);
          // Sử dụng addDoc để Firestore tự tạo ID cho tiền bối thêm thủ công
          await addDoc(formerResidentsCollectionRef, {
              name: newFormerResidentName.trim(),
              email: newFormerResidentEmail.trim(),
              phoneNumber: newFormerResidentPhone.trim() || null,
              studentId: newFormerResidentStudentId.trim() || null,
              birthday: newFormerResidentBirthday.trim() || null,
              dormEntryDate: newFormerResidentDormEntryDate.trim() || null,
              academicLevel: newFormerResidentAcademicLevel.trim() || null,
              deactivatedAt: newFormerResidentDeactivatedDate, // Ngày ra khỏi phòng (String unscrupulous-MM-DD)
              // photoURL: downloadURL, // Dòng này đã được xóa vì không còn ảnh
              addedManuallyBy: userId, // Ghi nhận người admin đã thêm
              createdAt: serverTimestamp() // Thời gian tài liệu được tạo
          });

          // Reset form
          setNewFormerResidentName('');
          setNewFormerResidentEmail('');
          setNewFormerResidentPhone('');
          setNewFormerResidentStudentId('');
          setNewFormerResidentBirthday('');
          setNewFormerResidentDormEntryDate('');
          setNewFormerResidentAcademicLevel('');
          setNewFormerResidentDeactivatedDate('');
          // Các dòng liên quan đến file ảnh, progress, isUploadingFormerResident, formerResidentError cũng đã được xóa
          alert('Đã thêm tiền bối thành công!');
          console.log("Đã thêm tiền bối thủ công thành công!");
      } catch (error) {
          console.error("Lỗi khi thêm tiền bối thủ công:", error);
          alert(`Lỗi khi thêm tiền bối: ${error.message}`);
      }
  };

  // ... (các hàm xử lý khác của bạn, ví dụ: handleAddFormerResidentManually) ...

// Mới: Hàm để xóa tiền bối thủ công (chỉ xóa tài liệu Firestore)
const handleDeleteFormerResident = async (residentId) => { // <-- Tham số chỉ là residentId
  if (!db || !userId || userRole !== 'admin') {
      alert("Bạn không có quyền xóa tiền bối.");
      return;
  }

  if (!window.confirm("Bạn có chắc chắn muốn xóa thông tin tiền bối này không?")) {
      return;
  }

  try {
      // Xóa tài liệu Firestore
      await deleteDoc(doc(db, `artifacts/${currentAppId}/public/data/formerResidents`, residentId));

      // Toàn bộ logic xóa ảnh từ Firebase Storage đã bị loại bỏ

      console.log(`Đã xóa tiền bối ${residentId}.`);
      alert("Đã xóa tiền bối thành công!");
  } catch (error) {
      console.error("Lỗi khi xóa tiền bối:", error);
      alert(`Lỗi khi xóa tiền bối: ${error.message}`);
  }
};

const createNotification = async (recipientId, type, message, createdBy, relatedId = null, title = null) => { // Thêm tham số title
  if (!db) {
    console.error("DB chưa sẵn sàng để tạo thông báo.");
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
      title: title // Lưu title vào Firestore
    });
    console.log(`Đã tạo thông báo loại '${type}' cho '${recipientId}'.`);
  } catch (error) {
    console.error("Lỗi khi tạo thông báo:", error);
    setNotificationError(`Lỗi khi tạo thông báo: ${error.message}`);
  }
};

// Mới: Hàm đánh dấu thông báo đã đọc
const markNotificationAsRead = async (notificationId) => {
  if (!db || !userId) {
    console.error("DB hoặc User ID chưa sẵn sàng để đánh dấu thông báo đã đọc.");
    return;
  }
  try {
    const notificationDocRef = doc(db, `artifacts/${currentAppId}/public/data/notifications`, notificationId);
    await updateDoc(notificationDocRef, { isRead: true });
    console.log(`Đã đánh dấu thông báo ${notificationId} là đã đọc.`);
  } catch (error) {
    console.error("Lỗi khi đánh dấu thông báo đã đọc:", error);
    setNotificationError(`Lỗi khi đánh dấu thông báo đã đọc: ${error.message}`);
  }
};

// Mới: Hàm xóa thông báo (chỉ admin)
const deleteNotification = async (notificationId) => {
  if (!db || !userId || userRole !== 'admin') {
    alert("Bạn không có quyền xóa thông báo.");
    return;
  }
  if (!window.confirm("Bạn có chắc chắn muốn xóa thông báo này không?")) {
    return;
  }
  try {
    const notificationDocRef = doc(db, `artifacts/${currentAppId}/public/data/notifications`, notificationId);
    await deleteDoc(notificationDocRef);
    console.log(`Đã xóa thông báo ${notificationId}.`);
    alert("Đã xóa thông báo thành công!");
  } catch (error) {
    console.error("Lỗi khi xóa thông báo:", error);
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

// Mới: Hàm đổi mật khẩu
const handleChangePassword = async () => {
  setPasswordChangeMessage('');
  if (!auth || !userId) {
    setPasswordChangeMessage("Hệ thống xác thực chưa sẵn sàng hoặc bạn chưa đăng nhập.");
    return;
  }
  if (!oldPassword || !newPassword || !confirmNewPassword) {
    setPasswordChangeMessage("Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới.");
    return;
  }
  if (newPassword !== confirmNewPassword) {
    setPasswordChangeMessage("Mật khẩu mới và xác nhận mật khẩu mới không khớp.");
    return;
  }
  if (newPassword.length < 6) { // Firebase yêu cầu mật khẩu tối thiểu 6 ký tự
    setPasswordChangeMessage("Mật khẩu mới phải có ít nhất 6 ký tự.");
    return;
  }
  if (oldPassword === newPassword) {
      setPasswordChangeMessage("Mật khẩu mới phải khác mật khẩu cũ.");
      return;
  }

  const user = auth.currentUser;
  if (!user) {
    setPasswordChangeMessage("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
    return;
  }

  try {
    // Để updatePassword hoạt động, người dùng phải đăng nhập lại gần đây
    // Nếu không, updatePassword sẽ thất bại với lỗi auth/requires-recent-login
    // Chúng ta sẽ cố gắng đăng nhập lại người dùng bằng mật khẩu cũ trước.
    const credential = signInWithEmailAndPassword(auth, user.email, oldPassword); // Dùng user.email
    await credential; // Chờ xác thực lại thành công
    
    await updatePassword(user, newPassword);
    setPasswordChangeMessage("Đổi mật khẩu thành công!");
    setOldPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  } catch (error) {
    console.error("Lỗi khi đổi mật khẩu:", error.code, error.message);
    if (error.code === 'auth/wrong-password') {
      setPasswordChangeMessage("Mật khẩu cũ không chính xác.");
    } else if (error.code === 'auth/requires-recent-login') {
      setPasswordChangeMessage("Để đổi mật khẩu, vui lòng đăng xuất và đăng nhập lại, sau đó thử lại. Hoặc dùng chức năng 'Quên mật khẩu'.");
    } else if (error.code === 'auth/weak-password') {
      setPasswordChangeMessage("Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.");
    }
    else {
      setPasswordChangeMessage(`Lỗi đổi mật khẩu: ${error.message}`);
    }
  }
};

  // --- Kết thúc các hàm xác thực ---


  // Lắng nghe cập nhật danh sách tất cả cư dân (admin sẽ thấy tất cả, thành viên sẽ không dùng trực tiếp)
  useEffect(() => {
    if (!db || !isAuthReady || userId === null) {
      console.log("Lắng nghe cư dân: Đang chờ DB, Auth hoặc User ID sẵn sàng.");
      return;
    }
    console.log("Bắt đầu lắng nghe cập nhật danh sách cư dân...");

    const residentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/residents`);
    const q = query(residentsCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const currentResidents = [];
      snapshot.forEach((doc) => {
        currentResidents.push({ id: doc.id, ...doc.data() });
      });
      setResidents(currentResidents);
      console.log("Đã cập nhật danh sách cư dân:", currentResidents);
    }, (error) => {
      console.error("Lỗi khi lấy dữ liệu cư dân:", error);
    });

    return () => {
      console.log("Hủy đăng ký lắng nghe cư dân.");
      unsubscribe();
    };
  }, [db, isAuthReady, userId]); // userId is still relevant here for the collection path.

  // Lắng nghe cập nhật điểm danh hàng ngày theo thời gian thực cho tháng đã chọn
  useEffect(() => {
    if (!db || !isAuthReady || !selectedMonth || userId === null) {
      console.log("Lắng nghe điểm danh: Đang chờ DB, Auth, tháng hoặc User ID sẵn sàng.");
      return;
    }
    console.log(`Bắt đầu lắng nghe điểm danh hàng ngày cho tháng: ${selectedMonth}...`);

    const dailyPresenceCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/dailyPresence`);
    let q;

    if (userRole === 'member' && loggedInResidentProfile) {
      // Thành viên chỉ truy vấn điểm danh của chính hồ sơ cư dân được liên kết
      q = query(dailyPresenceCollectionRef, where("residentId", "==", loggedInResidentProfile.id));
    } else if (userRole === 'admin') {
      // Admin truy vấn tất cả
      q = query(dailyPresenceCollectionRef);
    } else {
      // Nếu không phải admin và không có hồ sơ cư dân liên kết, không truy vấn gì cả
      setMonthlyAttendanceData({}); // Xóa dữ liệu cũ
      return;
    }


    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = {};
      snapshot.forEach(docSnap => {
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
    }, (error) => {
      console.error("Lỗi khi tải dữ liệu điểm danh tháng:", error);
    });

    return () => {
      console.log(`Hủy đăng ký lắng nghe điểm danh hàng ngày cho tháng ${selectedMonth}.`);
      unsubscribe();
    };
  }, [db, isAuthReady, selectedMonth, userId, userRole, loggedInResidentProfile]); // Thêm loggedInResidentProfile vào dependency

  // Lấy các chỉ số đồng hồ được ghi nhận cuối cùng khi thành phần được gắn kết
  useEffect(() => {
    if (!db || !isAuthReady || userId === null) {
      console.log("Lắng nghe chỉ số đồng hồ: Đang chờ DB, Auth hoặc User ID sẵn sàng.");
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
    console.log("Bắt đầu lắng nghe chỉ số đồng hồ...");

    const meterReadingsDocRef = doc(db, `artifacts/${currentAppId}/public/data/meterReadings`, 'currentReadings');

    const unsubscribe = onSnapshot(meterReadingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLastElectricityReading(data.electricity || 0);
        setLastWaterReading(data.water || 0);
        console.log("Đã tải chỉ số đồng hồ cuối cùng:", data);
      } else {
        setLastElectricityReading(0);
        setLastWaterReading(0);
        console.log("Tài liệu chỉ số đồng hồ không tồn tại, đặt về 0.");
      }
    }, (error) => {
      console.error("Lỗi khi lấy chỉ số đồng hồ:", error);
    });

    return () => {
      console.log("Hủy đăng ký lắng nghe chỉ số đồng hồ.");
      unsubscribe();
    };
  }, [db, isAuthReady, userId, userRole]); // Thêm userRole vào dependency

  // Mới: Lắng nghe cập nhật Lịch sử hóa đơn
  useEffect(() => {
    if (!db || !isAuthReady || userId === null) {
      console.log("Lắng nghe lịch sử hóa đơn: Đang chờ DB, Auth hoặc User ID sẵn sàng.");
      return;
    }
    // Chỉ admin mới cần lắng nghe lịch sử hóa đơn
    if (userRole !== 'admin') {
      setBillHistory([]);
      return;
    }
    console.log("Bắt đầu lắng nghe lịch sử hóa đơn...");

    const billHistoryCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/billHistory`);
    const q = query(billHistoryCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = [];
      snapshot.forEach((docSnap) => { // Use docSnap instead of doc
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
      console.log("Đã cập nhật lịch sử hóa đơn:", history);
    }, (error) => {
      console.error("Lỗi khi lấy lịch sử hóa đơn:", error);
    });

    return () => {
      console.log("Hủy đăng ký lắng nghe lịch sử hóa đơn.");
      unsubscribe();
    };
  }, [db, isAuthReady, userId, userRole]); // Thêm userRole vào dependency

  // Mới: Lắng nghe cập nhật Lịch sử chia sẻ chi phí
  useEffect(() => {
    if (!db || !isAuthReady || userId === null) {
      console.log("Lắng nghe lịch sử chia tiền: Đang chờ DB, Auth hoặc User ID sẵn sàng.");
      return;
    }
    // Không cần điều kiện userRole ở đây vì cả admin và thành viên đều cần đọc để hiển thị chi phí
    console.log("Bắt đầu lắng nghe lịch sử chia tiền...");

    const costSharingCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/costSharingHistory`);
    const q = query(costSharingCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = [];
      snapshot.forEach(docSnap => {
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
      console.log("Đã cập nhật lịch sử chia tiền:", history);
      // MỚI: CẬP NHẬT remainingFund TỪ BẢN GHI MỚI NHẤT
      if (history.length > 0) {
        setRemainingFund(history[0].remainingFund || 0);
      } else {
        setRemainingFund(0); // Nếu không có bản ghi nào, quỹ phòng là 0
      }
    }, (error) => {
      console.error("Lỗi khi lấy lịch sử chia tiền:", error);
    });

    return () => {
      console.log("Hủy đăng ký lắng nghe lịch sử chia tiền.");
      unsubscribe();
    };
  }, [db, isAuthReady, userId]); // userRole không còn là dependency trực tiếp ở đây

  // Mới: Lắng nghe cập nhật Lịch trực phòng
  useEffect(() => {
    if (!db || !isAuthReady || userId === null) {
      console.log("Lắng nghe lịch trực phòng: Đang chờ DB, Auth hoặc User ID sẵn sàng.");
      return;
    }
    // Không cần điều kiện userRole ở đây vì cả admin và thành viên đều cần đọc để hiển thị lịch trực
    console.log("Bắt đầu lắng nghe lịch trực phòng...");

    const cleaningTasksCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/cleaningTasks`);
    const q = query(cleaningTasksCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = [];
      snapshot.forEach(docSnap => {
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
      console.log("Đã cập nhật lịch trực phòng:", tasks);
    }, (error) => {
      console.error("Lỗi khi lấy lịch trực phòng:", error);
    });

    return () => {
      console.log("Hủy đăng ký lắng nghe lịch trực phòng.");
      unsubscribe();
    };
  }, [db, isAuthReady, userId]); // userRole không còn là dependency trực tiếp ở đây

  // Mới: Lắng nghe cập nhật Phân công kệ giày
  useEffect(() => {
    if (!db || !isAuthReady || userId === null) {
      console.log("Lắng nghe gán kệ giày: Đang chờ DB, Auth hoặc User ID sẵn sàng.");
      return;
    }
    console.log("Bắt đầu lắng nghe gán kệ giày...");

    const shoeRackCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/shoeRackAssignments`);
    const q = query(shoeRackCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assignments = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Chuyển đổi Timestamp thành Date nếu có
        if (data.assignedAt && typeof data.assignedAt.toDate === 'function') {
          data.assignedAt = data.assignedAt.toDate();
        }
        assignments[data.shelfNumber] = {
          residentId: data.residentId,
          residentName: data.residentName,
          assignedAt: data.assignedAt
        };
      });
      setShoeRackAssignments(assignments);
      console.log("Đã cập nhật gán kệ giày:", assignments);
    }, (error) => {
      console.error("Lỗi khi lấy gán kệ giày:", error);
    });

    return () => {
      console.log("Hủy đăng ký lắng nghe gán kệ giày.");
      unsubscribe();
    };
  }, [db, isAuthReady, userId]);


  // Mới: Effect để tính toán thống kê tiêu thụ hàng tháng
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
    billHistory.forEach(bill => {
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
    const sortedStats = Object.keys(stats).sort().reduce(
      (obj, key) => {
        obj[key] = stats[key];
        return obj;
      },
      {}
    );
    setMonthlyConsumptionStats(sortedStats);
    console.log("Đã cập nhật thống kê tiêu thụ hàng tháng:", sortedStats);
  }, [billHistory, userRole]); // Thêm userRole vào dependency

  // Mới: Lắng nghe tất cả dữ liệu người dùng để hiển thị trong "Thông tin phòng chung"
  useEffect(() => {
    if (!db || !isAuthReady || userId === null) {
      console.log("Lắng nghe tất cả người dùng: Đang chờ DB, Auth hoặc User ID sẵn sàng.");
      return;
    }
    console.log("Bắt đầu lắng nghe cập nhật tất cả người dùng...");

    const usersCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/users`);
    const q = query(usersCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allUsers = [];
      snapshot.forEach((docSnap) => { // Use docSnap instead of doc
        const userData = docSnap.data();
        // Chuyển đổi Timestamp thành Date nếu có
        if (userData.createdAt && typeof userData.createdAt.toDate === 'function') {
          userData.createdAt = userData.createdAt.toDate();
        }
        allUsers.push({ id: docSnap.id, ...userData });
      });
      setAllUsersData(allUsers);
      console.log("Đã cập nhật tất cả dữ liệu người dùng:", allUsers);
    }, (error) => {
      console.error("Lỗi khi lấy tất cả dữ liệu người dùng:", error);
    });

    return () => {
      console.log("Hủy đăng ký lắng nghe tất cả người dùng.");
      unsubscribe();
    };
  }, [db, isAuthReady, userId]); // userId is still relevant for the collection path.


  // Mới: Lắng nghe cập nhật Kỷ niệm phòng
  useEffect(() => {
    if (!db || !isAuthReady || userId === null) {
      console.log("Lắng nghe kỷ niệm: Đang chờ DB, Auth hoặc User ID sẵn sàng.");
      return;
    }
    console.log("Bắt đầu lắng nghe cập nhật kỷ niệm phòng...");

    const memoriesCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/memories`);
    const q = query(memoriesCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMemories = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.uploadedAt && typeof data.uploadedAt.toDate === 'function') {
          data.uploadedAt = data.uploadedAt.toDate();
        }
        // photoDate có thể là string nếu bạn lưu từ input type="date"
        // Không cần chuyển đổi nếu nó đã là string.
        fetchedMemories.push({ id: docSnap.id, ...data });
      });
      // Sắp xếp theo ngày đăng giảm dần
      fetchedMemories.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
      setMemories(fetchedMemories);
      console.log("Đã cập nhật kỷ niệm phòng:", fetchedMemories);
    }, (error) => {
      console.error("Lỗi khi tải dữ liệu kỷ niệm:", error);
    });

    return () => {
      console.log("Hủy đăng ký lắng nghe kỷ niệm.");
      unsubscribe();
    };
  }, [db, isAuthReady, userId]);

  // Mới: Lắng nghe cập nhật Thông tin tiền bối
  useEffect(() => {
      if (!db || !isAuthReady || userId === null) {
          console.log("Lắng nghe tiền bối: Đang chờ DB, Auth hoặc User ID sẵn sàng.");
          return;
      }
      console.log("Bắt đầu lắng nghe cập nhật thông tin tiền bối...");

      const formerResidentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/formerResidents`);
      const q = query(formerResidentsCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedFormerResidents = [];
          snapshot.forEach(docSnap => {
              const data = docSnap.data();
              // Chuyển đổi Timestamp thành Date nếu có
              if (data.deactivatedAt && typeof data.deactivatedAt.toDate === 'function') {
                  data.deactivatedAt = data.deactivatedAt.toDate();
              }
              fetchedFormerResidents.push({ id: docSnap.id, ...data });
          });
          setFormerResidents(fetchedFormerResidents);
          console.log("Đã cập nhật thông tin tiền bối:", fetchedFormerResidents);
      }, (error) => {
          console.error("Lỗi khi tải dữ liệu tiền bối:", error);
      });

      return () => {
          console.log("Hủy đăng ký lắng nghe thông tin tiền bối.");
          unsubscribe();
      };
  }, [db, isAuthReady, userId]);

  // Mới: Lắng nghe thông báo
  useEffect(() => {
    if (!db || !isAuthReady || userId === null) {
      console.log("Lắng nghe thông báo: Đang chờ DB, Auth hoặc User ID sẵn sàng.");
      return;
    }
    console.log("Bắt đầu lắng nghe thông báo...");

    const notificationsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/notifications`);
    // Lấy các thông báo dành cho người dùng hiện tại (userId) hoặc các thông báo chung ('all')
    const q = query(
      notificationsCollectionRef,
      where("recipientId", "in", [userId, 'all']), // Lấy thông báo cho mình hoặc thông báo chung
      orderBy("createdAt", "desc") // Sắp xếp thông báo mới nhất lên đầu
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications = [];
      let unreadCount = 0;
      snapshot.forEach(docSnap => {
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
      console.log("Đã cập nhật thông báo:", fetchedNotifications);
    }, (error) => {
      console.error("Lỗi khi tải thông báo:", error);
      setNotificationError(`Lỗi khi tải thông báo: ${error.message}`);
    });

    return () => {
      console.log("Hủy đăng ký lắng nghe thông báo.");
      unsubscribe();
    };
  }, [db, isAuthReady, userId]);

  // Thêm `notificationError` vào useEffect để reset lỗi khi chuyển section
  useEffect(() => {
    // ... (các reset trạng thái đã có) ...
    setNotificationError(''); // Mới: reset lỗi thông báo
  }, [activeSection]);

  // Mới: useEffect để kiểm tra và tạo thông báo sinh nhật
useEffect(() => {
  if (!db || !isAuthReady || userId === null || !allUsersData.length || !residents.length) {
    return; // Chờ tất cả dữ liệu sẵn sàng
  }

  const checkBirthdays = async () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(today.getDate() + 14); // Kiểm tra trong 2 tuần tới

    // Lấy tất cả thông báo sinh nhật đã tồn tại trong năm nay để tránh trùng lặp
    const notificationsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/notifications`);
    const qExistingBirthdays = query(
      notificationsCollectionRef,
      where("type", "==", "birthday"),
      where("createdAt", ">=", new Date(currentYear, 0, 1)), // Từ đầu năm
      where("createdAt", "<=", new Date(currentYear, 11, 31, 23, 59, 59)) // Đến cuối năm
    );
    const existingBirthdayNotificationsSnap = await getDocs(qExistingBirthdays);
    const existingBirthdayNotifications = {}; // { residentId: true }
    existingBirthdayNotificationsSnap.forEach(docSnap => {
      const data = docSnap.data();
      // Kiểm tra xem thông báo này có phải cho cùng một năm sinh nhật không
      if (data.relatedId && data.message.includes(`sinh nhật ${currentYear}`)) { // Dựa vào message để kiểm tra năm
          existingBirthdayNotifications[data.relatedId] = true;
      }
    });

    residents.filter(res => res.isActive).forEach(resident => { // Chỉ cư dân đang hoạt động
      const userLinked = allUsersData.find(u => u.linkedResidentId === resident.id);
      if (userLinked && userLinked.birthday) {
        const [birthYear, birthMonth, birthDay] = userLinked.birthday.split('-').map(Number);

        // Tạo ngày sinh nhật trong năm hiện tại
        const birthdayThisYear = new Date(currentYear, birthMonth - 1, birthDay);

        // Kiểm tra nếu sinh nhật đã qua nhưng còn trong tuần đầu của năm tới, hoặc sắp tới trong 2 tuần
        // Đơn giản hóa: chỉ kiểm tra nếu sắp tới trong 2 tuần hoặc là hôm nay
        if (
            birthdayThisYear >= today && birthdayThisYear <= twoWeeksFromNow &&
            !existingBirthdayNotifications[resident.id] // Chưa có thông báo sinh nhật cho người này trong năm nay
        ) {
          const message = `Sắp đến sinh nhật của ${resident.name} vào ngày ${String(birthDay).padStart(2, '0')}/${String(birthMonth).padStart(2, '0')}/${currentYear}!`;
          createNotification('all', 'birthday', message, userId, resident.id); // Thông báo chung cho tất cả mọi người
          // Nếu bạn muốn thông báo cá nhân, thay 'all' bằng userLinked.id
        }
      }
    });
  };

  // Chạy kiểm tra khi component load
  checkBirthdays();

  // Có thể chạy lại kiểm tra định kỳ (ví dụ, hàng ngày vào lúc nào đó)
  // Đây là nơi bạn sẽ cần Cloud Functions để tự động kiểm tra mỗi ngày mà không cần người dùng mở app
  // Đối với hiện tại, nó sẽ chạy mỗi khi dependencies thay đổi hoặc khi app load.
  // Một cách đơn giản hơn là lưu lại ngày cuối cùng kiểm tra trong Firestore để tránh tạo lại thông báo liên tục.

}, [db, isAuthReady, userId, allUsersData, residents]); // Thêm allUsersData và residents vào dependencies

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


  // Thêm một cư dân mới
  const handleAddResident = async () => {
    setAuthError('');
    setBillingError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể thêm cư dân
      console.error("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      setAuthError("Bạn không có quyền thực hiện thao tác này.");
      return;
    }
    if (newResidentName.trim() === '') {
      console.error("Tên người trong phòng không được để trống.");
      setAuthError("Tên người trong phòng không được để trống.");
      return;
    }

    const activeResidentsCount = residents.filter(res => res.isActive !== false).length;
    if (activeResidentsCount >= 8) {
      console.error("Bạn chỉ có thể thêm tối đa 8 người đang hoạt động trong phòng.");
      setAuthError("Bạn chỉ có thể thêm tối đa 8 người đang hoạt động trong phòng.");
      return;
    }

    const residentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/residents`);

    try {
      await addDoc(residentsCollectionRef, {
        name: newResidentName.trim(),
        addedBy: userId,
        createdAt: serverTimestamp(),
        isActive: true
      });
      setNewResidentName('');
      console.log(`Đã thêm "${newResidentName}" vào danh sách.`);
    } catch (error) {
      console.error("Lỗi khi thêm người trong phòng:", error);
      setAuthError(`Lỗi khi thêm người trong phòng: ${error.message}`);
    }
  };

  // Vô hiệu hóa hoặc kích hoạt lại một cư dân
  const handleToggleResidentActiveStatus = async (residentId, residentName, currentStatus) => {
    setAuthError('');
    setBillingError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể chuyển đổi trạng thái
      console.error("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      setAuthError("Bạn không có quyền thực hiện thao tác này.");
      return;
    }

    const residentDocRef = doc(db, `artifacts/${currentAppId}/public/data/residents`, residentId);
    const newStatus = !currentStatus;

    try {
      await setDoc(residentDocRef, { isActive: newStatus }, { merge: true });
      console.log(`Đã cập nhật trạng thái của "${residentName}" thành ${newStatus ? 'Hoạt động' : 'Vô hiệu hóa'}.`);
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái cư dân:", error);
      setAuthError(`Lỗi khi cập nhật trạng thái của ${residentName}: ${error.message}`);
    }
  };

  // Xử lý việc chuyển đổi điểm danh hàng ngày cho một cư dân và ngày cụ thể
  const handleToggleDailyPresence = async (residentId, day) => {
    setAuthError('');
    setBillingError('');
    if (!db || !userId) {
      setAuthError("Hệ thống chưa sẵn sàng. DB hoặc User ID không khả dụng.");
      return;
    }

    // Một thành viên chỉ có thể chuyển đổi điểm danh của chính hồ sơ cư dân được liên kết
    if (userRole === 'member' && loggedInResidentProfile && residentId !== loggedInResidentProfile.id) {
      setAuthError("Bạn chỉ có thể điểm danh cho bản thân.");
      return;
    }
    // Nếu thành viên chưa có hồ sơ cư dân liên kết
    if (userRole === 'member' && !loggedInResidentProfile) {
      setAuthError("Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.");
      return;
    }

    const dailyPresenceCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/dailyPresence`);

    const fullDate = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    const docId = `${residentId}-${fullDate}`;
    const currentStatus = monthlyAttendanceData[residentId]?.[String(day).padStart(2, '0')] || 0;
    const newStatus = currentStatus === 1 ? 0 : 1;

    try {
      await setDoc(doc(dailyPresenceCollectionRef, docId), {
        residentId: residentId,
        date: fullDate,
        status: newStatus,
        updatedBy: userId,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      console.log(`Đã cập nhật trạng thái của ${residents.find(r => r.id === residentId)?.name} vào ngày ${day}/${selectedMonth} thành ${newStatus === 1 ? 'Có ở' : 'Không ở'}.`);
    } catch (error) {
      console.error("Lỗi khi cập nhật điểm danh hàng ngày:", error);
      setAuthError(`Lỗi khi cập nhật điểm danh hàng ngày: ${error.message}`);
    }
  };

  // Tính hóa đơn
  const calculateBill = async () => {
    setAuthError('');
    setBillingError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể tính hóa đơn
      setAuthError("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      return;
    }
    const elecCurrent = parseFloat(currentElectricityReading);
    const waterCurrent = parseFloat(currentWaterReading);

    // Kiểm tra xem đầu vào có phải là số hợp lệ không
    if (isNaN(elecCurrent) || isNaN(waterCurrent)) {
      console.error("Vui lòng nhập đầy đủ và chính xác các chỉ số điện nước hiện tại.");
      setBillingError("Vui lòng nhập đầy đủ và chính xác các chỉ số điện nước hiện tại.");
      return;
    }

    if (elecCurrent < lastElectricityReading || waterCurrent < lastWaterReading) {
      console.error("Chỉ số hiện tại phải lớn hơn hoặc bằng chỉ số cuối cùng được ghi nhận.");
      setBillingError("Chỉ số hiện tại phải lớn hơn hoặc bằng chỉ số cuối cùng được ghi nhận.");
      return;
    }

    const electricityRate = 2550; // VND/KW
    const waterRate = 4000;     // VND/m3

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
      await setDoc(meterReadingsDocRef, {
        electricity: elecCurrent,
        water: waterCurrent,
        lastUpdated: serverTimestamp()
      }, { merge: true });

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
        billingMonth: selectedMonth
      });

      console.log("Đã tính toán chi phí và cập nhật chỉ số đồng hồ thành công!");
    } catch (error) {
      console.error("Lỗi khi lưu chỉ số đồng hồ hoặc lịch sử hóa đơn:", error);
      setBillingError(`Lỗi khi lưu: ${error.message}`);
    }
  };

  // Tính toán số ngày có mặt trong một khoảng thời gian và chi phí cá nhân
  // Tính toán số ngày có mặt trong một khoảng thời gian và chi phí cá nhân
  const calculateAttendanceDays = async () => {
    setAuthError('');
    setBillingError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể tính toán điểm danh và chi phí
      setAuthError("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      return;
    }
    if (!startDate || !endDate) {
      setAuthError("Vui lòng chọn ngày bắt đầu và ngày kết thúc để tính toán điểm danh.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      setAuthError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
      return;
    }

    // Đảm bảo totalCost hợp lệ trước khi tiến hành tính toán chi phí
    if (totalCost <= 0) {
      setBillingError("Vui lòng tính toán tổng chi phí điện nước trước khi chia tiền.");
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
        where("date", ">=", formatDate(start)),
        where("date", "<=", formatDate(end))
      );
      const querySnapshot = await getDocs(q);

      for (const resident of residents) {
        // Khởi tạo daysPresent cho mỗi cư dân
        daysPresentPerResident[resident.id] = 0;
      }

      // Điền daysPresentPerResident từ snapshot đã lấy
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (residents.some(res => res.id === data.residentId) && data.status === 1) {
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
        residents.forEach(resident => {
          const days = daysPresentPerResident[resident.id] || 0; // Lấy số ngày có mặt
          const rawCost = days * calculatedCostPerDayLocal;
          const roundedCost = Math.round(rawCost / 1000) * 1000;

          // Lưu chi phí, trạng thái đã thanh toán và SỐ NGÀY CÓ MẶT
          individualCalculatedCostsLocal[resident.id] = {
            cost: roundedCost,
            isPaid: false,
            daysPresent: days // LƯU SỐ NGÀY CÓ MẶT VÀO ĐÂY
          };
          totalRoundedIndividualCosts += roundedCost;
        });
      } else {
        setCostPerDayPerPerson(0);
        residents.forEach(resident => {
          individualCalculatedCostsLocal[resident.id] = { cost: 0, isPaid: false, daysPresent: 0 }; // Mặc định daysPresent
        });
      }
      setIndividualCosts(individualCalculatedCostsLocal);

      // Tính quỹ còn lại - sử dụng totalCost và totalRoundedIndividualCosts cục bộ
      calculatedRemainingFund = totalCost - totalRoundedIndividualCosts; // Gán vào biến đã khai báo
      setRemainingFund(calculatedRemainingFund);

      // Lưu tóm tắt chia sẻ chi phí vào lịch sử bằng cách sử dụng các biến cục bộ
      const costSharingHistoryCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/costSharingHistory`);
      const newCostSharingDocRef = await addDoc(costSharingHistoryCollectionRef, { // Lấy ref của tài liệu mới
        periodStart: startDate,
        periodEnd: endDate,
        totalCalculatedDaysAllResidents: totalDaysAcrossAllResidentsLocal,
        costPerDayPerPerson: calculatedCostPerDayLocal, // Sử dụng biến đã khai báo
        individualCosts: individualCalculatedCostsLocal, // Lưu dưới dạng map các đối tượng {cost, isPaid, daysPresent}
        remainingFund: calculatedRemainingFund, // Sử dụng biến đã khai báo
        calculatedBy: userId,
        calculatedDate: serverTimestamp(),
        relatedTotalBill: totalCost
      });

      console.log("Đã tính toán số ngày có mặt và chi phí trung bình.");

      // Mới: TẠO THÔNG BÁO TIỀN ĐIỆN NƯỚC CHO TỪNG THÀNH VIÊN (Đoạn này đã đúng)
      for (const resident of residents.filter(res => res.isActive)) {
        const userLinkedToResident = allUsersData.find(user => user.linkedResidentId === resident.id);
        if (userLinkedToResident) {
            const cost = individualCalculatedCostsLocal[resident.id]?.cost || 0;
            const message = `Bạn có hóa đơn tiền điện nước cần đóng ${cost.toLocaleString('vi-VN')} VND cho kỳ từ ${startDate} đến ${endDate}.`;
            await createNotification(userLinkedToResident.id, 'payment', message, userId, newCostSharingDocRef.id, 'Hóa đơn tiền điện nước'); // Thêm title
        }
      }
      // Tạo thông báo chung cho admin
      await createNotification('all', 'payment', `Hóa đơn điện nước mới cho kỳ ${startDate} đến ${endDate} đã được tính.`, userId, newCostSharingDocRef.id, 'Thông báo hóa đơn chung'); // Thêm title

    } catch (error) {
      console.error("Lỗi khi tính toán ngày có mặt và chi phí:", error);
      setBillingError(`Lỗi khi tính toán: ${error.message}`);
    }
  };

  // Hàm để tạo nhắc nhở thanh toán bằng Gemini API
  const generatePaymentReminder = async () => {
    setAuthError('');
    setBillingError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể tạo nhắc nhở
      setGeneratedReminder("Bạn không có quyền để tạo nhắc nhở.");
      return;
    }
    if (!selectedResidentForReminder) {
      setGeneratedReminder("Vui lòng chọn một người để tạo nhắc nhở.");
      return;
    }
    // Đảm bảo rằng totalCost đã được tính toán và individualCosts có sẵn
    if (totalCost === 0 || totalCalculatedDaysAllResidents === 0 || Object.keys(individualCosts).length === 0) {
      setGeneratedReminder("Vui lòng tính toán chi phí điện nước và ngày có mặt trước.");
      return;
    }

    setIsGeneratingReminder(true);
    setGeneratedReminder('');

    const residentName = residents.find(r => r.id === selectedResidentForReminder)?.name;
    const formattedTotalCost = totalCost.toLocaleString('vi-VN');
    const period = `${startDate} đến ${endDate}`;

    const prompt = `Bạn là một trợ lý quản lý phòng. Hãy viết một tin nhắn nhắc nhở thanh toán tiền điện nước lịch sự cho ${residentName}.
Tổng tiền điện nước của cả phòng là ${formattedTotalCost} VND.
Số tiền ${residentName} cần đóng là ${individualCosts[selectedResidentForReminder]?.cost.toLocaleString('vi-VN')} VND cho kỳ từ ${period}.
Hãy nhắc nhở họ về số tiền cần thanh toán và thời hạn nếu có (có thể mặc định là cuối tháng).
Tin nhắn nên ngắn gọn, thân thiện và rõ ràng.`; // Sửa lỗi: dùng individualCosts của người được chọn

    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };
    // API key cho Gemini được cung cấp bởi Canvas runtime khi triển khai.
    // Để kiểm tra cục bộ, bạn có thể cần đặt khóa thủ công tại đây hoặc thông qua biến môi trường.
    // LƯU Ý QUAN TRỌNG: KHÔNG ĐỂ API KEY TRỰC TIẾP TRONG MÃ NGUỒN CLIENT TRONG PRODUCTION.
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY; // <-- Sử dụng biến môi trường

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        setGeneratedReminder(text);
      } else {
        setGeneratedReminder("Không thể tạo nhắc nhở. Vui lòng thử lại.");
        console.error("Cấu trúc phản hồi Gemini API không mong muốn:", result);
      }
    } catch (error) {
      setGeneratedReminder("Lỗi khi kết nối với Gemini API. Vui lòng kiểm tra kết nối mạng.");
      console.error("Lỗi khi gọi Gemini API:", error);
    } finally {
      setIsGeneratingReminder(false);
    }
  };

  // Hàm để chuyển đổi trạng thái đã thanh toán hóa đơn
  const handleToggleBillPaidStatus = async (billId, currentStatus) => {
    setAuthError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể chuyển đổi trạng thái hóa đơn
      setAuthError("Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.");
      return;
    }
    const billDocRef = doc(db, `artifacts/${currentAppId}/public/data/billHistory`, billId);
    try {
      await setDoc(billDocRef, { isPaid: !currentStatus }, { merge: true });
      console.log(`Đã cập nhật trạng thái thanh toán cho hóa đơn ${billId}.`);
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái thanh toán:", error);
      setAuthError(`Lỗi khi cập nhật trạng thái thanh toán: ${error.message}`);
    }
  };

  // Mới: Hàm để thêm một công việc vệ sinh
  const handleAddCleaningTask = async () => {
    setAuthError('');
    setBillingError(''); // Đặt lại billingError
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể thêm công việc vệ sinh
      setAuthError("Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.");
      return;
    }
    if (newCleaningTaskName.trim() === '' || !newCleaningTaskDate || !selectedResidentForCleaning) {
      setAuthError("Vui lòng nhập đầy đủ thông tin công việc, ngày và người thực hiện.");
      return;
    }

    const cleaningTasksCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/cleaningTasks`);
    const assignedResident = residents.find(res => res.id === selectedResidentForCleaning);

    try {
      await addDoc(cleaningTasksCollectionRef, {
        name: newCleaningTaskName.trim(),
        date: newCleaningTaskDate, // Chuỗi בכל-MM-DD
        assignedToResidentId: selectedResidentForCleaning,
        assignedToResidentName: assignedResident ? assignedResident.name : 'Unknown',
        isCompleted: false,
        assignedBy: userId,
        createdAt: serverTimestamp()
      });
      setNewCleaningTaskName('');
      setNewCleaningTaskDate('');
      setSelectedResidentForCleaning('');
      console.log(`Đã thêm công việc "${newCleaningTaskName}" vào lịch trực.`);
    } catch (error) {
      console.error("Lỗi khi thêm công việc vệ sinh:", error);
      setAuthError(`Lỗi khi thêm công việc vệ sinh: ${error.message}`);
    }
  };

  // Mới: Hàm để chuyển đổi trạng thái hoàn thành công việc vệ sinh
  const handleToggleCleaningTaskCompletion = async (taskId, currentStatus) => {
    setAuthError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể chuyển đổi trạng thái công việc vệ sinh
      setAuthError("Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.");
      return;
    }
    const taskDocRef = doc(db, `artifacts/${currentAppId}/public/data/cleaningTasks`, taskId);
    try {
      await setDoc(taskDocRef, { isCompleted: !currentStatus }, { merge: true });
      console.log(`Đã cập nhật trạng thái hoàn thành cho công việc ${taskId}.`);
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái công việc:", error);
      setAuthError(`Lỗi khi cập nhật trạng thái công việc: ${error.message}`);
    }
  };

  // Mới: Hàm để xóa một công việc vệ sinh
  const handleDeleteCleaningTask = async (taskId, taskName) => {
    setAuthError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể xóa công việc vệ sinh
      setAuthError("Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.");
      return;
    }
    const taskDocRef = doc(db, `artifacts/${currentAppId}/public/data/cleaningTasks`, taskId);
    try {
      await deleteDoc(taskDocRef);
      console.log(`Đã xóa công việc "${taskName}" khỏi lịch trực.`);
    } catch (error) {
      console.error("Lỗi khi xóa công việc vệ sinh:", error);
      setAuthError(`Lỗi khi xóa công việc vệ sinh: ${error.message}`);
    }
  };

  // Mới: Hàm để chuyển đổi trạng thái thanh toán cá nhân trong một bản ghi chia sẻ chi phí
  const handleToggleIndividualPaymentStatus = async (costSharingId, residentId, currentStatus) => {
    setAuthError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể chuyển đổi trạng thái thanh toán
      setAuthError("Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.");
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
            updatedIndividualCosts[residentId] = { cost: updatedIndividualCosts[residentId], isPaid: !currentStatus, daysPresent: 0 };
          } else {
            updatedIndividualCosts[residentId].isPaid = !currentStatus;
          }
        } else { // Nếu residentId không tìm thấy hoặc dữ liệu là null/undefined
          // Trường hợp này lý tưởng là không xảy ra nếu individualCosts được điền đúng cách
          // nhưng được thêm vào để tăng tính mạnh mẽ.
          updatedIndividualCosts[residentId] = { cost: 0, isPaid: !currentStatus, daysPresent: 0 };
        }

        await setDoc(costSharingDocRef, { individualCosts: updatedIndividualCosts }, { merge: true });
        console.log(`Đã cập nhật trạng thái thanh toán cá nhân cho ${residentId} trong bản ghi chia tiền ${costSharingId}.`);

        // Cập nhật trạng thái cục bộ của selectedCostSharingDetails để buộc hiển thị lại modal
        setSelectedCostSharingDetails(prevDetails => {
          if (!prevDetails || prevDetails.id !== costSharingId) return prevDetails;
          return {
            ...prevDetails,
            individualCosts: updatedIndividualCosts
          };
        });

      } else {
        console.error("Không tìm thấy bản ghi chia tiền để cập nhật.");
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái thanh toán cá nhân:", error);
      setAuthError(`Lỗi khi cập nhật trạng thái thanh toán cá nhân: ${error.message}`);
    }
  };

  // Mới: Hàm để gán cư dân vào kệ giày
  const handleAssignShoeRack = async () => {
    setAuthError('');
    setBillingError(''); // Đặt lại billingError
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể gán kệ giày
      setAuthError("Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.");
      return;
    }
    if (!selectedShelfNumber || !selectedResidentForShelf) {
      setAuthError("Vui lòng chọn tầng kệ và người để gán.");
      return;
    }

    const shoeRackDocRef = doc(db, `artifacts/${currentAppId}/public/data/shoeRackAssignments`, selectedShelfNumber);
    const assignedResident = residents.find(res => res.id === selectedResidentForShelf);

    // Kiểm tra xem kệ đã được gán cho người khác chưa
    const existingAssignment = shoeRackAssignments[selectedShelfNumber];
    if (existingAssignment && existingAssignment.residentId !== selectedResidentForShelf) {
      console.warn(`Tầng kệ ${selectedShelfNumber} đã được gán cho ${existingAssignment.residentName}. Sẽ ghi đè.`);
    }
    // Kiểm tra xem cư dân đã được gán cho kệ khác chưa
    const existingResidentAssignment = Object.entries(shoeRackAssignments).find(([shelf, assignment]) =>
      assignment.residentId === selectedResidentForShelf && shelf !== selectedShelfNumber
    );
    if (existingResidentAssignment) {
      console.warn(`${assignedResident.name} đã được gán cho tầng kệ ${existingResidentAssignment[0]}. Sẽ di chuyển.`);
      // Xóa gán cũ
      const oldShelfDocRef = doc(db, `artifacts/${currentAppId}/public/data/shoeRackAssignments`, existingResidentAssignment[0]);
      await deleteDoc(oldShelfDocRef);
    }


    try {
      await setDoc(shoeRackDocRef, {
        shelfNumber: parseInt(selectedShelfNumber),
        residentId: selectedResidentForShelf,
        residentName: assignedResident ? assignedResident.name : 'Unknown',
        assignedBy: userId,
        assignedAt: serverTimestamp()
      });
      setSelectedShelfNumber('');
      setSelectedResidentForShelf('');
      console.log(`Đã gán ${assignedResident ? assignedResident.name : 'Unknown'} vào tầng kệ ${selectedShelfNumber}.`);
    } catch (error) {
      console.error("Lỗi khi gán kệ giày:", error);
      setAuthError(`Lỗi khi gán kệ giày: ${error.message}`);
    }
  };

  // Mới: Hàm để xóa một phân công kệ giày
  const handleClearShoeRackAssignment = async (shelfNumber) => {
    setAuthError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể xóa kệ giày
      setAuthError("Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.");
      return;
    }
    const shoeRackDocRef = doc(db, `artifacts/${currentAppId}/public/data/shoeRackAssignments`, String(shelfNumber));
    try {
      await deleteDoc(shoeRackDocRef);
      console.log(`Đã xóa việc gán tầng kệ ${shelfNumber}.`); // Sửa lỗi cú pháp string
    } catch (error) {
      console.error("Lỗi khi xóa gán kệ giày:", error);
      setAuthError(`Lỗi khi xóa gán kệ giày: ${error.message}`);
    }
  };

  // Mới: Hàm để tạo lịch vệ sinh bằng Gemini API
  const handleGenerateCleaningSchedule = async () => {
    setAuthError('');
    setBillingError('');
    setGeneratedCleaningTasks([]); // Xóa các tác vụ đã tạo trước đó
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể tạo lịch vệ sinh
      setAuthError("Vui lòng đăng nhập hoặc bạn không có quyền để tạo lịch tự động.");
      return;
    }
    const activeResidents = residents.filter(res => res.isActive !== false);
    if (activeResidents.length === 0) {
      setAuthError("Vui lòng thêm ít nhất một người đang hoạt động vào danh sách để tạo lịch.");
      return;
    }
    if (numDaysForSchedule <= 0) {
      setAuthError("Số ngày tạo lịch phải lớn hơn 0.");
      return;
    }

    setIsGeneratingSchedule(true);

    const residentNames = activeResidents.map(res => res.name);
    const today = new Date();
    const endDateForPrompt = new Date(today);
    endDateForPrompt.setDate(today.getDate() + parseInt(numDaysForSchedule) - 1);

    const prompt = `Bạn là một trợ lý quản lý phòng. Hãy tạo một lịch trực phòng lau dọn cho các thành viên sau: ${residentNames.join(', ')}.
    Lịch trình nên kéo dài trong ${numDaysForSchedule} ngày, bắt đầu từ hôm nay (${formatDate(today)}).
    Các công việc chính cần phân công luân phiên hàng ngày là:
    - Quét phòng, lau phòng, đổ rác

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
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = {
      contents: chatHistory,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              "taskName": { "type": "STRING" },
              "assignedToResidentName": { "type": "STRING" },
              "date": { "type": "STRING" }
            },
            required: ["taskName", "assignedToResidentName", "date"]
          }
        }
      }
    };
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY; // <-- Sử dụng biến môi trường

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        const jsonText = result.candidates[0].content.parts[0].text;
        const parsedTasks = JSON.parse(jsonText);
        setGeneratedCleaningTasks(parsedTasks);
        console.log("Lịch trực đã tạo bởi Gemini:", parsedTasks);
      } else {
        setAuthError("Không thể tạo lịch trực. Vui lòng thử lại hoặc điều chỉnh yêu cầu.");
        console.error("Cấu trúc phản hồi Gemini API không mong muốn:", result);
      }
    } catch (error) {
      setAuthError("Lỗi khi kết nối với Gemini API. Vui lòng kiểm tra kết nối mạng hoặc API Key.");
      console.error("Lỗi khi gọi Gemini API:", error);
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  // Mới: Hàm để lưu các công việc vệ sinh đã tạo vào Firestore
  const handleSaveGeneratedTasks = async () => {
    setAuthError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể lưu công việc vệ sinh
      setAuthError("Vui lòng đăng nhập hoặc bạn không có quyền để lưu lịch trực.");
      return;
    }
    if (generatedCleaningTasks.length === 0) {
      setAuthError("Không có lịch trực để lưu.");
      return;
    }

    const cleaningTasksCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/cleaningTasks`);

    try {
      for (const task of generatedCleaningTasks) {
        // Tìm residentId dựa trên assignedToResidentName
        const assignedResident = residents.find(res => res.name === task.assignedToResidentName);
        const residentId = assignedResident ? assignedResident.id : 'unknown';

        await addDoc(cleaningTasksCollectionRef, {
          name: task.taskName,
          date: task.date,
          assignedToResidentId: residentId,
          assignedToResidentName: task.assignedToResidentName,
          isCompleted: false,
          assignedBy: userId,
          createdAt: serverTimestamp()
        });
      }
      for (const task of generatedCleaningTasks) {
        const assignedResident = residents.find(res => res.name === task.assignedToResidentName);
        const residentId = assignedResident ? assignedResident.id : 'unknown';

        const newCleaningTaskDocRef = await addDoc(cleaningTasksCollectionRef, { // Lấy ref của task mới
          name: task.taskName,
          date: task.date,
          assignedToResidentId: residentId,
          assignedToResidentName: task.assignedToResidentName,
          isCompleted: false,
          assignedBy: userId,
          createdAt: serverTimestamp()
        });

        // Mới: TẠO THÔNG BÁO LỊCH TRỰC CHO NGƯỜI ĐƯỢC PHÂN CÔNG
        const userLinkedToResident = allUsersData.find(user => user.linkedResidentId === residentId);
        if (userLinkedToResident) {
            const message = `Bạn có công việc trực phòng "${task.taskName}" vào ngày ${task.date}.`;
            await createNotification(userLinkedToResident.id, 'cleaning', message, userId, newCleaningTaskDocRef.id);
        }
      }
      // Tạo thông báo chung cho admin
      await createNotification('all', 'cleaning', `Lịch trực phòng mới đã được tạo và phân công.`, userId);

      setGeneratedCleaningTasks([]); // Xóa các tác vụ đã tạo sau khi lưu
      setShowGenerateScheduleModal(false); // Đóng modal
      console.log("Đã lưu lịch trực tự động thành công!");
    } catch (error) {
      console.error("Lỗi khi lưu lịch trực tự động:", error);
      setAuthError(`Lỗi khi lưu lịch trực tự động: ${error.message}`);
    }
  };

  // Mới: Hàm để thành viên đánh dấu đã đóng tiền của họ
  const handleMarkMyPaymentAsPaid = async () => {
    setAuthError('');
    if (!db || !userId || userRole !== 'member' || !loggedInResidentProfile) {
      setAuthError("Bạn không có quyền hoặc không có hồ sơ cư dân liên kết để thực hiện thao tác này.");
      return;
    }

    // Tìm bản ghi chia tiền gần nhất (hoặc bản ghi đang hiển thị cho thành viên)
    // Để đơn giản, chúng ta sẽ tìm bản ghi chia tiền gần nhất trong lịch sử
    const latestCostSharingRecord = costSharingHistory[0]; // Giả định bản ghi mới nhất là cái cần cập nhật

    if (!latestCostSharingRecord || !latestCostSharingRecord.individualCosts || !latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]) {
      setAuthError("Không tìm thấy thông tin chi phí để cập nhật.");
      return;
    }

    const costSharingDocRef = doc(db, `artifacts/${currentAppId}/public/data/costSharingHistory`, latestCostSharingRecord.id);
    const updatedIndividualCosts = JSON.parse(JSON.stringify(latestCostSharingRecord.individualCosts));

    // Đảm bảo chỉ cập nhật trạng thái của người dùng hiện tại
    if (updatedIndividualCosts[loggedInResidentProfile.id]) {
        if (typeof updatedIndividualCosts[loggedInResidentProfile.id] === 'number') {
            updatedIndividualCosts[loggedInResidentProfile.id] = { cost: updatedIndividualCosts[loggedInResidentProfile.id], isPaid: true, daysPresent: 0 };
        } else {
            updatedIndividualCosts[loggedInResidentProfile.id].isPaid = true; // Đánh dấu là đã đóng
        }
    }


    try {
      await updateDoc(costSharingDocRef, { individualCosts: updatedIndividualCosts });
      console.log(`Người dùng ${loggedInResidentProfile.name} đã đánh dấu đã đóng tiền cho bản ghi ${latestCostSharingRecord.id}.`);
      setAuthError("Đã đánh dấu là đã đóng tiền thành công!");
    } catch (error) {
      console.error("Lỗi khi đánh dấu đã đóng tiền:", error);
      setAuthError(`Lỗi khi đánh dấu đã đóng tiền: ${error.message}`);
    }
  };


  // Lấy số ngày trong tháng đã chọn
  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const currentYear = parseInt(selectedMonth.split('-')[0]);
  const currentMonth = parseInt(selectedMonth.split('-')[1]);
  const daysInSelectedMonth = getDaysInMonth(currentYear, currentMonth);

  // Lọc cư dân dựa trên showInactiveResidents và loggedInResidentProfile
  const displayedResidents = showInactiveResidents // Lọc theo trạng thái vô hiệu hóa (chỉ admin dùng)
    ? residents
    : residents.filter(res => res.isActive !== false);

  // Lưu ý: Đối với thành viên, chúng ta sẽ hiển thị tất cả cư dân đang hoạt động
  // và điều khiển quyền sửa trên giao diện (disabled checkbox).

  // Hàm renderSection để hiển thị các phần giao diện dựa trên vai trò người dùng
  const renderSection = () => {
    // Nếu chưa đăng nhập hoặc xác thực chưa sẵn sàng, hiển thị thông báo chung
    if (!userId || !isAuthReady) {
      return (
        <div className="text-center p-8 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner">
          <p className="text-xl text-gray-700 dark:text-gray-300 font-semibold mb-4">Vui lòng đăng nhập để sử dụng ứng dụng.</p>
        </div>
      );
    }

    // Logic cho Admin
    if (userRole === 'admin') {
      switch (activeSection) {
        case 'dashboard': // MỚI: Dashboard cho Admin
          // Lọc các nhiệm vụ trực phòng sắp tới cho Admin (tất cả các nhiệm vụ chưa hoàn thành)
          const upcomingAdminCleaningTasks = cleaningSchedule.filter(task =>
            !task.isCompleted && new Date(task.date) >= new Date()
          ).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sắp xếp theo ngày tăng dần

          // MỚI: CHUẨN BỊ DỮ LIỆU CHO BIỂU ĐỒ TIÊU THỤ ĐIỆN NƯỚC
          const chartData = Object.entries(monthlyConsumptionStats).map(([month, stats]) => ({
            month: month, // Ví dụ: "2025-06"
            điện: stats.electricity, // Dữ liệu điện
            nước: stats.water,   // Dữ liệu nước
            tổng: stats.total    // Dữ liệu tổng tiền
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
                    {residents.filter(res => res.isActive).length} / 8
                  </p>
                </div>

                {/* Widget: Tổng tiền quỹ */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col items-center justify-center">
                  <i className="fas fa-wallet text-4xl text-green-500 mb-3"></i>
                  <p className="text-lg text-gray-700 dark:text-gray-300">Tổng tiền quỹ</p>
                  <p className={`text-3xl font-bold ${remainingFund >= 0 ? 'text-green-600' : 'text-red-500'} dark:text-green-300`}>
                    {remainingFund.toLocaleString('vi-VN')} VND
                  </p>
                </div>

                {/* Widget: Thông báo chưa đọc */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col items-center justify-center">
                  <i className="fas fa-bell text-4xl text-yellow-500 mb-3"></i>
                  <p className="text-lg text-gray-700 dark:text-gray-300">Thông báo chưa đọc</p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-300">
                    {unreadNotificationsCount}
                  </p>
                </div>

                {/* Widget: Hóa đơn gần nhất */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md col-span-full">
                    <h3 className="text-xl font-bold text-blue-700 dark:text-blue-200 mb-3">Hóa đơn gần nhất</h3>
                    {billHistory.length > 0 ? (
                        <p className="text-gray-700 dark:text-gray-300">
                            <strong>Kỳ tính:</strong> {billHistory[0].billingMonth} - <strong>Tổng:</strong> {billHistory[0].totalCost?.toLocaleString('vi-VN')} VND
                            <span className={`ml-2 font-semibold ${billHistory[0].isPaid ? 'text-green-600' : 'text-red-500'}`}>
                                ({billHistory[0].isPaid ? 'Đã trả' : 'Chưa trả'})
                            </span>
                        </p>
                    ) : (
                        <p className="text-gray-600 dark:text-gray-400 italic">Chưa có hóa đơn nào.</p>
                    )}
                </div>

                {/* Widget: Các nhiệm vụ trực phòng sắp tới (Admin thấy tất cả) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md col-span-full">
                  <h3 className="text-xl font-bold text-purple-700 dark:text-purple-200 mb-3">Nhiệm vụ trực phòng sắp tới</h3>
                  {upcomingAdminCleaningTasks.length > 0 ? (
                    <ul className="space-y-2">
                      {upcomingAdminCleaningTasks.slice(0, 5).map(task => ( // Chỉ hiển thị 5 nhiệm vụ đầu
                        <li key={task.id} className="text-gray-700 dark:text-gray-300">
                          <i className="fas fa-check-circle mr-2 text-purple-500"></i>
                          {task.name} ({task.assignedToResidentName}) vào ngày {task.date}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 italic">Không có nhiệm vụ sắp tới.</p>
                  )}
                </div>

                {/* Widget: Tóm tắt tiền quỹ (Nếu muốn hiển thị chi tiết hơn) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md col-span-full">
                    <h3 className="text-xl font-bold text-orange-700 dark:text-orange-200 mb-3">Tóm tắt chia tiền gần nhất</h3>
                    {costSharingHistory.length > 0 ? (
                        <div>
                            <p className="text-gray-700 dark:text-gray-300"><strong>Kỳ:</strong> {costSharingHistory[0].periodStart} - {costSharingHistory[0].periodEnd}</p>
                            <p className="text-gray-700 dark:text-gray-300"><strong>Tổng ngày có mặt:</strong> {costSharingHistory[0].totalCalculatedDaysAllResidents} ngày</p>
                            <p className="text-gray-700 dark:text-gray-300"><strong>Tiền/ngày/người:</strong> {costSharingHistory[0].costPerDayPerPerson?.toLocaleString('vi-VN', {maximumFractionDigits: 0})} VND</p>
                            <p className="text-gray-700 dark:text-gray-300"><strong>Quỹ còn lại:</strong> {costSharingHistory[0].remainingFund?.toLocaleString('vi-VN')} VND</p>
                        </div>
                    ) : (
                        <p className="text-gray-600 dark:text-gray-400 italic">Chưa có bản chia tiền nào.</p>
                    )}
                </div>

                {/* Các biểu đồ/thống kê trực quan (placeholder) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md col-span-full text-center text-gray-500 dark:text-gray-400">
                  <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-3">Biểu đồ tiêu thụ điện nước (Cần thư viện biểu đồ)</h3>
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
                  <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có dữ liệu thống kê nào để tạo biểu đồ. Vui lòng tính toán hóa đơn.</p>
                )}                
                </div>
              </div>
            </div>
          );
        case 'residentManagement':
          return (
            <div className="p-6 bg-purple-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-200 mb-5">Quản lý người trong phòng</h2>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  type="text"
                  value={newResidentName}
                  onChange={(e) => { setNewResidentName(e.target.value); setAuthError(''); }}
                  className="flex-1 shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
                  placeholder="Nhập tên người trong phòng (tối đa 8 người)"
                  maxLength="30"
                />
                <button
                  onClick={handleAddResident}
                  className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-xl shadow-md hover:bg-purple-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                  disabled={residents.filter(res => res.isActive !== false).length >= 8}
                >
                  <i className="fas fa-user-plus mr-2"></i> Thêm
                </button>
              </div>
              {residents.length > 0 && (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-inner max-h-screen-1/2 overflow-y-auto border border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-purple-700 dark:text-purple-200 mb-3">Danh sách người trong phòng:</h3>
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
                      <li key={resident.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-gray-700 dark:text-gray-300 text-base">{resident.name}</span>
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
        case 'attendanceTracking':
          return (
            <div className="p-6 bg-green-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-5">Điểm danh theo tháng</h2>
              <div className="mb-6 flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <label htmlFor="monthSelector" className="font-semibold text-gray-700 dark:text-gray-300 text-lg">Chọn tháng:</label>
                <input
                  type="month"
                  id="monthSelector"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>

              {displayedResidents.length === 0 ? (
                userRole === 'member' && !loggedInResidentProfile ? (
                  <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.</p>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Vui lòng thêm người trong phòng vào danh sách để bắt đầu điểm danh.</p>
                )
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full bg-white dark:bg-gray-800">
                    <thead><tr>
                      <th className="py-3 px-6 text-left sticky left-0 bg-green-100 dark:bg-gray-700 z-20 border-r border-green-200 dark:border-gray-600 rounded-tl-xl text-green-800 dark:text-green-200 uppercase text-sm leading-normal">Tên</th>
                      {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map(day => (
                        <th key={day} className="py-3 px-2 text-center border-l border-green-200 dark:border-gray-600 text-green-800 dark:text-green-200 uppercase text-sm leading-normal">
                          {day}
                        </th>
                      ))}
                    </tr></thead>
                    <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                      {displayedResidents.map(resident => (
                        <tr key={resident.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                          <td className="py-3 px-6 text-left whitespace-nowrap font-medium sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-700">
                            {resident.name}
                          </td>
                          {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map(day => {
                            const dayString = String(day).padStart(2, '0');
                            const isPresent = monthlyAttendanceData[resident.id]?.[dayString] === 1;
                            return (
                              <td key={day} className="py-3 px-2 text-center border-l border-gray-200 dark:border-gray-700">
                                <input
                                  type="checkbox"
                                  checked={isPresent}
                                  onChange={() => handleToggleDailyPresence(resident.id, day)}
                                  className="form-checkbox h-5 w-5 text-green-600 dark:text-green-400 rounded focus:ring-green-500 cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        case 'billing':
          return (
            <div className="p-6 bg-yellow-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-5">Tính tiền điện nước</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Electricity */}
                <div>
                  <label htmlFor="lastElectricityReading" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                    Chỉ số điện cuối cùng được ghi nhận (KW):
                  </label>
                  <input
                    type="number"
                    id="lastElectricityReading"
                    value={lastElectricityReading}
                    readOnly
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
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
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    placeholder="Nhập chỉ số hiện tại"
                  />
                </div>

                {/* Water */}
                <div>
                  <label htmlFor="lastWaterReading" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                    Chỉ số nước cuối cùng được ghi nhận (m³):
                  </label>
                  <input
                    type="number"
                    id="lastWaterReading"
                    value={lastWaterReading}
                    readOnly
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
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
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    placeholder="Nhập chỉ số hiện tại"
                  />
                </div>
              </div>
              {billingError && (
                <p className="text-red-500 dark:text-red-400 text-sm text-center mb-4">{billingError}</p>
              )}
              <button
                onClick={calculateBill}
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 mb-6"
                disabled={isNaN(parseFloat(currentElectricityReading)) || isNaN(parseFloat(currentWaterReading))}
              >
                <i className="fas fa-calculator mr-2"></i> Tính toán chi phí
              </button>

              {totalCost > 0 && (
                <div className="bg-blue-100 dark:bg-gray-700 p-4 rounded-xl shadow-inner text-lg font-semibold text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-gray-600">
                  <p className="mb-2">Tiền điện: <span className="text-blue-700 dark:text-blue-300">{electricityCost.toLocaleString('vi-VN')} VND</span></p>
                  <p className="mb-2">Tiền nước: <span className="text-blue-700 dark:text-blue-300">{waterCost.toLocaleString('vi-VN')} VND</span></p>
                  <p className="border-t pt-3 mt-3 border-blue-300 dark:border-gray-600 text-xl font-bold">Tổng cộng: <span className="text-blue-800 dark:text-blue-200">{totalCost.toLocaleString('vi-VN')} VND</span></p>
                </div>
              )}
            </div>
          );
        case 'costSharing':
          return (
            <div className="p-6 bg-orange-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-orange-800 dark:text-orange-200 mb-5">Tính ngày có mặt & Chia tiền</h2>
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
                  <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mb-3">Kết quả điểm danh theo ngày:</h3>
                  <ul className="space-y-2 mb-3">
                    {residents.map(resident => (
                      <li key={resident.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{resident.name}:</span>
                        <span className="text-orange-700 dark:text-orange-300 font-bold">{calculatedDaysPresent[resident.id] || 0} ngày</span>
                      </li>
                    ))}
                  </ul>
                  <p className="border-t pt-3 mt-3 border-orange-300 dark:border-gray-600 text-xl font-bold">
                    Tổng số ngày có mặt của tất cả: <span className="text-orange-800 dark:text-orange-200">{totalCalculatedDaysAllResidents} ngày</span>
                  </p>

                  <>
                    <p className="mt-3 text-xl font-bold">
                      Chi phí trung bình 1 ngày 1 người: <span className="text-orange-800 dark:text-orange-200">{costPerDayPerPerson.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} VND</span>
                    </p>
                    <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mt-5 mb-3">Số tiền mỗi người cần đóng:</h3>
                    <ul className="space-y-2">
                      {/* Sắp xếp cư dân để hiển thị dựa trên số ngày có mặt và sau đó là chi phí */}
                      {[...residents].sort((a, b) => {
                        const daysA = calculatedDaysPresent[a.id] || 0;
                        const daysB = calculatedDaysPresent[b.id] || 0;
                        const costA = individualCosts[a.id]?.cost || 0;
                        const costB = individualCosts[b.id]?.cost || 0;

                        if (daysA !== daysB) {
                          return daysB - daysA;
                        }
                        return costB - costA;
                      }).map(resident => (
                        <li key={resident.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{resident.name}:</span>
                          <span className="font-bold">
                            {(individualCosts[resident.id]?.cost || 0).toLocaleString('vi-VN')} VND
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="border-t pt-3 mt-3 border-orange-300 dark:border-gray-600 text-xl font-bold">
                      Quỹ phòng còn lại: <span className={`font-bold ${remainingFund >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        {remainingFund.toLocaleString('vi-VN')} VND
                      </span>
                    </p>

                    {/* Tích hợp Gemini API: Nhắc nhở thanh toán */}
                    <div className="mt-8 pt-3 border-t border-orange-300 dark:border-gray-600">
                      <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mb-4">✨ Tạo nhắc nhở thanh toán</h3>
                      <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
                        <label htmlFor="selectResidentReminder" className="font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Chọn người:</label>
                        <select
                          id="selectResidentReminder"
                          value={selectedResidentForReminder}
                          onChange={(e) => setSelectedResidentForReminder(e.target.value)}
                          className="flex-1 shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700"
                          disabled={residents.length === 0}
                        >
                          <option value="">-- Chọn người --</option>
                          {residents.map(resident => (
                            <option key={resident.id} value={resident.id}>
                              {resident.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={generatePaymentReminder}
                          className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-xl shadow-md hover:bg-purple-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
                          disabled={isGeneratingReminder || !selectedResidentForReminder || totalCost === 0}
                        >
                          {isGeneratingReminder ? (
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                          ) : (
                            <i className="fas fa-magic mr-2"></i>
                          )}
                          Tạo nhắc nhở
                        </button>
                      </div>
                      {generatedReminder && (
                        <div className="mt-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
                          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Tin nhắn gợi ý:</p>
                          <textarea
                            readOnly
                            value={generatedReminder}
                            rows="6"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 resize-y focus:outline-none"
                          ></textarea>
                        </div>
                      )}
                    </div>
                  </>
                </div>
              )}
            </div>
          );
        case 'billHistory':
          return (
            <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Lịch sử tiền điện nước</h2>
              {billHistory.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có hóa đơn nào được lưu.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full bg-white dark:bg-gray-800">
                    <thead><tr>
                      <th className="py-3 px-6 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Ngày tính</th>
                      <th className="py-3 px-6 text-right text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Tổng tiền</th>
                      <th className="py-3 px-6 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Người ghi nhận</th>
                      <th className="py-3 px-6 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Trạng thái</th>
                      <th className="py-3 px-6 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Chi tiết</th>
                    </tr></thead>
                    <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                      {billHistory.map(bill => (
                        <tr key={bill.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                          <td className="py-3 px-6 text-left whitespace-nowrap">
                            {bill.billDate && bill.billDate instanceof Date ? bill.billDate.toLocaleDateString('vi-VN') : 'N/A'}
                          </td>
                          <td className="py-3 px-6 text-right whitespace-nowrap font-bold text-blue-700 dark:text-blue-300">
                            {bill.totalCost?.toLocaleString('vi-VN') || 0} VND
                          </td>
                          <td className="py-3 px-6 text-center whitespace-nowrap">
                            {bill.recordedBy || 'N/A'}
                          </td>
                          <td className="py-3 px-6 text-center">
                            <input
                              type="checkbox"
                              checked={bill.isPaid || false}
                              onChange={() => handleToggleBillPaidStatus(bill.id, bill.isPaid || false)}
                              className="form-checkbox h-5 w-5 text-green-600 dark:text-green-400 rounded cursor-pointer"
                            />
                            <span className={`ml-2 font-semibold ${bill.isPaid ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
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
        case 'costSharingHistory':
          return (
            <div className="p-6 bg-yellow-50 dark:bg-gray-700 rounded-2xl shadow-lg mt-8 max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-5">Lịch sử chia tiền</h2>
              {costSharingHistory.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có lịch sử chia tiền nào được lưu.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full bg-white dark:bg-gray-800">
                    <thead><tr>
                      <th className="py-3 px-6 text-left text-yellow-800 dark:text-yellow-200 uppercase text-sm leading-normal bg-yellow-100 dark:bg-gray-700">Kỳ tính</th>
                      <th className="py-3 px-6 text-right text-yellow-800 dark:text-yellow-200 uppercase text-sm leading-normal bg-yellow-100 dark:bg-gray-700">Tổng ngày có mặt</th>
                      <th className="py-3 px-6 text-right text-yellow-800 dark:text-yellow-200 uppercase text-sm leading-normal bg-yellow-100 dark:bg-gray-700">Quỹ phòng</th>
                      <th className="py-3 px-6 text-center text-yellow-800 dark:text-yellow-200 uppercase text-sm leading-normal bg-yellow-100 dark:bg-gray-700">Chi tiết</th>
                    </tr></thead>
                    <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                      {costSharingHistory.map(summary => (
                        <tr key={summary.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                          <td className="py-3 px-6 text-left whitespace-nowrap">
                            {summary.periodStart} đến {summary.periodEnd}
                          </td>
                          <td className="py-3 px-6 text-right whitespace-nowrap">
                            {summary.totalCalculatedDaysAllResidents} ngày
                          </td>
                          <td className="py-3 px-6 text-right whitespace-nowrap">
                            <span className={`font-bold ${summary.remainingFund >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
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
        case 'cleaningSchedule':
          return (
            <div className="p-6 bg-purple-50 dark:bg-gray-700 rounded-2xl shadow-lg mt-8 max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-200 mb-5">Lịch trực phòng lau dọn</h2>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  type="text"
                  value={newCleaningTaskName}
                  onChange={(e) => { setNewCleaningTaskName(e.target.value); setAuthError(''); }}
                  className="flex-1 shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
                  placeholder="Tên công việc (ví dụ: Lau sàn)"
                />
                <input
                  type="date"
                  value={newCleaningTaskDate}
                  onChange={(e) => { setNewCleaningTaskDate(e.target.value); setAuthError(''); }}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
                <select
                  value={selectedResidentForCleaning}
                  onChange={(e) => { setSelectedResidentForCleaning(e.target.value); setAuthError(''); }}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700"
                >
                  <option value="">-- Chọn người --</option>
                  {residents.filter(res => res.isActive !== false).map(resident => (
                    <option key={resident.id} value={resident.id}>{resident.name}</option>
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
                onClick={() => setShowGenerateScheduleModal(true)} // Mới: Nút để mở modal tạo lịch
                className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 transition-all duration-300"
                disabled={residents.filter(res => res.isActive !== false).length === 0} // Vô hiệu hóa nếu không có cư dân hoạt động
              >
                ✨ Tạo lịch tự động
              </button>
              {cleaningSchedule.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có công việc lau dọn nào được lên lịch.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-700">
                  <h3 className="text-xl font-semibold text-purple-700 dark:text-purple-200 mb-3">Lịch trực hiện có:</h3>
                  <ul className="space-y-2">
                    {cleaningSchedule.map((task) => (
                      <li key={task.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{task.name} ({task.assignedToResidentName})</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Ngày: {task.date}
                          </span>
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
        case 'shoeRackManagement':
          return (
            <div className="p-6 bg-yellow-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-5">Quản lý kệ giày</h2>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <select
                  value={selectedShelfNumber}
                  onChange={(e) => { setSelectedShelfNumber(e.target.value); setAuthError(''); }}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700"
                >
                  <option value="">-- Chọn tầng kệ --</option>
                  {[...Array(8)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>Tầng {i + 1}</option>
                  ))}
                </select>
                <select
                  value={selectedResidentForShelf}
                  onChange={(e) => { setSelectedResidentForShelf(e.target.value); setAuthError(''); }}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700"
                >
                  <option value="">-- Chọn người --</option>
                  {residents.filter(res => res.isActive !== false).map(resident => (
                    <option key={resident.id} value={resident.id}>{resident.name}</option>
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
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có kệ giày nào được gán.</p>
              ) : (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-yellow-700 dark:text-yellow-200 mb-3">Phân công kệ giày:</h3>
                  <ul className="space-y-3">
                    {[...Array(8)].map((_, i) => {
                      const shelfNum = i + 1;
                      const assignment = shoeRackAssignments[shelfNum];
                      const isMyShelf = loggedInResidentProfile && assignment && assignment.residentId === loggedInResidentProfile.id;
                      return (
                        <li key={shelfNum} className={`flex items-center justify-between p-3 rounded-lg shadow-sm border ${isMyShelf ? 'bg-yellow-200 dark:bg-yellow-900 border-yellow-400' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                          <span className={`font-medium ${isMyShelf ? 'text-yellow-900 dark:text-yellow-100' : 'text-gray-700 dark:text-gray-300'}`}>Tầng {shelfNum}:</span>
                          {assignment ? (
                            <span className={`font-bold ${isMyShelf ? 'text-yellow-800 dark:text-yellow-200' : 'text-yellow-700 dark:text-yellow-300'}`}>
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
        case 'commonRoomInfo': // New section for common room information
          return (
            <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Thông tin phòng chung</h2>
              {residents.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có người ở nào trong danh sách.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full bg-white dark:bg-gray-800">
                    <thead>
                      <tr>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Họ tên</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Email</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">SĐT</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">MSSV</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Ngày sinh</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Ngày nhập KTX</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Email trường</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                      {residents.map(resident => {
                        const linkedUser = allUsersData.find(user => user.linkedResidentId === resident.id);
                        return (
                          <tr key={resident.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.fullName || resident.name}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.email || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.phoneNumber || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.studentId || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.birthday || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.dormEntryDate || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.academicLevel || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`font-semibold ${resident.isActive ? 'text-green-600' : 'text-red-500'}`}>
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
        case 'roomMemories': // <--- DI CHUYỂN TOÀN BỘ CASE NÀY LÊN TRÊN default
          return (
            <div className="p-6 bg-indigo-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-indigo-800 dark:text-indigo-200 mb-5">Kỷ niệm phòng</h2>

              {/* Phần đăng ảnh kỷ niệm */}
              <form onSubmit={handleAddMemory} className="mb-8 p-4 bg-indigo-100 dark:bg-gray-800 rounded-xl shadow-inner border border-indigo-200 dark:border-gray-600">
                <h3 className="text-xl font-bold text-indigo-700 dark:text-indigo-200 mb-4">Đăng ảnh kỷ niệm mới</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="eventName" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Sự kiện:</label>
                    <input
                      type="text"
                      id="eventName"
                      value={newMemoryEventName}
                      onChange={(e) => setNewMemoryEventName(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700"
                      placeholder="Ví dụ: Sinh nhật tháng 10"
                    />
                  </div>
                  <div>
                    <label htmlFor="photoDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày chụp:</label>
                    <input
                      type="date"
                      id="photoDate"
                      value={newMemoryPhotoDate}
                      onChange={(e) => setNewMemoryPhotoDate(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="imageFile" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Chọn ảnh:</label>
                    <input
                      type="file"
                      id="imageFile"
                      accept="image/*"
                      onChange={(e) => setNewMemoryImageFile(e.target.files[0])}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>
                  {isUploadingMemory && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  )}
                  {memoryError && <p className="text-red-500 text-sm text-center mt-4">{memoryError}</p>}
                  <button
                    type="submit"
                    className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75"
                    disabled={isUploadingMemory}
                  >
                    {isUploadingMemory ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-upload mr-2"></i>}
                    Đăng kỷ niệm
                  </button>
                </div>
              </form>

              {/* Danh sách các kỷ niệm đã đăng (giống admin) */}
              <h3 className="text-xl font-bold text-indigo-700 dark:text-indigo-200 mb-4">Các kỷ niệm đã đăng</h3>
              {memories.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có kỷ niệm nào được đăng.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {memories.map(memory => (
                    <div key={memory.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer" onClick={() => setSelectedImageToZoom(memory.imageUrl)}>
                      <img src={memory.imageUrl} alt={memory.eventName} className="w-full h-48 object-cover" />
                      <div className="p-4">
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{memory.eventName}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <i className="fas fa-calendar-alt mr-2"></i>Ngày chụp: {memory.photoDate}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <i className="fas fa-upload mr-2"></i>Đăng bởi: {memory.uploadedByName || 'Ẩn danh'} vào {memory.uploadedAt?.toLocaleDateString('vi-VN')}
                        </p>
                        {userRole === 'admin' && ( // Chỉ admin mới có nút xóa
                          <button
                            onClick={() => handleDeleteMemory(memory.id, memory.imageUrl)}
                            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-colors duration-200"
                          >
                            <i className="fas fa-trash mr-2"></i>Xóa
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        case 'formerResidents': // Thông tin tiền bối
          return (
            <div className="p-6 bg-green-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-5">Thông tin tiền bối</h2>

              {/* Form thêm tiền bối thủ công (Chỉ cho Admin) */}
              {userRole === 'admin' && (
                <form onSubmit={handleAddFormerResidentManually} className="mb-8 p-4 bg-green-100 dark:bg-gray-800 rounded-xl shadow-inner border border-green-200 dark:border-gray-600">
                  <h3 className="text-xl font-bold text-green-700 dark:text-green-200 mb-4">Thêm tiền bối thủ công</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="formerName" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Họ tên:</label>
                      <input type="text" id="formerName" value={newFormerResidentName} onChange={(e) => setNewFormerResidentName(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" placeholder="Nguyễn Văn A" />
                    </div>
                    <div>
                      <label htmlFor="formerEmail" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Email:</label>
                      <input type="email" id="formerEmail" value={newFormerResidentEmail} onChange={(e) => setNewFormerResidentEmail(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" placeholder="nguyenvana@example.com" />
                    </div>
                    <div>
                      <label htmlFor="formerPhone" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">SĐT:</label>
                      <input type="text" id="formerPhone" value={newFormerResidentPhone} onChange={(e) => setNewFormerResidentPhone(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" placeholder="0123456789" />
                    </div>
                    <div>
                      <label htmlFor="formerStudentId" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">MSSV:</label>
                      <input type="text" id="formerStudentId" value={newFormerResidentStudentId} onChange={(e) => setNewFormerResidentStudentId(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" placeholder="B1234567" />
                    </div>
                    <div>
                      <label htmlFor="formerBirthday" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày sinh:</label>
                      <input type="date" id="formerBirthday" value={newFormerResidentBirthday} onChange={(e) => setNewFormerResidentBirthday(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" />
                    </div>
                    <div>
                      <label htmlFor="formerDormEntryDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày nhập KTX:</label>
                      <input type="date" id="formerDormEntryDate" value={newFormerResidentDormEntryDate} onChange={(e) => setNewFormerResidentDormEntryDate(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" />
                    </div>
                    <div>
                      <label htmlFor="formerAcademicLevel" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Cấp:</label>
                      <input type="text" id="formerAcademicLevel" value={newFormerResidentAcademicLevel} onChange={(e) => setNewFormerResidentAcademicLevel(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" placeholder="Đại học" />
                    </div>
                    <div>
                      <label htmlFor="formerDeactivatedDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày ra khỏi phòng (Ngày vô hiệu hóa):</label>
                      <input type="date" id="formerDeactivatedDate" value={newFormerResidentDeactivatedDate} onChange={(e) => setNewFormerResidentDeactivatedDate(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" />
                    </div>
                  </div>
                  {/* Toàn bộ div cho input file, progress bar và formerResidentError ĐÃ XÓA */}
                  <button
                    type="submit"
                    className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-xl shadow-md hover:bg-green-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    // Thuộc tính disabled={isUploadingFormerResident} đã bị xóa
                  >
                    <i className="fas fa-plus-circle mr-2"></i>
                    Thêm tiền bối
                  </button>
                </form>
              )}

              {/* Nút "Chuyển người dùng sang tiền bối" (Nếu bạn vẫn muốn dùng chức năng này cho admin, nó thường được đặt ở Quản lý người ở) */}
              {userRole === 'admin' && (
                <button
                  onClick={() => { alert('Nút này dùng để chuyển người ở hiện tại sang tiền bối từ mục "Quản lý người ở".'); }}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 mb-6"
                >
                  <i className="fas fa-exchange-alt mr-2"></i> Chuyển người dùng hiện tại sang tiền bối
                </button>
              )}


              {/* Danh sách các tiền bối đã lưu */}
              <h3 className="text-xl font-bold text-green-700 dark:text-green-200 mb-4">Danh sách tiền bối</h3>
              {formerResidents.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có thông tin tiền bối nào được lưu.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {formerResidents.map(resident => (
                    <div key={resident.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                      {/* Toàn bộ phần hiển thị ảnh (resident.photoURL) ĐÃ XÓA */}
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
                            <i className="fas fa-door-open mr-2"></i>Ngày ra khỏi phòng: {resident.deactivatedAt && typeof resident.deactivatedAt.toLocaleDateString === 'function' ? resident.deactivatedAt.toLocaleDateString('vi-VN') : (resident.deactivatedAt || 'N/A')}
                        </p>
                        {userRole === 'admin' && (
                          <button
                            onClick={() => handleDeleteFormerResident(resident.id)} // <-- Đã sửa: chỉ truyền resident.id
                            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-colors duration-200"
                          >
                            <i className="fas fa-trash mr-2"></i>Xóa
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

        case 'customNotificationDesign': // Đây là case bạn muốn chỉnh sửa
        return (
          <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Thiết kế thông báo tùy chỉnh</h2>

            {/* Form soạn thông báo mới - Giữ nguyên */}
            <form onSubmit={handleSendCustomNotification} className="mb-8 p-4 bg-blue-100 dark:bg-gray-800 rounded-xl shadow-inner border border-blue-200 dark:border-gray-600">
              <h3 className="text-xl font-bold text-blue-700 dark:text-blue-200 mb-4">Soạn thông báo mới</h3>
              <div className="space-y-4">
                {/* Tiêu đề thông báo (Tùy chọn) */}
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
                    {residents.filter(res => res.isActive).map(resident => { // Chỉ hiển thị cư dân đang hoạt động
                        const linkedUser = allUsersData.find(user => user.linkedResidentId === resident.id);
                        if (linkedUser) { // Chỉ hiển thị người dùng có tài khoản liên kết
                          return <option key={linkedUser.id} value={linkedUser.id}>{linkedUser.fullName || resident.name}</option>;
                        }
                        return null;
                    })}
                  </select>
                </div>

                {/* Loại thông báo */}
                <div>
                  <label htmlFor="notificationType" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Loại thông báo:</label>
                  <select
                    id="notificationType"
                    value={newNotificationType}
                    onChange={(e) => setNewNotificationType(e.target.value)}
                    className="shadow-sm appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="general">Thông báo chung</option>
                    <option value="urgent">Thông báo khẩn</option>
                    <option value="custom">Thông báo tiền điện nước</option>
                    {/* Có thể thêm các loại khác nếu cần */}
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

                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                >
                  <i className="fas fa-paper-plane mr-2"></i> Gửi thông báo
                </button>
              </div>
            </form>

            {/* ==================================================================== */}
            {/* PHẦN MỚI ĐƯỢC DI CHUYỂN TỪ 'notifications' VÀ CHỈ DÀNH CHO ADMIN */}
            {/* ==================================================================== */}
            <div className="mt-8 pt-6 border-t border-gray-300 dark:border-gray-600">
              <h3 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Danh sách thông báo đã gửi/nhận</h3>
              {notificationError && <p className="text-red-500 text-sm text-center mb-4">{notificationError}</p>}
              {notifications.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có thông báo nào.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full bg-white dark:bg-gray-800">
                    <thead>
                      <tr>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Nội dung tóm tắt</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Loại</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Người nhận</th> {/* Mới */}
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Thời gian</th>
                        <th className="py-3 px-4 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Trạng thái</th>
                        <th className="py-3 px-4 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Chi tiết</th>
                        <th className="py-3 px-4 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                      {/* Lọc thông báo: admin xem tất cả, thành viên chỉ xem của mình */}
                      {notifications.map(notification => (
                        <tr
                          key={notification.id}
                          className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${!notification.isRead ? 'font-semibold' : ''}`}
                        >
                          <td className="py-3 px-4 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                            {notification.message}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {notification.type}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {notification.recipientId === 'all' ? 'Tất cả' : (allUsersData.find(u => u.id === notification.recipientId)?.fullName || 'N/A')}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {notification.createdAt instanceof Date ? notification.createdAt.toLocaleDateString('vi-VN') : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${notification.isRead ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                              {notification.isRead ? 'Đã đọc' : 'Chưa đọc'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => { setSelectedNotificationDetails(notification); markNotificationAsRead(notification.id); }}
                              className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg shadow-sm hover:bg-blue-600 transition-colors"
                            >
                              Xem
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg shadow-sm hover:bg-red-600 transition-colors"
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
          </div>
        );

        case 'adminProfileEdit': // Mới: Chỉnh sửa thông tin cá nhân cho Admin
          return (
            <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Chỉnh sửa hồ sơ của tôi</h2>
              {/* Form chỉnh sửa profile tương tự như member */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="adminEditFullName" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Họ tên đầy đủ:</label>
                  <input
                    type="text"
                    id="adminEditFullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label htmlFor="adminEditPhoneNumber" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Số điện thoại:</label>
                  <input
                    type="text"
                    id="adminEditPhoneNumber"
                    value={memberPhoneNumber} // Vẫn dùng state này
                    onChange={(e) => setMemberPhoneNumber(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label htmlFor="adminEditStudentId" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Mã số sinh viên:</label>
                  <input
                    type="text"
                    id="adminEditStudentId"
                    value={memberStudentId} // Vẫn dùng state này
                    onChange={(e) => setMemberStudentId(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label htmlFor="adminEditBirthday" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày sinh:</label>
                  <input
                    type="date"
                    id="adminEditBirthday"
                    value={memberBirthday} // Vẫn dùng state này
                    onChange={(e) => setMemberBirthday(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label htmlFor="adminEditDormEntryDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày nhập KTX:</label>
                  <input
                    type="date"
                    id="adminEditDormEntryDate"
                    value={memberDormEntryDate} // Vẫn dùng state này
                    onChange={(e) => setMemberDormEntryDate(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label htmlFor="adminEditAcademicLevel" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Email trường:</label>
                  <input
                    type="text"
                    id="adminEditAcademicLevel"
                    value={memberAcademicLevel} // Vẫn dùng state này
                    onChange={(e) => setMemberAcademicLevel(e.target.value)}
                    className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                  />
                </div>

                {authError && <p className="text-red-500 text-sm text-center mt-4">{authError}</p>}

                <button
                  onClick={handleSaveUserProfile} // Gọi hàm đã được đổi tên
                  className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
                >
                  <i className="fas fa-save mr-2"></i> Lưu thông tin
                </button>
                {/* Có thể thêm nút "Hủy" nếu muốn, nhưng admin sẽ không có chế độ "editProfileMode" như member */}

                {/* Mới: Phần đổi mật khẩu */}
              <div className="mt-10 pt-6 border-t border-gray-300 dark:border-gray-600">
                <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Đổi mật khẩu</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="oldPasswordAdmin" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Mật khẩu cũ:</label>
                    <input
                      type="password"
                      id="oldPasswordAdmin"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nhập mật khẩu cũ"
                    />
                  </div>
                  <div>
                    <label htmlFor="newPasswordAdmin" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Mật khẩu mới:</label>
                    <input
                      type="password"
                      id="newPasswordAdmin"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmNewPasswordAdmin" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Xác nhận mật khẩu mới:</label>
                    <input
                      type="password"
                      id="confirmNewPasswordAdmin"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Xác nhận mật khẩu mới"
                    />
                  </div>
                  {passwordChangeMessage && (
                    <p className={`text-sm text-center mt-4 ${passwordChangeMessage.includes('thành công') ? 'text-green-600' : 'text-red-500'}`}>
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
            </div>
          );
        case 'consumptionStats': //Thống kê tiêu thụ 
        return (
          <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Thống kê tiêu thụ theo tháng</h2>
            {Object.keys(monthlyConsumptionStats).length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có dữ liệu thống kê nào. Vui lòng tính toán hóa đơn.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-full bg-white dark:bg-gray-800">
                  <thead>
                    <tr>
                      <th className="py-3 px-6 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Tháng</th>
                      <th className="py-3 px-6 text-right text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Điện (KW)</th>
                      <th className="py-3 px-6 text-right text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Nước (m³)</th>
                      <th className="py-3 px-6 text-right text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Tổng tiền (VND)</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                    {Object.entries(monthlyConsumptionStats).map(([month, stats]) => (
                      <tr key={month} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                        <td className="py-3 px-6 text-left whitespace-nowrap">{month}</td>
                        <td className="py-3 px-6 text-right whitespace-nowrap">{stats.electricity.toLocaleString('vi-VN')}</td>
                        <td className="py-3 px-6 text-right whitespace-nowrap">{stats.water.toLocaleString('vi-VN')}</td>
                        <td className="py-3 px-6 text-right whitespace-nowrap font-bold text-blue-700 dark:text-blue-300">
                          {stats.total.toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      }
    }
    // Logic cho Thành viên
    if (userRole === 'member') {
      // Lọc các nhiệm vụ trực phòng sắp tới của riêng thành viên
      const upcomingMyCleaningTasks = cleaningSchedule.filter(task =>
        loggedInResidentProfile && !task.isCompleted &&
        task.assignedToResidentId === loggedInResidentProfile.id &&
        new Date(task.date) >= new Date()
      ).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sắp xếp theo ngày tăng dần

      // Lấy chi phí cá nhân gần nhất của thành viên
      const myLatestCost = costSharingHistory.length > 0 && loggedInResidentProfile
          ? costSharingHistory[0].individualCosts?.[loggedInResidentProfile.id]?.cost || 0
          : 0;
      const myLatestCostIsPaid = costSharingHistory.length > 0 && loggedInResidentProfile
          ? costSharingHistory[0].individualCosts?.[loggedInResidentProfile.id]?.isPaid || false
          : false;
      const myLatestCostPeriod = costSharingHistory.length > 0
          ? `${costSharingHistory[0].periodStart} - ${costSharingHistory[0].periodEnd}`
          : 'N/A';
      switch (activeSection) {
        case 'dashboard': // MỚI: Dashboard cho Thành viên
          return (
            <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-5">Dashboard Tổng quan</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Widget: Thông báo chưa đọc */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col items-center justify-center">
                  <i className="fas fa-bell text-4xl text-yellow-500 mb-3"></i>
                  <p className="text-lg text-gray-700 dark:text-gray-300">Thông báo chưa đọc</p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-300">
                    {unreadNotificationsCount}
                  </p>
                </div>

                {/* Widget: Chi phí cần đóng gần nhất */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col items-center justify-center">
                  <i className="fas fa-money-bill-wave text-4xl text-orange-500 mb-3"></i>
                  <p className="text-lg text-gray-700 dark:text-gray-300">Tiền cần đóng</p>
                  <p className={`text-3xl font-bold ${myLatestCostIsPaid ? 'text-green-600' : 'text-red-500'} dark:text-green-300`}>
                    {myLatestCost.toLocaleString('vi-VN')} VND
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {myLatestCostIsPaid ? 'Đã đóng' : `Chưa đóng (Kỳ: ${myLatestCostPeriod})`}
                  </p>
                </div>

                {/* Widget: Nhiệm vụ trực phòng sắp tới của tôi */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md col-span-full">
                  <h3 className="text-xl font-bold text-purple-700 dark:text-purple-200 mb-3">Nhiệm vụ trực phòng sắp tới</h3>
                  {upcomingMyCleaningTasks.length > 0 ? (
                    <ul className="space-y-2">
                      {upcomingMyCleaningTasks.slice(0, 3).map(task => ( // Chỉ hiển thị 3 nhiệm vụ đầu
                        <li key={task.id} className="text-gray-700 dark:text-gray-300">
                          <i className="fas fa-check-circle mr-2 text-purple-500"></i>
                          {task.name} vào ngày {task.date}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 italic">Bạn không có nhiệm vụ trực phòng sắp tới.</p>
                  )}
                </div>

                {/* Widget: Tổng số ngày có mặt của tôi trong tháng này */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md col-span-full">
                    <h3 className="text-xl font-bold text-green-700 dark:text-green-200 mb-3">Điểm danh tháng này ({selectedMonth})</h3>
                    {loggedInResidentProfile && monthlyAttendanceData[loggedInResidentProfile.id] ? (
                        <p className="text-gray-700 dark:text-gray-300 text-lg">
                            Bạn đã có mặt: <span className="font-bold text-green-600">
                                {Object.values(monthlyAttendanceData[loggedInResidentProfile.id]).filter(status => status === 1).length}
                            </span> / {daysInSelectedMonth} ngày
                        </p>
                    ) : (
                        <p className="text-gray-600 dark:text-gray-400 italic">Chưa có dữ liệu điểm danh tháng này.</p>
                    )}
                </div>

              </div>
            </div>
          );
          case 'attendanceTracking': // Điểm danh của tôi
          return (
            <div className="p-6 bg-green-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-5">Điểm danh của tôi</h2>
              {/* Giữ nguyên phần chọn tháng */}
              <div className="mb-6 flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <label htmlFor="monthSelector" className="font-semibold text-gray-700 dark:text-gray-300 text-lg">Chọn tháng:</label>
                <input
                  type="month"
                  id="monthSelector"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700"
                />
              </div>

              {displayedResidents.length === 0 ? (
                // Thông báo này sẽ ít khi xuất hiện vì displayedResidents giờ chứa tất cả cư dân hoạt động
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có người ở nào trong danh sách hoạt động.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full bg-white dark:bg-gray-800">
                    <thead><tr>
                      <th className="py-3 px-6 text-left sticky left-0 bg-green-100 dark:bg-gray-700 z-20 border-r border-green-200 dark:border-gray-600 rounded-tl-xl text-green-800 dark:text-green-200 uppercase text-sm leading-normal">Tên</th>
                      {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map(day => (
                        <th key={day} className="py-3 px-2 text-center border-l border-green-200 dark:border-gray-600 text-green-800 dark:text-green-200 uppercase text-sm leading-normal">
                          {day}
                        </th>
                      ))}
                    </tr></thead>
                    <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                      {displayedResidents.map(resident => {
                        // MỚI: Xác định xem hàng này có phải của người dùng đang đăng nhập không
                        const isMyRow = userRole === 'member' && loggedInResidentProfile && resident.id === loggedInResidentProfile.id;

                        return (
                          <tr key={resident.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                            <td className="py-3 px-6 text-left whitespace-nowrap font-medium sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-700">
                              {resident.name}
                              {!isMyRow && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400"></span>} {/* Thêm nhãn để phân biệt */}
                            </td>
                            {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map(day => {
                              const dayString = String(day).padStart(2, '0');
                              const isPresent = monthlyAttendanceData[resident.id]?.[dayString] === 1;
                              return (
                                <td key={day} className="py-3 px-2 text-center border-l border-gray-200 dark:border-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={isPresent}
                                    onChange={() => handleToggleDailyPresence(resident.id, day)}
                                    disabled={userRole === 'member' && !isMyRow} // MỚI: Vô hiệu hóa nếu là member và không phải hàng của mình
                                    className="form-checkbox h-5 w-5 text-green-600 dark:text-green-400 rounded focus:ring-green-500 cursor-pointer"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
          case 'memberCostSummary': // Chi phí của tôi
          // Hiển thị tóm tắt chi phí mới nhất và nút đánh dấu đã đóng
          const latestCostSharingRecord = costSharingHistory[0];
          return (
            <div className="p-6 bg-orange-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-orange-800 dark:text-orange-200 mb-5">Chi phí của tôi</h2>
              {!loggedInResidentProfile ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.</p>
              ) : !latestCostSharingRecord || !latestCostSharingRecord.individualCosts || !latestCostSharingRecord.individualCosts[loggedInResidentProfile.id] ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có thông tin chi phí nào cho bạn.</p>
              ) : (
                <div className="bg-orange-100 dark:bg-gray-700 p-4 rounded-xl shadow-inner text-lg font-semibold text-orange-900 dark:text-orange-100 border border-orange-200 dark:border-gray-600">
                  <p className="mb-2"><strong>Kỳ tính:</strong> {latestCostSharingRecord.periodStart} đến {latestCostSharingRecord.periodEnd}</p>
                  <p className="mb-2"><strong>Số ngày có mặt:</strong> {latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]?.daysPresent || 0} ngày</p>
                  <p className="mb-2 text-xl font-bold border-t pt-3 mt-3 border-orange-300 dark:border-gray-600">
                    Số tiền cần đóng: <span className="text-orange-800 dark:text-orange-200">
                      {(latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]?.cost || 0).toLocaleString('vi-VN')} VND
                    </span>
                  </p>
                  <p className="text-lg font-bold">
                    Trạng thái: <span className={latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]?.isPaid ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                      {latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]?.isPaid ? 'Đã đóng' : 'Chưa đóng'}
                    </span>
                  </p>
                  {authError && <p className="text-red-500 text-sm text-center mt-4">{authError}</p>}
                  {!latestCostSharingRecord.individualCosts[loggedInResidentProfile.id]?.isPaid && (
                    <button
                      onClick={handleMarkMyPaymentAsPaid}
                      className="w-full mt-4 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl shadow-md hover:bg-green-700 transition-all duration-300"
                    >
                      <i className="fas fa-check-circle mr-2"></i> Đánh dấu đã đóng
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        case 'memberCleaningSchedule': // Lịch trực của tôi
          // Hiển thị lịch trực nhưng chỉ những nhiệm vụ được giao cho thành viên đó
          const myCleaningTasks = cleaningSchedule.filter(task =>
            loggedInResidentProfile && task.assignedToResidentId === loggedInResidentProfile.id
          );
          return (
            <div className="p-6 bg-purple-50 dark:bg-gray-700 rounded-2xl shadow-lg mt-8 max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-200 mb-5">Lịch trực của tôi</h2>
              {!loggedInResidentProfile ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.</p>
              ) : myCleaningTasks.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa có công việc lau dọn nào được giao.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-700">
                  <ul className="space-y-2">
                    {myCleaningTasks.map((task) => (
                      <li key={task.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{task.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Ngày: {task.date}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`ml-2 text-sm font-semibold ${task.isCompleted ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
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
        case 'shoeRackManagement': // Thông tin kệ giày (chỉ hiển thị kệ của mình nếu có)
          return (
            <div className="p-6 bg-yellow-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-5">Thông tin kệ giày</h2>
              {!loggedInResidentProfile ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.</p>
              ) : (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-yellow-700 dark:text-yellow-200 mb-3">Phân công kệ giày của bạn:</h3>
                  <ul className="space-y-3">
                    {[...Array(8)].map((_, i) => {
                      const shelfNum = i + 1;
                      const assignment = shoeRackAssignments[shelfNum];
                      const isMyShelf = loggedInResidentProfile && assignment && assignment.residentId === loggedInResidentProfile.id;
                      return (
                        <li key={shelfNum} className={`flex items-center justify-between p-3 rounded-lg shadow-sm border ${isMyShelf ? 'bg-yellow-200 dark:bg-yellow-900 border-yellow-400' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                          <span className={`font-medium ${isMyShelf ? 'text-yellow-900 dark:text-yellow-100' : 'text-gray-700 dark:text-gray-300'}`}>Tầng {shelfNum}:</span>
                          {isMyShelf ? (
                            <span className={`font-bold ${isMyShelf ? 'text-yellow-800 dark:text-yellow-200' : 'text-yellow-700 dark:text-yellow-300'}`}>
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
        case 'commonRoomInfo': // Thông tin phòng chung (thành viên có thể xem)
          return (
            <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Thông tin phòng chung</h2>
              {residents.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có người ở nào trong danh sách.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full bg-white dark:bg-gray-800">
                    <thead>
                      <tr>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Họ tên</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Email</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">SĐT</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">MSSV</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Ngày sinh</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Ngày nhập KTX</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Email trường</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                      {residents.map(resident => {
                        const linkedUser = allUsersData.find(user => user.linkedResidentId === resident.id);
                        return (
                          <tr key={resident.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.fullName || resident.name}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.email || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.phoneNumber || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.studentId || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.birthday || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.dormEntryDate || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">{linkedUser?.academicLevel || 'N/A'}</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`font-semibold ${resident.isActive ? 'text-green-600' : 'text-red-500'}`}>
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
        case 'memberProfileEdit': // Chỉnh sửa thông tin cá nhân (thành viên có thể tự chỉnh sửa)
          return (
            <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Chỉnh sửa thông tin cá nhân</h2>
              {!loggedInResidentProfile ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.</p>
              ) : (
                <div className="space-y-4">
                  {/* CÁC TRƯỜNG DỮ LIỆU CÁ NHÂN ĐỂ CHỈNH SỬA */}
                  <div>
                    <label htmlFor="editFullName" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Họ tên đầy đủ:</label>
                    <input
                      type="text"
                      id="editFullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="editPhoneNumber" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Số điện thoại:</label>
                    <input
                      type="text"
                      id="editPhoneNumber"
                      value={memberPhoneNumber}
                      onChange={(e) => setMemberPhoneNumber(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="editStudentId" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Mã số sinh viên:</label>
                    <input
                      type="text"
                      id="editStudentId"
                      value={memberStudentId}
                      onChange={(e) => setMemberStudentId(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="editBirthday" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày sinh:</label>
                    <input
                      type="date"
                      id="editBirthday"
                      value={memberBirthday}
                      onChange={(e) => setMemberBirthday(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="editDormEntryDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày nhập KTX:</label>
                    <input
                      type="date"
                      id="editDormEntryDate"
                      value={memberDormEntryDate}
                      onChange={(e) => setMemberDormEntryDate(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="editAcademicLevel" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Email trường:</label>
                    <input
                      type="text"
                      id="editAcademicLevel"
                      value={memberAcademicLevel}
                      onChange={(e) => setMemberAcademicLevel(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>

                  {authError && <p className="text-red-500 text-sm text-center mt-4">{authError}</p>}

                  <button
                    onClick={handleSaveUserProfile} // <-- Đã đổi tên hàm
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
              {/* Mới: Phần đổi mật khẩu */}
              <div className="mt-10 pt-6 border-t border-gray-300 dark:border-gray-600">
                <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Đổi mật khẩu</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="oldPasswordMember" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Mật khẩu cũ:</label>
                    <input
                      type="password"
                      id="oldPasswordMember" // Đổi ID cho phù hợp với member
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nhập mật khẩu cũ"
                    />
                  </div>
                  <div>
                    <label htmlFor="newPasswordMember" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Mật khẩu mới:</label>
                    <input
                      type="password"
                      id="newPasswordMember" // Đổi ID cho phù hợp với member
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmNewPasswordMember" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Xác nhận mật khẩu mới:</label>
                    <input
                      type="password"
                      id="confirmNewPasswordMember" // Đổi ID cho phù hợp với member
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="shadow-sm appearance-none border rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Xác nhận mật khẩu mới"
                    />
                  </div>
                  {passwordChangeMessage && (
                    <p className={`text-sm text-center mt-4 ${passwordChangeMessage.includes('thành công') ? 'text-green-600' : 'text-red-500'}`}>
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
          case 'roomMemories':    // <--- Đảm bảo case này nằm TRƯỚC default
          return (
            <div className="p-6 bg-indigo-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-indigo-800 dark:text-indigo-200 mb-5">Kỷ niệm phòng</h2>

              {/* Phần đăng ảnh kỷ niệm */}
              <form onSubmit={handleAddMemory} className="mb-8 p-4 bg-indigo-100 dark:bg-gray-800 rounded-xl shadow-inner border border-indigo-200 dark:border-gray-600 ">
                <h3 className="text-xl font-bold text-indigo-700 dark:text-indigo-200 mb-4">Đăng ảnh kỷ niệm mới</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="eventName" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Sự kiện:</label>
                    <input
                      type="text"
                      id="eventName"
                      value={newMemoryEventName}
                      onChange={(e) => setNewMemoryEventName(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700"
                      placeholder="Ví dụ: Sinh nhật tháng 10"
                    />
                  </div>
                  <div>
                    <label htmlFor="photoDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày chụp:</label>
                    <input
                      type="date"
                      id="photoDate"
                      value={newMemoryPhotoDate}
                      onChange={(e) => setNewMemoryPhotoDate(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl w-full py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="imageFile" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Chọn ảnh:</label>
                    <input
                      type="file"
                      id="imageFile"
                      accept="image/*"
                      onChange={(e) => setNewMemoryImageFile(e.target.files[0])}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>
                  {isUploadingMemory && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  )}
                  {memoryError && <p className="text-red-500 text-sm text-center mt-4">{memoryError}</p>}
                  <button
                    type="submit"
                    className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75"
                    disabled={isUploadingMemory}
                  >
                    {isUploadingMemory ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-upload mr-2"></i>}
                    Đăng kỷ niệm
                  </button>
                </div>
              </form>

              {/* Danh sách các kỷ niệm đã đăng */}
              <h3 className="text-xl font-bold text-indigo-700 dark:text-indigo-200 mb-4">Các kỷ niệm đã đăng</h3>
              {memories.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có kỷ niệm nào được đăng.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {memories.map(memory => (
                    <div key={memory.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer" onClick={() => setSelectedImageToZoom(memory.imageUrl)}>
                      <img src={memory.imageUrl} alt={memory.eventName} className="w-full h-48 object-cover" />
                      <div className="p-4">
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{memory.eventName}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <i className="fas fa-calendar-alt mr-2"></i>Ngày chụp: {memory.photoDate}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <i className="fas fa-upload mr-2"></i>Đăng bởi: {memory.uploadedByName || 'Ẩn danh'} vào {memory.uploadedAt?.toLocaleDateString('vi-VN')}
                        </p>
                        {userRole === 'admin' && ( // Chỉ admin mới có nút xóa
                          <button
                            onClick={() => handleDeleteMemory(memory.id, memory.imageUrl)}
                            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-colors duration-200"
                          >
                            <i className="fas fa-trash mr-2"></i>Xóa
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        case 'formerResidents': // <--- Đảm bảo case này nằm TRƯỚC default
          return (
            <div className="p-6 bg-green-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-5">Thông tin tiền bối</h2>

              {/* Form thêm tiền bối thủ công (Chỉ cho Admin) */}
              {userRole === 'admin' && (
                <form onSubmit={handleAddFormerResidentManually} className="mb-8 p-4 bg-green-100 dark:bg-gray-800 rounded-xl shadow-inner border border-green-200 dark:border-gray-600">
                  <h3 className="text-xl font-bold text-green-700 dark:text-green-200 mb-4">Thêm tiền bối thủ công</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="formerName" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Họ tên:</label>
                      <input type="text" id="formerName" value={newFormerResidentName} onChange={(e) => setNewFormerResidentName(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" placeholder="Nguyễn Văn A" />
                    </div>
                    <div>
                      <label htmlFor="formerEmail" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Email:</label>
                      <input type="email" id="formerEmail" value={newFormerResidentEmail} onChange={(e) => setNewFormerResidentEmail(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" placeholder="nguyenvana@example.com" />
                    </div>
                    <div>
                      <label htmlFor="formerPhone" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">SĐT:</label>
                      <input type="text" id="formerPhone" value={newFormerResidentPhone} onChange={(e) => setNewFormerResidentPhone(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" placeholder="0123456789" />
                    </div>
                    <div>
                      <label htmlFor="formerStudentId" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">MSSV:</label>
                      <input type="text" id="formerStudentId" value={newFormerResidentStudentId} onChange={(e) => setNewFormerResidentStudentId(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" placeholder="B1234567" />
                    </div>
                    <div>
                      <label htmlFor="formerBirthday" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày sinh:</label>
                      <input type="date" id="formerBirthday" value={newFormerResidentBirthday} onChange={(e) => setNewFormerResidentBirthday(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" />
                    </div>
                    <div>
                      <label htmlFor="formerDormEntryDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày nhập KTX:</label>
                      <input type="date" id="formerDormEntryDate" value={newFormerResidentDormEntryDate} onChange={(e) => setNewFormerResidentDormEntryDate(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" />
                    </div>
                    <div>
                      <label htmlFor="formerAcademicLevel" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Cấp:</label>
                      <input type="text" id="formerAcademicLevel" value={newFormerResidentAcademicLevel} onChange={(e) => setNewFormerResidentAcademicLevel(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" placeholder="Đại học" />
                    </div>
                    <div>
                      <label htmlFor="formerDeactivatedDate" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Ngày ra khỏi phòng (Ngày vô hiệu hóa):</label>
                      <input type="date" id="formerDeactivatedDate" value={newFormerResidentDeactivatedDate} onChange={(e) => setNewFormerResidentDeactivatedDate(e.target.value)}
                        className="shadow-sm border rounded-xl w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:ring-green-500 focus:border-green-500" />
                    </div>
                  </div>
                  {/* Toàn bộ div cho input file, progress bar và formerResidentError ĐÃ XÓA */}
                  <button
                    type="submit"
                    className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-xl shadow-md hover:bg-green-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                    // Thuộc tính disabled={isUploadingFormerResident} đã bị xóa
                  >
                    <i className="fas fa-plus-circle mr-2"></i>
                    Thêm tiền bối
                  </button>
                </form>
              )}

              {/* Nút "Chuyển người dùng sang tiền bối" (Nếu bạn vẫn muốn dùng chức năng này cho admin, nó thường được đặt ở Quản lý người ở) */}
              {userRole === 'admin' && (
                <button
                  onClick={() => { alert('Nút này dùng để chuyển người ở hiện tại sang tiền bối từ mục "Quản lý người ở".'); }}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 mb-6"
                >
                  <i className="fas fa-exchange-alt mr-2"></i> Chuyển người dùng hiện tại sang tiền bối
                </button>
              )}


              {/* Danh sách các tiền bối đã lưu */}
              <h3 className="text-xl font-bold text-green-700 dark:text-green-200 mb-4">Danh sách tiền bối</h3>
              {formerResidents.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có thông tin tiền bối nào được lưu.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {formerResidents.map(resident => (
                    <div key={resident.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                      {/* Toàn bộ phần hiển thị ảnh (resident.photoURL) ĐÃ XÓA */}
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
                            <i className="fas fa-door-open mr-2"></i>Ngày ra khỏi phòng: {resident.deactivatedAt && typeof resident.deactivatedAt.toLocaleDateString === 'function' ? resident.deactivatedAt.toLocaleDateString('vi-VN') : (resident.deactivatedAt || 'N/A')}
                        </p>
                        {userRole === 'admin' && (
                          <button
                            onClick={() => handleDeleteFormerResident(resident.id)} // <-- Đã sửa: chỉ truyền resident.id
                            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-colors duration-200"
                          >
                            <i className="fas fa-trash mr-2"></i>Xóa
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          case 'notifications': // Vẫn giữ nguyên cho member
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
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Nội dung tóm tắt</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Loại</th>
                        <th className="py-3 px-4 text-left text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Thời gian</th>
                        <th className="py-3 px-4 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Trạng thái</th>
                        <th className="py-3 px-4 text-center text-blue-800 dark:text-blue-200 uppercase text-sm leading-normal bg-blue-100 dark:bg-gray-700">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300 text-sm font-light">
                      {notifications.map(notification => (
                        <tr
                          key={notification.id}
                          className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${!notification.isRead ? 'font-semibold' : ''}`}
                        >
                          <td className="py-3 px-4 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                            {notification.message}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {notification.type}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {notification.createdAt instanceof Date ? notification.createdAt.toLocaleDateString('vi-VN') : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${notification.isRead ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                              {notification.isRead ? 'Đã đọc' : 'Chưa đọc'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => { setSelectedNotificationDetails(notification); markNotificationAsRead(notification.id); }}
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
          default:
          return (
            <div className="text-center p-8 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner">
              <p className="text-xl text-gray-700 dark:text-gray-300 font-semibold mb-4">
                Chào mừng Thành viên! Vui lòng chọn một mục từ thanh điều hướng.
              </p>
            </div>
          );

          case 'memberProfileEdit': // Chỉnh sửa thông tin cá nhân (thành viên có thể tự chỉnh sửa)
          return (
            <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Chỉnh sửa thông tin cá nhân</h2>
              {!loggedInResidentProfile ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.</p>
              ) : (
                <div className="space-y-4">
                  {/* ... (Các trường Họ tên, SĐT, MSSV, v.v. hiện có) ... */}

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

              {/* Mới: Phần đổi mật khẩu */}
              <div className="mt-10 pt-6 border-t border-gray-300 dark:border-gray-600">
                <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Đổi mật khẩu</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="oldPasswordMember" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Mật khẩu cũ:</label>
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
                    <label htmlFor="newPasswordMember" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Mật khẩu mới:</label>
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
                    <label htmlFor="confirmNewPasswordMember" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Xác nhận mật khẩu mới:</label>
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
                    <p className={`text-sm text-center mt-4 ${passwordChangeMessage.includes('thành công') ? 'text-green-600' : 'text-red-500'}`}>
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
      }
    }

    // Trường hợp không có vai trò hoặc không xác định (hiển thị khi chưa đăng nhập)
    return (
      <div className="text-center p-8 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner">
        <p className="text-xl text-gray-700 dark:text-gray-300 font-semibold mb-4">Vui lòng đăng nhập để sử dụng ứng dụng.</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 dark:from-gray-900 dark:to-gray-700 flex flex-col font-inter">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center sticky top-0 z-30">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Quản lý phòng</h1>
        <div className="flex items-center space-x-4">
          {/* Biểu tượng thông báo */}
          {userId && ( // Chỉ hiển thị nếu đã đăng nhập
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
          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-md hover:shadow-lg transition-all duration-300"
          >
            {theme === 'light' ? (
              <i className="fas fa-moon text-lg"></i>
            ) : (
              <i className="fas fa-sun text-lg"></i>
            )}
          </button>
          {/* Mobile Sidebar Toggle Button */}
          <button
            className="lg:hidden p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <i className="fas fa-bars text-xl"></i>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`flex-shrink-0 fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 shadow-lg p-6 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out z-20 overflow-y-auto`} // <-- Đã thêm overflow-y-auto ở đây
        >
          {/* Close button for mobile sidebar */}
          <div className="flex justify-end lg:hidden mb-4">
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
          <nav className="space-y-2">
            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4">Điều hướng</h3>
            {userId && userRole === 'admin' && ( // Điều hướng Admin
              <>
                <div>
                  <button
                    className={`block w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'dashboard'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    onClick={() => { setActiveSection('dashboard'); setIsSidebarOpen(false); }}
                  >
                    <i className="fas fa-tachometer-alt mr-3"></i> Dashboard
                  </button>
                </div>
                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'residentManagement'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('residentManagement'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-users mr-3"></i> Quản lý người ở
                </button>
                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'attendanceTracking'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('attendanceTracking'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-calendar-alt mr-3"></i> Điểm danh hàng ngày
                </button>
                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'billing'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('billing'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-file-invoice-dollar mr-3"></i> Tính tiền điện nước
                </button>
                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'costSharing'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('costSharing'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-handshake mr-3"></i> Chia tiền & Nhắc nhở
                </button>
                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'billHistory'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('billHistory'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-history mr-3"></i> Lịch sử hóa đơn
                </button>
                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'costSharingHistory'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('costSharingHistory'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-receipt mr-3"></i> Lịch sử chia tiền
                </button>
                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'cleaningSchedule'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('cleaningSchedule'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-broom mr-3"></i> Lịch trực phòng
                </button>
                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'shoeRackManagement'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('shoeRackManagement'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-shoe-prints mr-3"></i> Quản lý kệ giày
                </button>
                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'commonRoomInfo'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('commonRoomInfo'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-info-circle mr-3"></i> Thông tin phòng chung
                </button>
                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'consumptionStats'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('consumptionStats'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-chart-bar mr-3"></i> Thống kê tiêu thụ
                </button>
                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'roomMemories'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('roomMemories'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-camera mr-3"></i> Kỷ niệm phòng
                </button>

                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'customNotificationDesign' // Tên mới cho phần này
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('customNotificationDesign'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-bullhorn mr-3"></i> Thiết kế thông báo
                </button>

                <button
                    className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'formerResidents'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => { setActiveSection('formerResidents'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-user-graduate mr-3"></i> Thông tin tiền bối
                </button>
                <button
                  className={`block mb-1 w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'adminProfileEdit'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('adminProfileEdit'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-user-cog mr-3"></i> Chỉnh sửa hồ sơ của tôi
                </button>
                <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-gray-700"
                  >
                    <i className="fas fa-sign-out-alt mr-3"></i> Đăng xuất
                  </button>
                </div>
              </>
            )}

            {userId && userRole === 'member' && ( // Điều hướng Thành viên
              <>
                <div>
                  <button
                    className={`block w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'dashboard'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    onClick={() => { setActiveSection('dashboard'); setIsSidebarOpen(false); }}
                  >
                    <i className="fas fa-tachometer-alt mr-3"></i> Dashboard
                  </button>
                </div>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'attendanceTracking'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('attendanceTracking'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-calendar-alt mr-3"></i> Điểm danh của tôi
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'memberCostSummary'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('memberCostSummary'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-money-bill-wave mr-3"></i> Chi phí của tôi
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'memberCleaningSchedule'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('memberCleaningSchedule'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-broom mr-3"></i> Lịch trực của tôi
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'shoeRackManagement'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('shoeRackManagement'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-shoe-prints mr-3"></i> Thông tin kệ giày
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'commonRoomInfo'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('commonRoomInfo'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-info-circle mr-3"></i> Thông tin phòng chung
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'roomMemories'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('roomMemories'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-camera mr-3"></i> Kỷ niệm phòng
                </button>
                <button
                    className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'formerResidents'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => { setActiveSection('formerResidents'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-user-graduate mr-3"></i> Thông tin tiền bối
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'memberProfileEdit'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('memberProfileEdit'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-user-edit mr-3"></i> Chỉnh sửa thông tin cá nhân
                </button>
                <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-gray-700"
                  >
                    <i className="fas fa-sign-out-alt mr-3"></i> Đăng xuất
                  </button>
                </div>
              </>
            )}
          </nav>
          {/* Copyright Information */}
          <div className="mt-auto pt-4 text-center text-gray-500 dark:text-gray-400 text-xs">
            © Bản quyền thuộc về Nguyễn Huỳnh Phúc Khang 2025
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 lg:ml-64 transition-all duration-300 ease-in-out overflow-y-auto">
          {/* Authentication Section - Luôn hiển thị ở đầu nội dung chính */}
          <div className="mb-8 p-6 bg-blue-50 dark:bg-gray-700 rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-5">Xác thực người dùng</h2>
            {!isAuthReady ? (
              <p className="text-blue-600 dark:text-blue-300 text-center text-lg">Đang kết nối Firebase...</p>
            ) : (
              <>
                {userId ? (
                  <div className="text-center">
                    <p className="text-lg text-blue-800 dark:text-blue-200 font-medium mb-3">
                      Bạn đã đăng nhập với ID: <span className="font-mono break-all text-blue-600 dark:text-blue-300">{userId}</span>
                    </p>
                    {userRole && (
                      <p className="text-md text-blue-700 dark:text-blue-400">
                        Vai trò: <span className="font-semibold">{userRole === 'admin' ? 'Trưởng phòng/phó phòng' : 'Thành viên'}</span>
                      </p>
                    )}
                    {loggedInResidentProfile && (
                      <p className="text-md text-blue-700 dark:text-blue-400">
                        Hồ sơ thành viên: <span className="font-semibold">{loggedInResidentProfile.name}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col space-y-4">
                    <input
                      type="text" // Input for Full Name
                      placeholder="Họ tên đầy đủ"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                    <input
                      type="password"
                      placeholder="Mật khẩu"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-xl py-2 px-4 text-gray-700 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700"
                    />
                    {authError && (
                      <p className="text-red-500 text-sm text-center">{authError}</p>
                    )}
                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={handleSignIn}
                        className="flex-1 px-6 py-2 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                        disabled={!isAuthReady}
                      >
                        <i className="fas fa-sign-in-alt mr-2"></i> Đăng nhập
                      </button>
                      <button
                        onClick={handleSignUp}
                        className="flex-1 px-6 py-2 bg-green-600 text-white font-semibold rounded-xl shadow-md hover:bg-green-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
                        disabled={!isAuthReady}
                      >
                        <i className="fas fa-user-plus mr-2"></i> Đăng ký
                      </button>
                    </div>
                    <button
                      onClick={() => { setShowForgotPasswordModal(true); setAuthError(''); setForgotPasswordMessage(''); }}
                      className="w-full mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm font-semibold"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {userId ? (
            renderSection()
          ) : (
            <div className="text-center p-8 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner">
              <p className="text-xl text-gray-700 dark:text-gray-300 font-semibold mb-4">Vui lòng đăng nhập để sử dụng ứng dụng.</p>
            </div>
          )}
        </main>
      </div>


      {/* Modals - Giữ chúng ở phạm vi toàn cục để chồng lên nhau */}
      {selectedBillDetails && (userRole === 'admin') && ( // Chỉ hiển thị chi tiết hóa đơn cho admin
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">Chi tiết hóa đơn</h3>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <p><strong>Tháng:</strong> {selectedBillDetails.billingMonth || 'N/A'}</p>
              <p><strong>Ngày tính:</strong> {selectedBillDetails.billDate && selectedBillDetails.billDate instanceof Date ? selectedBillDetails.billDate.toLocaleDateString('vi-VN') : 'N/A'}</p>
              <p><strong>Người ghi nhận:</strong> {selectedBillDetails.recordedBy}</p>
              <p><strong>Điện (Đầu):</strong> {selectedBillDetails.electricityStartReading} KW</p>
              <p><strong>Điện (Cuối):</strong> {selectedBillDetails.electricityEndReading} KW</p>
              <p><strong>Tiêu thụ điện:</strong> {selectedBillDetails.electricityConsumption} KW</p>
              <p><strong>Tiền điện:</strong> {selectedBillDetails.electricityCost?.toLocaleString('vi-VN')} VND</p>
              <p><strong>Nước (Đầu):</strong> {selectedBillDetails.waterStartReading} m³</p>
              <p><strong>Nước (Cuối):</strong> {selectedBillDetails.waterEndReading} m³</p>
              <p><strong>Tiêu thụ nước:</strong> {selectedBillDetails.waterConsumption} m³</p>
              <p><strong>Tiền nước:</strong> {selectedBillDetails.waterCost?.toLocaleString('vi-VN')} VND</p>
              <p className="text-xl font-bold border-t pt-3 mt-3 border-gray-300 dark:border-gray-600">
                Tổng cộng: {selectedBillDetails.totalCost?.toLocaleString('vi-VN')} VND
              </p>
              <p className="text-lg font-bold">
                Trạng thái: <span className={selectedBillDetails.isPaid ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
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

      {selectedCostSharingDetails && (userRole === 'admin') && ( // Chỉ hiển thị chi tiết chia sẻ chi phí cho admin
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">Chi tiết chia tiền</h3>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <p><strong>Kỳ tính:</strong> {selectedCostSharingDetails.periodStart} đến {selectedCostSharingDetails.periodEnd}</p>
              <p><strong>Ngày tính:</strong> {selectedCostSharingDetails.calculatedDate && selectedCostSharingDetails.calculatedDate instanceof Date ? selectedCostSharingDetails.calculatedDate.toLocaleDateString('vi-VN') : 'N/A'}</p>
              <p><strong>Tổng ngày có mặt:</strong> {selectedCostSharingDetails.totalCalculatedDaysAllResidents} ngày</p>
              <p><strong>Chi phí TB 1 ngày/người:</strong> {selectedCostSharingDetails.costPerDayPerPerson?.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} VND</p>
              <p className="text-xl font-bold border-t pt-3 mt-3 border-gray-300 dark:border-gray-600">
                Số tiền mỗi người cần đóng:
              </p>
              <ul className="space-y-2 pl-4">
                {Object.entries(selectedCostSharingDetails.individualCosts || {}).map(([residentId, data]) => {
                  const residentName = residents.find(res => res.id === residentId)?.name || residentId;
                  return (
                    <li key={residentId} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded-lg">
                      <span>{residentName}:</span>
                      <span className="font-bold mr-2">{typeof data.cost === 'number' ? data.cost?.toLocaleString('vi-VN') : 'N/A'} VND</span>
                      <input
                        type="checkbox"
                        checked={data.isPaid || false}
                        onChange={() => handleToggleIndividualPaymentStatus(selectedCostSharingDetails.id, residentId, data.isPaid || false)}
                        className="form-checkbox h-5 w-5 text-green-600 dark:text-green-400 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
                      />
                      <span className={`ml-2 text-sm font-semibold ${data.isPaid ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {data.isPaid ? 'Đã đóng' : 'Chưa đóng'}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-lg font-bold border-t pt-3 mt-3 border-gray-300 dark:border-gray-600">
                Quỹ phòng còn lại: <span className={`font-bold ${selectedCostSharingDetails.remainingFund >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {selectedCostSharingDetails.remainingFund?.toLocaleString('vi-VN')} VND
                </span>
              </p>
            </div>
            <button
              onClick={() => setSelectedCostSharingDetails(null)}
              className="mt-6 w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {showGenerateScheduleModal && (userRole === 'admin') && ( // Chỉ hiển thị modal lịch trình cho admin
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">Tạo lịch trực phòng tự động</h3>
            <div className="space-y-4">
              <label htmlFor="numDaysForSchedule" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
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
                disabled={residents.filter(res => res.isActive !== false).length === 0} // Vô hiệu hóa nếu không có cư dân hoạt động
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
                  <h4 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3">Lịch đã tạo (Xem trước):</h4>
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
                onClick={() => { setShowGenerateScheduleModal(false); setGeneratedCleaningTasks([]); setAuthError(''); }}
                className="w-full mt-4 px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-300"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotificationsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">Thông báo</h3>
            {notificationError && <p className="text-red-500 text-sm text-center mb-4">{notificationError}</p>}
            {notifications.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa có thông báo nào.</p>
            ) : (
              <ul className="space-y-4">
                {notifications.map(notification => (
                  <li
                    key={notification.id}
                    className={`p-4 rounded-xl shadow-sm border ${notification.isRead ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600' : 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700'} flex justify-between items-start cursor-pointer transition-all duration-200`}
                    onClick={() => !notification.isRead && markNotificationAsRead(notification.id)} // Đánh dấu đã đọc khi nhấp vào
                  >
                    <div className="flex-1">
                      <p className={`font-semibold ${notification.isRead ? 'text-gray-800 dark:text-gray-300' : 'text-blue-800 dark:text-blue-200'}`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <i className="fas fa-clock mr-1"></i>
                        {notification.createdAt instanceof Date ? notification.createdAt.toLocaleString('vi-VN') : 'Đang tải...'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Loại: {notification.type}
                      </p>
                    </div>
                    {userRole === 'admin' && ( // Chỉ admin mới có nút xóa
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }} // Ngăn chặn sự kiện nổi bọt
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

      {/* Modal Chi tiết Thông báo */}
      {selectedNotificationDetails && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">Chi tiết thông báo</h3>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <p><strong>Tiêu đề:</strong> {selectedNotificationDetails.title || 'Không có tiêu đề'}</p> {/* Có thể có title nếu bạn thêm vào hàm createNotification */}
              <p><strong>Nội dung:</strong> {selectedNotificationDetails.message}</p>
              <p><strong>Loại:</strong> {selectedNotificationDetails.type}</p>
              <p><strong>Người gửi:</strong> {selectedNotificationDetails.createdBy || 'Hệ thống'}</p> {/* Bạn có thể cần tìm tên người gửi nếu cần */}
              <p><strong>Người nhận:</strong> {selectedNotificationDetails.recipientId === 'all' ? 'Tất cả' : (allUsersData.find(u => u.id === selectedNotificationDetails.recipientId)?.fullName || selectedNotificationDetails.recipientId)}</p>
              <p><strong>Thời gian:</strong> {selectedNotificationDetails.createdAt instanceof Date ? selectedNotificationDetails.createdAt.toLocaleString('vi-VN') : 'N/A'}</p>
              <p><strong>Trạng thái:</strong>
                <span className={`ml-2 px-2 py-1 rounded-full text-sm ${selectedNotificationDetails.isRead ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
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

      {/*  Modal hiển thị ảnh phóng to (Lightbox) */}
      {selectedImageToZoom && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImageToZoom(null)} // Đóng modal khi nhấp ra ngoài ảnh
        >
          <div className="relative max-w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}> {/* Ngăn chặn sự kiện nổi bọt trên ảnh */}
            <img
              src={selectedImageToZoom}
              alt="Phóng to kỷ niệm"
              className="max-w-full max-h-[90vh] object-contain shadow-lg rounded-lg"
            />
            <button
              onClick={() => setSelectedImageToZoom(null)}
              className="absolute top-4 right-4 text-white text-3xl bg-gray-800 bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition-colors"
            >
              &times; {/* Dấu X để đóng */}
            </button>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
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
              <p className={`text-sm text-center mb-4 ${forgotPasswordMessage.includes('Lỗi') ? 'text-red-500' : 'text-green-600'}`}>
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
              onClick={() => { setShowForgotPasswordModal(false); setForgotPasswordMessage(''); setForgotPasswordEmail(''); }}
              className="w-full px-6 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-300"
            >
              Hủy
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
