# T3610 추가 활용 백로그

> 서버 구축 안정화 후 필요시 순차 적용. 우선순위 순 정렬.

---

| 우선순위 | 항목 | 효과 | 비고 |
|---------|------|------|------|
| 1 | **PM2 클러스터 모드** | CPU 24스레드 풀 활용, 동시 처리 성능 향상 | 코드 변경 없음. `pm2 start -i max` |
| 2 | **Redis 추가** | Rate Limiter 영속화, 세션 캐시, 멀티 프로세스 상태 공유 | docker-compose에 redis:7-alpine 추가 |
| 3 | **로컬 임베딩 (Ollama)** | OpenAI 임베딩 의존 제거, 비용 $0 | nomic-embed-text (768차원). DB 전체 재임베딩 1회 필요 |
| 4 | **GitHub Actions 셀프 호스티드 러너** | CI 속도 향상, Actions 무료 한도 절약, 코드 외부 유출 최소화 | GitHub Settings → Runners에서 등록 |
| 5 | **Prometheus + Grafana** | CPU/메모리/응답시간 실시간 모니터링 | docker-compose 추가. 각 ~200MB RAM |

---

*기록일: 2026-05-06*
