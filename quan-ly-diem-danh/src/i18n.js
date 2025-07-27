import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

i18n
  .use(HttpApi) // Tải các file dịch từ server/public folder
  .use(LanguageDetector) // Tự động phát hiện ngôn ngữ của trình duyệt
  .use(initReactI18next) // Kết nối i18next với React
  .init({
    supportedLngs: ['vi', 'en'],
    fallbackLng: 'vi', // Ngôn ngữ mặc định nếu không phát hiện được
    detection: {
      order: ['cookie', 'localStorage', 'htmlTag', 'path', 'subdomain'],
      caches: ['cookie'],
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json', // Đường dẫn tới file dịch
    },
    react: { useSuspense: false },
  });

export default i18n;