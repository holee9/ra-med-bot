# Issue Workflow Checklist

> 작성일: 2026-05-24  
> 배경: commit `286b281` — 이슈 워크플로우 미준수로 인한 직접 기록

이슈 번호가 있는 모든 작업에 반드시 적용.

---

## 작업 전 (Before)

- [ ] 이슈 확인: `gh issue view {N}`
- [ ] 이슈 코멘트 작성: "작업 시작 — [날짜]"
- [ ] 브랜치 생성:
  ```bash
  git checkout -b fix/issue-{N}   # 버그픽스
  git checkout -b feat/issue-{N}  # 신규 기능
  ```

## 작업 중 (During)

- [ ] 커밋 메시지에 `Fixes #{N}` footer 포함:
  ```
  fix(scope): 변경 내용 요약

  Fixes #{N}
  ```
- [ ] 작업 단위별로 커밋 (한 번에 몰아서 X)

## 작업 후 (After)

- [ ] PR 생성:
  ```bash
  gh pr create --title "fix(scope): 제목" --body "$(cat <<'EOF'
  ## Summary
  - 변경 내용

  Fixes #{N}
  EOF
  )"
  ```
- [ ] 이슈 코멘트: "완료 — PR #{PR번호}, commit {hash}"

---

## 위반 이력

| 날짜 | 이슈 | 위반 내용 | 커밋 |
|------|------|-----------|------|
| 2026-05-24 | #82 | main 직접 커밋, Fixes#82 없음, PR 없음 | `286b281` |

---

## 참고 규칙 파일

- `.claude/skills/moai/workflows/github.md` — 전체 GitHub 워크플로우
- `.claude/skills/moai/workflows/run.md` — Phase 3 Git Operations
