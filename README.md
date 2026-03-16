# 성수동 (Seongsu-dong)

> 성취기준, 수업을 함께 디자인하는 동료

국가 교육과정 성취기준을 검색하고 수업을 설계할 수 있는 웹 애플리케이션입니다.

## 주요 기능

- **성취기준 검색** — 교육과정 / 학년군 / 과목 / 영역 계층 필터링, 키워드 검색 (디바운스)
- **수업 바구니** — 성취기준 추가·제거·순서 변경, 탭 간 실시간 동기화 (localStorage)
- **수업 디자인** — 7단계 수업 설계 폼 (주제 → 성취기준 → 의도 → 목표 → 과정 → 평가 → 자료)
- **내보내기** — JSON 저장/불러오기, TXT 다운로드, 마크다운 클립보드 복사

## 기술 스택

| 분류 | 기술 |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix UI) |
| 상태 관리 | TanStack Query v5 + localStorage |
| 라우팅 | wouter |
| 배포 | Docker + nginx |

## 로컬 개발

```bash
npm install
npm run dev
```

## 빌드 및 배포

```bash
# 정적 빌드
npm run build

# Docker로 실행 (포트 3000)
docker compose up -d --build
```

## 데이터

`public/data/` 폴더의 JSON 파일로 성취기준 데이터를 관리합니다.

| 파일 | 설명 |
|---|---|
| `achievements-simple.json` | 전체 성취기준 단순 배열 (검색 최적화) |
| `achievements-2022-개정.json` | 2022 개정 교육과정 |
| `achievements-2019-누리과정.json` | 2019 누리과정 |
| `SCHEMA.json` | 데이터 스키마 |
