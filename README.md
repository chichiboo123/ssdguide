# 성수동 — 성취기준 기반 수업 디자인 도구

국가 교육과정 성취기준을 검색하고, 바구니에 담아, 7단계 수업 디자인 양식으로 수업을 체계적으로 설계할 수 있는 웹 애플리케이션입니다.

## 주요 기능

### 성취기준 검색
- 교육과정 / 학년군 / 과목 / 영역 4단계 필터 지원
- 키워드 검색 (코드, 내용, 과목, 영역)
- 바구니에 담기 / 순서 변경 / 클립보드 복사

### 수업 디자인 (7단계)
1. **관련 성취기준** — 바구니에서 자동 불러오기
2. **수업자 의도** — 자유 서술
3. **수업 목표** — 직접 입력 또는 AI 생성
4. **수업 과정** — 자유 서술 또는 차시별 표 입력
5. **평가 계획** — 영역 / 요소 / 방법 구조화 입력
6. **교수·학습 자료** — 텍스트·이미지·링크 첨부
7. **판서 계획 / 메모** — 자유 서술

### AI 보조 기능 (Groq API)
- 수업 목표 · 수업 과정 · 평가 계획 자동 생성
- 5개 모델 우선순위 폴백 (429 속도 제한 자동 우회)
- 일괄 생성 또는 섹션별 재생성

### 내보내기
- JSON 저장 / 불러오기 (작업 이어서 하기)
- 마크다운(.md) 파일 다운로드
- URL 링크 공유 (Cloudinary 이미지 포함)

## 기술 스택

| 구분 | 기술 |
|---|---|
| 프론트엔드 | React 19, Vite, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| 라우팅 | Wouter (해시 라우팅) |
| 상태 관리 | TanStack Query, React useState |
| AI 백엔드 | Groq API (Netlify Functions) |
| 배포 | Netlify (Functions + SPA 호스팅) |

## 로컬 개발 환경

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local에 GROQ_API_KEY 입력

# 개발 서버 시작 (프론트엔드)
npm run dev

# Express API 서버 (AI 기능 사용 시)
npx tsx server/index.ts
```

## 배포 (Netlify)

`netlify.toml`이 빌드·배포·API 라우팅을 자동 설정합니다.

Netlify 대시보드 → **Site settings > Environment variables** 에서 아래 값을 설정하세요:

| 변수명 | 설명 |
|---|---|
| `GROQ_API_KEY` | Groq API 키 |

## 데이터 출처

2022 개정 교육과정 (교육부 고시 제2022-33호)

## 개발자

교육뮤지컬 꿈꾸는 치수쌤 · [litt.ly/chichiboo](https://litt.ly/chichiboo)
