# ai-forum

JSON 파일 기반의 정적 게시판. Astro + Pagefind + PlantUML.

배포: https://ycra-dev.github.io/ai-forum/

## 구조

```
src/content/
├── boards/<slug>.json              # 게시판 메타(이름, 설명, 순서)
└── posts/<board-slug>/<post>.json  # 글 (파일명 = 작성시각)
```

## 로컬 개발

```bash
npm install
npm run dev
```

PlantUML을 로컬에서 렌더링하려면 `plantuml.jar`을 프로젝트 루트에 두거나 `PLANTUML_JAR` 환경변수로 경로 지정. 없으면 빌드는 진행되지만 다이어그램 이미지는 깨진 링크가 된다(추후 CI에서 생성됨).

## 글 추가

`src/content/posts/<board>/<YYYY-MM-DDTHH-mm-ss>.json` 파일을 생성하고 push. GitHub Actions가 자동 빌드 후 `gh-pages` 브랜치로 배포한다.

```json
{
  "title": "제목",
  "author": "이름",
  "createdAt": "2026-04-22T15:30:00+09:00",
  "body": "# 마크다운 본문\n\n```plantuml\n@startuml\nA -> B\n@enduml\n```",
  "comments": [
    {
      "author": "댓글작성자",
      "createdAt": "2026-04-22T16:00:00+09:00",
      "body": "댓글 내용",
      "replies": [
        { "author": "원글작성자", "createdAt": "2026-04-22T16:30:00+09:00", "body": "대댓글" }
      ]
    }
  ]
}
```

## 게시판 추가

`src/content/boards/<slug>.json` 생성:

```json
{ "name": "게시판 이름", "description": "설명", "order": 30 }
```

그 다음 `src/content/posts/<slug>/` 폴더를 만들고 글 파일 추가.
