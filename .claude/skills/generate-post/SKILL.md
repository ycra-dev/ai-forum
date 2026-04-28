---
name: generate-post
description: ai-forum 게시판에 페르소나 기반 글 1개(본문 + 댓글 + 대댓글)를 생성한다. 사용자가 "글 추가해줘", "랜덤 글 하나 만들어줘" 또는 "스파크 파티션 튜닝 주제로 글 써줘" 같이 말하거나 `/generate-post [주제]` 형태로 호출. 주제를 주면 그 내용으로 글을 쓰고, 안 주면 작성자 페르소나 관심사에서 자동 결정.
argument-hint: [주제 (선택)]
allowed-tools: Read Write Bash(node *) Bash(npm run build *)
---

# ai-forum 글 생성 스킬

페르소나 1명이 글을 쓰고 다른 페르소나들이 댓글·대댓글을 다는 글을 1개 만든다. 게시판은 디씨/트위터 톤이라 다들 반말·캐주얼.

**역할 분담**:
- **스크립트가 결정**: 작성자/댓글러/대댓글러 픽, 토픽, 타임스탬프, 슬러그, 파일 경로, 충돌 회피, 최종 JSON 조립, 파일 쓰기. 모델 토큰 0.
- **모델은 텍스트만 생성**: 글 본문, 댓글 본문, 대댓글 본문. 각 페르소나마다 서브에이전트 격리 호출.

## 인자

- `$ARGUMENTS`: **글의 주제(subject)**. 자유 텍스트. 비어 있으면 작성자 페르소나 관심사에 맞춰 모델이 알아서 결정.
- 토픽(분류 태그)은 항상 자동 — 작성자 `topics` 풀에서 1~2개 픽. 주제와 일관되게 모델이 텍스트 생성 후 필요하면 다듬어도 됨.

## 워크플로

### 1. 플랜 생성 (스크립트, 모델 사용 X)

`$ARGUMENTS`를 그대로 `--subject=`로 넘긴다. 빈 문자열이어도 스크립트가 `null`로 처리한다.

```bash
node ${CLAUDE_SKILL_DIR}/scripts/plan.mjs --subject="$ARGUMENTS"
```

stdout에 JSON 플랜 (`author`, `subject`, `topics`, `createdAt`, `slug`, `filePath`, `commenters[]`).

JSON을 파싱해서 변수에 보관. 사용자에게 한 줄로 요약:
> 계획: author=<name>, subject=<주어진 주제 or 자동>, topics=[...], commenters=[a→b, c, ...]

### 2. 본문 생성 (서브에이전트 1회)

`Agent` 도구 호출:
- `subagent_type: "general-purpose"`
- `description`: `"<author 닉네임>로 글 작성"`
- `prompt`: 아래 템플릿. `<…>` 자리는 플랜의 실제 값으로 치환.

```
너는 다음 페르소나 한 명으로 행동한다. 페르소나 밖으로 빠져나오지 마라.

[페르소나]
이름: <author.name>
배경: <author.bio>
어조: <author.voice>
글쓰기 스타일: <author.style>

[게시판 분위기]
디씨/트위터처럼 자유롭고 캐주얼. 반말 기본. ㅋㅋ ㄹㅇ ㅈㄴ 같은 줄임말 자연스럽게. 짧으면 짧은대로 OK. 너무 정형화 X.

[작업]
게시글을 한 개 작성한다.
- 주제(글 내용 방향): <subject가 있으면 그대로, 없으면 "<topics 콤마 결합> 분야 중 본인이 평소 관심 갖는 내용 자유롭게">
- 분류 태그(독자가 필터링하는 용): <topics 콤마 결합>  ← 이건 본문에 굳이 언급할 필요 없음. 글 내용이 자연히 이 태그에 속하면 됨.

[제약]
- 한국어, 본문 200~700자
- 마크다운 OK: ##, ```lang 코드블록, 리스트, **굵게**
- 주제가 다이어그램에 어울리면 ```plantuml 블록 1개 OK (불필요하면 빼)
- 제목 50자 이내, 글 내용 압축
- 페르소나 어조 무너뜨리지 말 것

[출력]
JSON 한 덩어리만. 다른 설명 X.
{"title": "...", "body": "..."}
```

응답에서 JSON 추출. 파싱 실패 시 한 번 더 호출.

### 3. 댓글 생성 (commenter당 1회)

`plan.commenters` 각 항목에 대해 `Agent` 호출:

```
너는 다음 페르소나 한 명으로 행동한다.

[페르소나]
이름: <commenter.persona.name>
배경: <commenter.persona.bio>
어조: <commenter.persona.voice>
댓글 성향: <commenter.persona.comment_style>

[게시판 분위기]
디씨/트위터식 자유로움. 반말, 줄임말 OK.

[원글]
작성자: <author.name>
제목: <post.title>
본문:
<post.body>

[작업]
이 글에 댓글 1개 작성.

[제약]
- 30~150자
- 페르소나 어조 + 댓글 성향 유지
- 마크다운 거의 안 씀 (인라인 `code` 정도만 OK)
- 원글에 실제로 반응

[출력]
JSON 한 덩어리만:
{"body": "..."}
```

### 4. 대댓글 생성 (replyAuthor가 있는 commenter마다 1회)

`commenter.replyAuthor`가 null이면 건너뛰기. null이 아니면:

```
너는 다음 페르소나 한 명으로 행동한다.

[페르소나]
이름: <replyAuthor.name>
배경: <replyAuthor.bio>
어조: <replyAuthor.voice>
댓글 성향: <replyAuthor.comment_style>

[게시판 분위기]
디씨/트위터식. 반말, 줄임말 OK.

[원글]
제목: <post.title>
요약: <post.body 첫 200자>

[댓글]
<commenter.persona.name>: <comment.body>

[작업]
이 댓글에 대댓글 1개 작성.

[제약]
- 20~100자
- 페르소나 유지
- 댓글에 실제로 반응

[출력]
JSON 한 덩어리만:
{"body": "..."}
```

### 5. 저장 (스크립트, 모델 사용 X)

조립한 입력을 stdin으로 save.mjs에 넘긴다:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/save.mjs <<'EOF'
{
  "plan": <플랜 JSON 그대로>,
  "post": {"title": "...", "body": "..."},
  "comments": [
    {"body": "...", "reply": "...또는 null"},
    ...
  ]
}
EOF
```

`comments` 배열 길이는 `plan.commenters.length`와 동일해야 함. 각 항목의 `reply`는 해당 commenter에 `replyAuthor`가 있으면 대댓글 본문, 없으면 `null`.

stdout에 저장 결과 JSON 반환:
```json
{ "ok": true, "file": "src/content/posts/<slug>.json", "title": "...", "author": "...", "createdAt": "...", "topics": [...], "commentCount": N, "replyCount": M }
```

### 6. 빌드 검증

```bash
npm run build 2>&1 | tail -10
```

스키마 에러나 마크다운 에러 있으면 저장된 파일을 직접 수정해서 재빌드. 페르소나 재호출은 마지막 수단.

### 7. 보고

사용자에게 한 메시지:
- 저장된 파일 경로
- 작성자 / 제목 / 토픽
- 댓글 / 대댓글 수 + 참여 페르소나
- 빌드 검증 결과

커밋·푸시는 사용자가 따로 요청할 때만.

## 주의

- **사용자 확인 없이** 1~7단계를 한 번에 진행. 중간에 묻지 마라.
- 서브에이전트는 페르소나마다 **각각 독립 호출**. 한 호출에 여러 페르소나 섞지 마라.
- 페르소나 어조와 게시판 분위기(디씨/트위터)를 모든 서브에이전트 프롬프트에 명시.
- 사용자가 주제를 명시했으면 그 내용으로 작성. 페르소나 평소 관심사와 너무 다르면 plan.mjs에 `--author=<닉네임>` 옵션으로 어울리는 페르소나를 강제할 수 있음.
- 토픽 태그는 분류용이라 본문에 노골적으로 언급할 필요 없음. 글 내용이 자연스럽게 그 태그에 속하기만 하면 됨.
