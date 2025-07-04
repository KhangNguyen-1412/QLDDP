import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app'; // Import getApps và getApp
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, query, addDoc, serverTimestamp, deleteDoc, getDocs, where, getDoc, updateDoc } from 'firebase/firestore';

// Firebase Config - Moved outside the component to be a constant
const firebaseConfig = {
  apiKey: "AIzaSyBUSFIJ9WPHnknLHlHY9bg15NZkMdgC7yA",
  authDomain: "qldd-c9d90.firebaseapp.com",
  projectId: "qldd-c9d90",
  storageBucket: "qldd-c9d90.firebasestorage.app",
  messagingSenderId: "847915576150",
  appId: "1:847915576150:web:96a0be2e39886133a544f7",
  measurementId: "G-7T6D9Y2EJH"
};

// currentAppId should consistently be the projectId - Moved outside the component
const currentAppId = firebaseConfig.projectId;

function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null); // Trạng thái mới cho vai trò người dùng
  const [loggedInResidentProfile, setLoggedInResidentProfile] = useState(null); // Hồ sơ cư dân được liên kết với người dùng đã đăng nhập
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
  const [fullName, setFullName] = useState(''); // New state for full name
  const [authError, setAuthError] = useState('');
  const [billingError, setBillingError] = useState('');

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
  const [numDaysForSchedule, setNumDaysForSchedule] = useState(7); // New: Input for number of days for schedule

  // State for Shoe Rack Management
  const [shoeRackAssignments, setShoeRackAssignments] = useState({});
  const [selectedShelfNumber, setSelectedShelfNumber] = useState('');
  const [selectedResidentForShelf, setSelectedResidentForShelf] = useState('');

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  // State for sidebar navigation
  const [activeSection, setActiveSection] = useState('residentManagement'); // Default active section
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // State for mobile sidebar

  const hasInitialized = useRef(false);

  // Effect để áp dụng lớp chủ đề cho phần tử HTML và lưu vào bộ nhớ cục bộ
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Hàm trợ giúp để định dạng ngày thành,"%Y-%m-%d"
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
          } else {
            // Nếu tài liệu người dùng không tồn tại, tạo nó với vai trò mặc định
            await setDoc(userDocRef, { email: user.email, fullName: user.email, role: 'member', createdAt: serverTimestamp() }, { merge: true });
          }
          setUserRole(fetchedRole);
          console.log("8. Vai trò người dùng:", fetchedRole);

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
          console.log("7. Không có người dùng nào được xác thực.");
          console.log("DEBUG AUTH: Người dùng đã đăng xuất.");
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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("Đăng ký thành công!");

      // Sau khi đăng ký thành công, tạo tài liệu người dùng trong Firestore
      await setDoc(doc(db, `artifacts/${currentAppId}/public/data/users`, userCredential.user.uid), {
        email: userCredential.user.email,
        fullName: fullName.trim(), // Save full name
        role: 'member', // Vai trò mặc định cho người đăng ký mới
        createdAt: serverTimestamp()
      });

      // Cố gắng liên kết với một cư dân hiện có theo tên
      const residentsCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/residents`);
      const qResidentByName = query(residentsCollectionRef, where("name", "==", fullName.trim()));
      const residentSnapByName = await getDocs(qResidentByName);

      if (!residentSnapByName.empty) {
        const matchedResident = residentSnapByName.docs[0];
        // Chỉ cập nhật linkedUserId trong tài liệu người dùng nếu cư dân chưa được liên kết với người dùng khác
        // hoặc đã được liên kết với chính người dùng này (trường hợp đăng ký lại với cùng tên)
        if (!matchedResident.data().linkedUserId || matchedResident.data().linkedUserId === userCredential.user.uid) {
          // Cập nhật tài liệu người dùng để lưu linkedResidentId
          await updateDoc(doc(db, `artifacts/${currentAppId}/public/data/users`, userCredential.user.uid), { linkedResidentId: matchedResident.id });
          console.log(`Đã liên kết cư dân "${fullName.trim()}" với người dùng mới đăng ký.`);
        } else {
          console.log(`Cư dân "${fullName.trim()}" đã được liên kết với một người dùng khác.`);
        }
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
      setActiveSection('residentManagement'); // Đặt lại phần hoạt động
    } catch (error) {
      console.error("Lỗi đăng xuất:", error.code, error.message);
      setAuthError(`Lỗi đăng xuất: ${error.message}`);
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
      snapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });
      // Sắp xếp phía client theo billDate giảm dần
      history.sort((a, b) => (b.billDate?.toDate() || 0) - (a.billDate?.toDate() || 0));
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
        history.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sắp xếp phía client theo calculatedDate giảm dần
      history.sort((a, b) => (b.calculatedDate?.toDate() || 0) - (a.calculatedDate?.toDate() || 0));
      setCostSharingHistory(history);
      console.log("Đã cập nhật lịch sử chia tiền:", history);
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
        tasks.push({ id: docSnap.id, ...docSnap.data() });
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
      const billDate = bill.billDate?.toDate();
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
      console.error("Hệ thống chưa sẵn sàng. DB hoặc User ID không khả dụng.");
      setAuthError("Vui lòng đăng nhập để thực hiện thao tác này.");
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
      console.error("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      setAuthError("Bạn không có quyền thực hiện thao tác này.");
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
    const waterConsumption = currentWaterReading - lastWaterReading;

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
  const calculateAttendanceDays = async () => {
    setAuthError('');
    setBillingError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể tính toán điểm danh và chi phí
      console.error("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      setAuthError("Bạn không có quyền thực hiện thao tác này.");
      return;
    }
    if (!startDate || !endDate) {
      console.error("Vui lòng chọn ngày bắt đầu và ngày kết thúc để tính toán điểm danh.");
      setBillingError("Vui lòng chọn ngày bắt đầu và ngày kết thúc để tính toán điểm danh.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      console.error("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
      setBillingError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
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
      let costPerDayLocal = 0;

      // Tính toán chi phí cá nhân dựa trên totalCost và totalDaysAcrossAllResidents
      if (totalDaysAcrossAllResidentsLocal > 0 && totalCost > 0) {
        costPerDayLocal = totalCost / totalDaysAcrossAllResidentsLocal;
        setCostPerDayPerPerson(costPerDayLocal);
        residents.forEach(resident => {
          const days = daysPresentPerResident[resident.id] || 0; // Lấy số ngày có mặt
          const rawCost = days * costPerDayLocal;
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
      const fundLocal = totalCost - totalRoundedIndividualCosts;
      setRemainingFund(fundLocal);

      // Lưu tóm tắt chia sẻ chi phí vào lịch sử bằng cách sử dụng các biến cục bộ
      const costSharingHistoryCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/costSharingHistory`);
      await addDoc(costSharingHistoryCollectionRef, {
        periodStart: startDate,
        periodEnd: endDate,
        totalCalculatedDaysAllResidents: totalDaysAcrossAllResidentsLocal,
        costPerDayPerPerson: costPerDayLocal,
        individualCosts: individualCalculatedCostsLocal, // Lưu dưới dạng map các đối tượng {cost, isPaid, daysPresent}
        remainingFund: fundLocal,
        calculatedBy: userId,
        calculatedDate: serverTimestamp(),
        relatedTotalBill: totalCost
      });


      console.log("Đã tính toán số ngày có mặt và chi phí trung bình.");
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
      console.error("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      setGeneratedReminder("Bạn không có quyền để tạo nhắc nhở.");
      return;
    }
    if (!selectedResidentForReminder) {
      console.error("Vui lòng chọn một người để tạo nhắc nhở.");
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
Số tiền ${residentName} cần đóng là ${formattedTotalCost} VND cho kỳ từ ${period}.
Hãy nhắc nhở họ về số tiền cần thanh toán và thời hạn nếu có (có thể mặc định là cuối tháng).
Tin nhắn nên ngắn gọn, thân thiện và rõ ràng.`;

    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };
    // API key cho Gemini được cung cấp bởi Canvas runtime khi triển khai.
    // Để kiểm tra cục bộ, bạn có thể cần đặt khóa thủ công tại đây hoặc thông qua biến môi trường.
    const apiKey = "AIzaSyB7gk6mBzOKxnXmzemFWGttFq3UpM0lgMg"; // Placeholder: Replace with your actual Gemini API key
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
      console.error("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      setAuthError("Bạn không có quyền thực hiện thao tác này.");
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
      console.error("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      setAuthError("Bạn không có quyền thực hiện thao tác này.");
      return;
    }
    if (newCleaningTaskName.trim() === '' || !newCleaningTaskDate || !selectedResidentForCleaning) {
      console.error("Vui lòng nhập đầy đủ thông tin công việc, ngày và người thực hiện.");
      setAuthError("Vui lòng nhập đầy đủ thông tin công việc, ngày và người thực hiện.");
      return;
    }

    const cleaningTasksCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/cleaningTasks`);
    const assignedResident = residents.find(res => res.name === selectedResidentForCleaning);

    try {
      await addDoc(cleaningTasksCollectionRef, {
        name: newCleaningTaskName.trim(),
        date: newCleaningTaskDate, // Chuỗi,"%Y-%m-%d"
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
      console.error("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      setAuthError("Bạn không có quyền thực hiện thao tác này.");
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
      console.error("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      setAuthError("Bạn không có quyền thực hiện thao tác này.");
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
      console.error("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      setAuthError("Bạn không có quyền thực hiện thao tác này.");
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
            updatedIndividualCosts[residentId] = { cost: updatedIndividualCosts[residentId], isPaid: !currentStatus };
          } else {
            updatedIndividualCosts[residentId].isPaid = !currentStatus;
          }
        } else { // Nếu residentId không tìm thấy hoặc dữ liệu là null/undefined
          // Trường hợp này lý tưởng là không xảy ra nếu individualCosts được điền đúng cách
          // nhưng được thêm vào để tăng tính mạnh mẽ.
          updatedIndividualCosts[residentId] = { cost: 0, isPaid: !currentStatus };
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
      console.error("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      setAuthError("Bạn không có quyền thực hiện thao tác này.");
      return;
    }
    if (!selectedShelfNumber || !selectedResidentForShelf) {
      console.error("Vui lòng chọn tầng kệ và người để gán.");
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
  const handleClearShoeRackAssignment = async (shelfNumber) => { // eslint-disable-line no-unused-vars
    setAuthError('');
    if (!db || !userId || userRole !== 'admin') { // Chỉ admin mới có thể xóa kệ giày
      console.error("Hệ thống chưa sẵn sàng hoặc bạn không có quyền.");
      setAuthError("Bạn không có quyền thực hiện thao tác này.");
      return;
    }
    const shoeRackDocRef = doc(db, `artifacts/${currentAppId}/public/data/shoeRackAssignments`, String(shelfNumber));
    try {
      await deleteDoc(shoeRackDocRef);
      console.log(`Đã xóa việc gán tầng kệ ${shelfNumber}.`);
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
    - Quét phòng và lau phòng
    - Đổ rác
    - Vệ sinh nhà vệ sinh
    - Vệ sinh khu vực đằng sau

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
    const apiKey = "AIzaSyB7gk6mBzOKxnXmzemFWGttFq3UpM0lgMg"; // Placeholder: Replace with your actual Gemini API key
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
    updatedIndividualCosts[loggedInResidentProfile.id].isPaid = true; // Đánh dấu là đã đóng

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
  const displayedResidents = userRole === 'member' && loggedInResidentProfile
    ? residents.filter(res => res.id === loggedInResidentProfile.id)
    : (showInactiveResidents ? residents : residents.filter(res => res.isActive !== false));

  // Hàm renderSection để hiển thị các phần giao diện dựa trên vai trò người dùng
  const renderSection = () => {
    if (userRole === 'admin') {
      switch (activeSection) {
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
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-inner max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700">
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
                          {resident.createdAt && (
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
                            {resident.isActive === false && (
                              <span className="text-xs text-red-500 dark:text-red-400 ml-2">(Vô hiệu hóa)</span>
                            )}
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
                            {bill.billDate?.toDate().toLocaleDateString('vi-VN') || 'N/A'}
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
                      return (
                        <li key={shelfNum} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Tầng {shelfNum}:</span>
                          {assignment ? (
                            <span className="text-yellow-700 dark:text-yellow-300 font-bold">
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
        case 'consumptionStats':
          return (
            <div className="p-6 bg-purple-50 dark:bg-gray-700 rounded-2xl shadow-lg mt-8 max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-200 mb-5">Thống kê tiêu thụ hàng tháng</h2>
              {Object.keys(monthlyConsumptionStats).length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có dữ liệu thống kê.</p>
              ) : (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
                  <ul className="space-y-3">
                    {Object.entries(monthlyConsumptionStats).map(([month, stats]) => (
                      <li key={month} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                        <h4 className="font-bold text-lg text-purple-700 dark:text-purple-200 mb-2">Tháng {month}</h4>
                        <p className="text-gray-700 dark:text-gray-300">Điện tiêu thụ: <span className="font-semibold">{stats.electricity.toLocaleString('vi-VN')} KW</span></p>
                        <p className="text-700 dark:text-gray-300">Nước tiêu thụ: <span className="font-semibold">{stats.water.toLocaleString('vi-VN')} m³</span></p>
                        <p className="text-gray-700 dark:text-gray-300">Tổng chi phí: <span className="font-semibold">{stats.total.toLocaleString('vi-VN')} VND</span></p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        default:
          return (
            <div className="text-center p-8 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner">
              <p className="text-xl text-gray-700 dark:text-gray-300 font-semibold mb-4">
                Vui lòng chọn một mục từ thanh điều hướng.
              </p>
            </div>
          );
      }
    } else if (userRole === 'member') {
      // Member-specific sections
      switch (activeSection) {
        case 'attendanceTracking':
          return (
            <div className="p-6 bg-green-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-5">Điểm danh của bạn</h2>
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
                loggedInResidentProfile ? (
                  <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Không có dữ liệu điểm danh cho bạn trong tháng này.</p>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.</p>
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
        case 'memberCostSummary': // New section for member's cost summary
          const myLatestCost = loggedInResidentProfile && costSharingHistory.length > 0
            ? costSharingHistory.find(bill => bill.individualCosts && bill.individualCosts[loggedInResidentProfile.id])
            : null;

          // DEBUG LOGS
          console.log("DEBUG MemberCostSummary: loggedInResidentProfile:", loggedInResidentProfile);
          console.log("DEBUG MemberCostSummary: costSharingHistory:", costSharingHistory);
          console.log("DEBUG MemberCostSummary: myLatestCost:", myLatestCost);
          if (myLatestCost && loggedInResidentProfile) {
            console.log("DEBUG MemberCostSummary: myLatestCost.individualCosts for my ID:", myLatestCost.individualCosts[loggedInResidentProfile.id]);
            console.log("DEBUG MemberCostSummary: myLatestCost.individualCosts[loggedInResidentProfile.id]?.daysPresent:", myLatestCost.individualCosts[loggedInResidentProfile.id]?.daysPresent);
          }


          return (
            <div className="p-6 bg-orange-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-orange-800 dark:text-orange-200 mb-5">Chi phí của tôi</h2>
              {!loggedInResidentProfile ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.</p>
              ) : !myLatestCost ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có thông tin chi phí cho bạn.</p>
              ) : (
                <div className="bg-orange-100 dark:bg-gray-800 p-4 rounded-xl shadow-inner border border-orange-200 dark:border-gray-700">
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Kỳ tính: <span className="font-bold">{myLatestCost.periodStart} đến {myLatestCost.periodEnd}</span>
                  </p>
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Số ngày có mặt của bạn: <span className="font-bold">{myLatestCost.individualCosts[loggedInResidentProfile.id]?.daysPresent || 0} ngày</span>
                  </p>
                  <p className="text-xl font-bold border-t pt-3 mt-3 border-orange-300 dark:border-gray-600">
                    Số tiền bạn cần đóng: <span className="text-orange-800 dark:text-orange-200">
                      {(myLatestCost.individualCosts[loggedInResidentProfile.id]?.cost || 0).toLocaleString('vi-VN')} VND
                    </span>
                  </p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-lg font-bold">
                      Trạng thái: <span className={myLatestCost.individualCosts[loggedInResidentProfile.id]?.isPaid ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                        {myLatestCost.individualCosts[loggedInResidentProfile.id]?.isPaid ? 'Đã đóng' : 'Chưa đóng'}
                      </span>
                    </span>
                    {!myLatestCost.individualCosts[loggedInResidentProfile.id]?.isPaid && (
                      <button
                        onClick={handleMarkMyPaymentAsPaid}
                        className="px-4 py-2 bg-green-600 text-white font-semibold rounded-xl shadow-md hover:bg-green-700 transition-all duration-300"
                      >
                        <i className="fas fa-check-circle mr-2"></i> Đánh dấu đã đóng
                      </button>
                    )}
                  </div>
                  {authError && <p className="text-red-500 text-sm text-center mt-2">{authError}</p>}
                </div>
              )}
            </div>
          );
        case 'memberCleaningSchedule': // New section for member's cleaning schedule
          const myCleaningTasks = cleaningSchedule.filter(task =>
            loggedInResidentProfile && task.assignedToResidentId === loggedInResidentProfile.id
          );
          return (
            <div className="p-6 bg-purple-50 dark:bg-gray-700 rounded-2xl shadow-lg max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-purple-800 dark:text-purple-200 mb-5">Lịch trực của tôi</h2>
              {!loggedInResidentProfile ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn chưa được liên kết với hồ sơ người ở. Vui lòng liên hệ quản trị viên.</p>
              ) : myCleaningTasks.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Bạn không có công việc lau dọn nào được phân công.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-700">
                  <h3 className="text-xl font-semibold text-purple-700 dark:text-purple-200 mb-3">Lịch trực hiện có:</h3>
                  <ul className="space-y-2">
                    {myCleaningTasks.map((task) => (
                      <li key={task.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{task.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Ngày: {task.date}
                          </span>
                        </div>
                        <span className={`font-semibold ${task.isCompleted ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                          {task.isCompleted ? 'Đã hoàn thành' : 'Chưa hoàn thành'}
                        </span>
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
              <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-5">Thông tin kệ giày</h2>
              {Object.keys(shoeRackAssignments).length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 italic text-center py-4">Chưa có kệ giày nào được gán.</p>
              ) : (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-yellow-700 dark:text-yellow-200 mb-3">Phân công kệ giày hiện tại:</h3>
                  <ul className="space-y-3">
                    {[...Array(8)].map((_, i) => {
                      const shelfNum = i + 1;
                      const assignment = shoeRackAssignments[shelfNum];
                      return (
                        <li key={shelfNum} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Tầng {shelfNum}:</span>
                          {assignment ? (
                            <span className="text-yellow-700 dark:text-yellow-300 font-bold">
                              {assignment.residentName}
                              {/* Nút xóa không hiển thị cho thành viên */}
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
        default:
          return (
            <div className="text-center p-8 bg-gray-100 dark:bg-gray-700 rounded-xl shadow-inner">
              <p className="text-xl text-gray-700 dark:text-gray-300 font-semibold mb-4">
                Vui lòng chọn một mục từ thanh điều hướng.
              </p>
            </div>
          );
      }
    }
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
            } lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out z-20`}
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
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'residentManagement'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('residentManagement'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-users mr-3"></i> Quản lý người ở
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'attendanceTracking'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('attendanceTracking'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-calendar-alt mr-3"></i> Điểm danh hàng ngày
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'billing'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('billing'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-file-invoice-dollar mr-3"></i> Tính tiền điện nước
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'costSharing'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('costSharing'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-handshake mr-3"></i> Chia tiền & Nhắc nhở
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'billHistory'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('billHistory'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-history mr-3"></i> Lịch sử hóa đơn
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'costSharingHistory'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('costSharingHistory'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-receipt mr-3"></i> Lịch sử chia tiền
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'cleaningSchedule'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('cleaningSchedule'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-broom mr-3"></i> Lịch trực phòng
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'shoeRackManagement'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('shoeRackManagement'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-shoe-prints mr-3"></i> Quản lý kệ giày
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'consumptionStats'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('consumptionStats'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-chart-bar mr-3"></i> Thống kê tiêu thụ
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
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'memberCostSummary' // New nav item
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => { setActiveSection('memberCostSummary'); setIsSidebarOpen(false); }}
                >
                  <i className="fas fa-money-bill-wave mr-3"></i> Chi phí của tôi
                </button>
                <button
                  className={`w-full text-left py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${activeSection === 'memberCleaningSchedule' // New nav item
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
                        Vai trò: <span className="font-semibold">{userRole === 'admin' ? 'Trưởng phòng' : 'Thành viên'}</span>
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
              <p><strong>Ngày tính:</strong> {selectedBillDetails.billDate?.toDate().toLocaleDateString('vi-VN')}</p>
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
              <p><strong>Ngày tính:</strong> {selectedCostSharingDetails.calculatedDate?.toDate().toLocaleDateString('vi-VN')}</p>
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
                      <span className="font-bold mr-2">{data.cost?.toLocaleString('vi-VN')} VND</span>
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


      {/* Font Awesome for icons */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css" />
    </div>
  );
}

export default App;
