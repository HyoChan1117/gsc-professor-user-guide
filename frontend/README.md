# Frontend (React + Vite)

GSC 교수님 사용 설명서 — `test.html` 디자인(홈 PC · 홈 모바일 · 말버릇·사투리 사전)을 React로 구현한 것입니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # dist/ 로 빌드
npm run preview  # 빌드 결과 확인
```

## 구조

```
src/
├── main.jsx            # 진입점 (BrowserRouter)
├── App.jsx             # 라우트: /  /dialect
├── data/siteData.js    # 화면에 나오는 모든 내용 (백엔드 생기면 API로 교체)
├── pages/              # Home, Dialect
├── components/         # 헤더, 푸터, 하단 탭바, 홈 섹션들(home/)
├── styles/style.css    # 반응형 스타일 (720px 이하 = 모바일 레이아웃)
└── assets/avatar.jpg   # 도트 일러스트
legacy/                 # 이전 정적 HTML 버전 (참고용)
```

## 참고

- 배포 시 `/dialect` 경로 새로고침이 되려면 서버에서 모든 경로를 `index.html`로 보내야 합니다 (SPA fallback).
- 검색창, 한마디 남기기, 분위기 투표, 별점은 아직 화면 안에서만 동작합니다 (백엔드 연결 전).
