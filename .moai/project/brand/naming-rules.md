# 프로젝트 명명 규칙

> **규칙**: 모든 프로젝트 관련 자료에서 AI agent 관련 용어를 사용하지 않고 **"abyz-lab"**만 사용합니다.

---

## 금지 용어

다음 용어들은 모든 문서, git 이슈, wiki, commit 메시지에서 **사용 금지**:

- ❌ Claude
- ❌ MoAI
- ❌ Anthropic
- ❌ AI agent
- ❌ LLM agent
- ❌ AI assistant

## 허용 용어

- ✅ **abyz-lab** (모든 AI 기능 지칭)
- ✅ Regula (제품명)
- ✅ 개발팀 (우리 팀 지칭)

---

## 예시

### Git Commit Message

**나쁜 예**:
```
feat: MoAI로 SPEC 작성 자동화

Claude Code를 사용하여...
```

**좋은 예**:
```
feat: abyz-lab 도구로 SPEC 작성 자동화

abyz-lab 개발 도구를 사용하여...
```

### Wiki 문서

**나쁜 예**:
```
## MoAI 워크플로우

Claude가 다음을 수행합니다...
```

**좋은 예**:
```
## abyz-lab 워크플로우

abyz-lab 도구가 다음을 수행합니다...
```

---

## 적용 범위

이 규칙은 다음 모든 곳에 적용됩니다:

1. **문서**: README.md, Wiki, SPEC, ADR
2. **Git 이슈**: 제목, 본문, 댓글
3. **커밋 메시지**: 모든 git commit
4. **PR 설명**: Pull Request 본문
5. **코드 내 주석**: 사용자가 보는 모든 주석

---

**생성일**: 2026-04-29
**적용 시작**: 즉시
