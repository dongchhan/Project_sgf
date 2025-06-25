# 🔐 Git 시크릿 키 & 민감정보 노출 제거 대응 루틴

Git 커밋 히스토리에 API 키, 토큰, 비밀번호, 시크릿 키 등이 노출되었을 때의 처리 절차입니다.  
다음 순서를 통해 민감 정보가 Git 로그와 저장소에서 완전히 삭제되었는지 확인하고 정리할 수 있습니다.

---

## ✅ STEP 1. 민감 정보 노출 여부 확인

### 🔎 키워드 기반 검색
```bash
git log -p | grep -Ei '(secret|token|password|apikey|key)'
```

### 🔎 고난도 base64, 토큰 스타일 문자열 검색
```bash
grep -r --exclude-dir='.git' -E '(["'"'"'])[A-Za-z0-9]{20,}(["'"'"'])' .
```

> 💡 민감한 문자열이나 하드코딩된 API 키 등이 발견되면 STEP 2로 진행합니다.

---

## ✅ STEP 2. 워킹 디렉토리에서 삭제 또는 수정 후 커밋 & 푸시

### 🔧 민감 파일 삭제
```bash
git rm passwords.txt
```

### 🔧 코드 수정 & 푸시
```bash
# 예: config.py에서 하드코딩된 SECRET_KEY 제거 후
git add .
git commit -m "Remove exposed secret"
git push origin main
```

---

## ✅ STEP 3. Git 히스토리에서 민감 정보 제거

### 📁 민감 파일 전체 제거 (히스토리 포함)
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch 파일경로" \
  --prune-empty --tag-name-filter cat -- --all
```

### 🔑 문자열(시크릿 키 등) 바꾸기
```bash
git filter-branch --force --tree-filter \
  "sed -i 's/노출된문자열/REMOVED_SECRET_KEY/g' 파일경로" \
  --prune-empty --tag-name-filter cat -- --all
```

> ⚠️ `sed` 명령어는 OS나 셸에 따라 다를 수 있으니 적절히 수정 필요

---

## ✅ STEP 4. Git 내부 캐시 및 백업 정리 (필수)

```bash
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

> 🧹 filter-branch로 수정한 히스토리가 `.git` 내부에 남아 있을 수 있으므로 반드시 이 과정 수행

---

## ✅ STEP 5. 로그 재확인 (완전 삭제 확인)

```bash
git log -p | grep -Ei '(secret|token|password|apikey|key)'
```

> 🔍 아무것도 출력되지 않으면 히스토리에서 민감 정보 완전 제거 완료!

---

## 🧾 전체 흐름 요약

```
[1] 로그 검색 → [2] 수정 & 커밋 → [3] filter-branch 처리  
→ [4] git gc 등 정리 → [5] 로그 재확인
```

---

## 📌 보안 모범 사례 (추가 팁)

- 민감 정보는 항상 `.env` 파일 등 환경변수로 관리
- `.env`, `*.pem`, `*.crt` 파일은 `.gitignore`에 등록
- GitGuardian 등의 자동 탐지 도구 사용 권장
- 되도록 `git filter-repo`를 사용할 것 (filter-branch는 비권장됨)

---
