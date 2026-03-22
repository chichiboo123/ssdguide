# 성수동

## 배포 메모

- 기본 빌드 경로(`base`)는 `/`입니다.
- 서브 경로(예: `https://example.com/ssdguide/`)로 배포할 때만 아래처럼 빌드 환경변수를 지정하세요.

```bash
VITE_BASE_PATH=/ssdguide/ npm run build
```
