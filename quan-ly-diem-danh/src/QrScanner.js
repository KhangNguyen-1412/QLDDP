import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const QrScanner = ({ onScanSuccess, onScanError }) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader", // ID của thẻ div bên dưới
      {
        fps: 10, // Số khung hình mỗi giây để quét
        qrbox: { width: 250, height: 250 }, // Kích thước của khung quét
        rememberLastUsedCamera: true, // Nhớ camera lần trước đã dùng
      },
      false // verbose, để false cho gọn
    );

    // Hàm render khi quét thành công
    scanner.render(onScanSuccess, onScanError);

    // Dọn dẹp scanner khi component bị gỡ bỏ
    return () => {
      scanner.clear().catch(error => {
        console.error("Failed to clear html5-qrcode-scanner.", error);
      });
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div>
      <div id="qr-reader" style={{ width: '100%' }}></div>
    </div>
  );
};

export default QrScanner;