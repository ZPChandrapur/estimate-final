import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  mr: {
    translation: {
      // Navigation
      'nav.dashboard': 'डॅशबोर्ड',
      'nav.works': 'कामे',
      'nav.subworks': 'उपकामे',
      'nav.compare': 'तुलना',
      'nav.measurementBook': 'मापन पुस्तक',
      'nav.signOut': 'साइन आउट',
      
      // Dashboard
      'dashboard.title': 'ई-अंदाजपत्रक डॅशबोर्ड',
      'dashboard.welcome': 'स्वागत',
      'dashboard.totalWorks': 'एकूण कामे',
      'dashboard.pendingApprovals': 'प्रलंबित मंजूरी',
      'dashboard.totalAmount': 'एकूण रक्कम',
      'dashboard.recentActivity': 'अलीकडील क्रियाकलाप',
      
      // Works
      'works.title': 'कामे व्यवस्थापन',
      'works.addNew': 'नवीन काम जोडा',
      'works.searchPlaceholder': 'कामे शोधा...',
      'works.status': 'स्थिती',
      'works.amount': 'रक्कम',
      'works.actions': 'क्रिया',
      
      // Subworks
      'subworks.title': 'उपकामे व्यवस्थापन',
      'subworks.selectWork': 'काम निवडा',
      'subworks.quantity': 'प्रमाण',
      'subworks.unitRate': 'एकक दर',
      'subworks.totalAmount': 'एकूण रक्कम',
      
      // Compare
      'compare.title': 'तुलना',
      'compare.selectWorks': 'तुलनेसाठी कामे निवडा',
      'compare.comparison': 'तुलना अहवाल',
      
      // Common
      'common.loading': 'लोड होत आहे...',
      'common.error': 'त्रुटी',
      'common.save': 'जतन करा',
      'common.cancel': 'रद्द करा',
      'common.edit': 'संपादित करा',
      'common.delete': 'हटवा',
      'common.view': 'पहा',
      'common.search': 'शोधा',
      'common.filter': 'फिल्टर',
      'common.export': 'निर्यात',
      'common.print': 'प्रिंट',
      'common.language': 'भाषा',
      'common.close': 'बंद करा',
      'common.required': 'आवश्यक',
      
      // Status
      'status.draft': 'मसुदा',
      'status.pending': 'प्रलंबित',
      'status.approved': 'मंजूर',
      'status.rejected': 'नाकारलेले',
      
      // Add Work Form
      'addWork.title': 'नवीन काम जोडा',
      'addWork.type': 'प्रकार',
      'addWork.workName': 'कामाचे नाव',
      'addWork.ssr': 'एसएसआर',
      'addWork.division': 'विभाग',
      'addWork.subDivision': 'उपविभाग',
      'addWork.fundHead': 'निधी शीर्ष',
      'addWork.majorHead': 'मुख्य शीर्ष',
      'addWork.minorHead': 'लघु शीर्ष',
      'addWork.serviceHead': 'सेवा शीर्ष',
      'addWork.departmentalHead': 'विभागीय प्रमुख',
      'addWork.sanctioningAuthority': 'मंजूरी प्राधिकरण',
      'addWork.technicalSanction': 'तांत्रिक मंजूरी (टीएस)',
      'addWork.administrativeApproval': 'प्रशासकीय मंजूरी (एए)',
      'addWork.enterWorkName': 'कामाचे नाव प्रविष्ट करा',
      'addWork.enterSSR': 'एसएसआर प्रविष्ट करा',
      'addWork.enterDivision': 'विभाग प्रविष्ट करा',
      'addWork.enterSubDivision': 'उपविभाग प्रविष्ट करा',
      'addWork.enterFundHead': 'निधी शीर्ष प्रविष्ट करा',
      'addWork.enterMajorHead': 'मुख्य शीर्ष प्रविष्ट करा',
      'addWork.enterMinorHead': 'लघु शीर्ष प्रविष्ट करा',
      'addWork.enterServiceHead': 'सेवा शीर्ष प्रविष्ट करा',
      'addWork.enterDepartmentalHead': 'विभागीय प्रमुख प्रविष्ट करा',
      'addWork.enterSanctioningAuthority': 'मंजूरी प्राधिकरण प्रविष्ट करा',
      'addWork.addWork': 'काम जोडा',
    }
  },
  en: {
    translation: {
      // Navigation
      'nav.dashboard': 'Dashboard',
      'nav.works': 'Works',
      'nav.subworks': 'Sub Works',
      'nav.compare': 'Compare',
      'nav.measurementBook': 'Measurement Book (MB)',
      'nav.signOut': 'Sign Out',
      
      // Dashboard
      'dashboard.title': 'E-Estimate Dashboard',
      'dashboard.welcome': 'Welcome',
      'dashboard.totalWorks': 'Total Works',
      'dashboard.pendingApprovals': 'Pending Approvals',
      'dashboard.totalAmount': 'Total Amount',
      'dashboard.recentActivity': 'Recent Activity',
      
      // Works
      'works.title': 'Works Management',
      'works.addNew': 'Add New Work',
      'works.searchPlaceholder': 'Search works...',
      'works.status': 'Status',
      'works.amount': 'Amount',
      'works.actions': 'Actions',
      
      // Subworks
      'subworks.title': 'Sub Works Management',
      'subworks.selectWork': 'Select Work',
      'subworks.quantity': 'Quantity',
      'subworks.unitRate': 'Unit Rate',
      'subworks.totalAmount': 'Total Amount',
      
      // Compare
      'compare.title': 'Compare',
      'compare.selectWorks': 'Select Works to Compare',
      'compare.comparison': 'Comparison Report',
      
      // Common
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.edit': 'Edit',
      'common.delete': 'Delete',
      'common.view': 'View',
      'common.search': 'Search',
      'common.filter': 'Filter',
      'common.export': 'Export',
      'common.print': 'Print',
      'common.language': 'Language',
      'common.close': 'Close',
      'common.required': 'Required',
      
      // Status
      'status.draft': 'Draft',
      'status.pending': 'Pending',
      'status.approved': 'Approved',
      'status.rejected': 'Rejected',
      
      // Add Work Form
      'addWork.title': 'Add New Work',
      'addWork.type': 'Type',
      'addWork.workName': 'Work Name',
      'addWork.ssr': 'SSR',
      'addWork.division': 'Division',
      'addWork.subDivision': 'Sub Division',
      'addWork.fundHead': 'Fund Head',
      'addWork.majorHead': 'Major Head',
      'addWork.minorHead': 'Minor Head',
      'addWork.serviceHead': 'Service Head',
      'addWork.departmentalHead': 'Departmental Head',
      'addWork.sanctioningAuthority': 'Sanctioning Authority',
      'addWork.technicalSanction': 'Technical Sanction (TS)',
      'addWork.administrativeApproval': 'Administrative Approval (AA)',
      'addWork.enterWorkName': 'Enter work name',
      'addWork.enterSSR': 'Enter SSR',
      'addWork.enterDivision': 'Enter division',
      'addWork.enterSubDivision': 'Enter sub division',
      'addWork.enterFundHead': 'Enter fund head',
      'addWork.enterMajorHead': 'Enter major head',
      'addWork.enterMinorHead': 'Enter minor head',
      'addWork.enterServiceHead': 'Enter service head',
      'addWork.enterDepartmentalHead': 'Enter departmental head',
      'addWork.enterSanctioningAuthority': 'Enter sanctioning authority',
      'addWork.addWork': 'Add Work',
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en', // Default to English
    lng: 'en', // Default language
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
    }
  });

export default i18n;