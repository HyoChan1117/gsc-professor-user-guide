import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import TraitsPage from './pages/TraitsPage.jsx';
import ScenesPage from './pages/ScenesPage.jsx';
import WarningsPage from './pages/WarningsPage.jsx';
import TalkPage from './pages/TalkPage.jsx';
import Dialect from './pages/Dialect.jsx';
import SurveyPage from './pages/SurveyPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import QuizPage from './pages/QuizPage.jsx';

// 페이지 이동 시 #앵커가 있으면 그 위치로, 없으면 맨 위로 스크롤
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { el.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

/* 메뉴 1개 = 페이지 1개 (SiteHeader의 MENU와 같은 순서) */
export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/traits" element={<TraitsPage />} />
        <Route path="/scenes" element={<ScenesPage />} />
        <Route path="/warnings" element={<WarningsPage />} />
        <Route path="/talk" element={<TalkPage />} />
        <Route path="/dialect" element={<Dialect />} />
        <Route path="/survey" element={<SurveyPage />} />
        <Route path="/survey/:kind" element={<SurveyPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}
