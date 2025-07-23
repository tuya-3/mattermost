# Mattermost Recent Mentions 検索問題の調査結果

## 問題概要

Mattermostの「user-XXX」形式のユーザー名において、recent mentionsとmessage searchで異なる検索結果が発生する問題。

### 現象
- **Recent mentions API**: 「user-XXX」の「user」部分で意図しない一致が発生
- **Message search API**: 正常に動作

### API仕様の差異

| 項目 | Recent mentions API | Message search API |
|------|-------------------|-------------------|
| エンドポイント | `POST /api/v4/posts/search` | `POST /api/v4/teams/{team_id}/posts/search` |
| スコープ | グローバル検索 | チーム内検索 |
| `is_or_search` | `true` | `false` |

## 根本原因

### 1. Recent mentions APIでの問題

**リクエスト例:**
```json
{
  "terms": "\"user-416241\" 田中 \"野口\" \"@user-416241\"",
  "is_or_search": true,
  "include_deleted_channels": true,
  "time_zone_offset": 32400,
  "page": 0,
  "per_page": 20
}
```

**問題点:**
- 引用符がバックスラッシュでエスケープされていない
- JSONパース時に引用符が失われる
- `user-416241` → ハイフンが空白に置換 → `user 416241`
- 結果として `user` で誤った一致が発生

### 2. Message search APIでの正常動作

**リクエスト例:**
```json
{
  "terms": "\\\"user-416241\\\" 田中 \\\"@user-416241\\\"",
  "is_or_search": false,
  "include_deleted_channels": true,
  "time_zone_offset": 32400,
  "page": 0,
  "per_page": 20
}
```

**正常な理由:**
- 引用符がバックスラッシュでエスケープされている
- JSONパース後も引用符が保持される
- `"user-416241"` → 引用符で保護され、特殊文字置換の影響を受けない

## コード内の具体的な問題箇所

### 1. 特殊文字の定義

**ファイル:** `server/channels/store/sqlstore/store.go`

```go
// specialSearchChars have special meaning and can be treated as spaces
func (ss *SqlStore) specialSearchChars() []string {
    chars := []string{
        "<", ">", "+", "-", "(", ")", "~", ":",  // ← ハイフンが含まれている
    }
    
    // Postgres can handle "@" without any errors
    if ss.DriverName() != model.DatabaseDriverPostgres {
        chars = append(chars, "@")
    }
    
    return chars
}
```

### 2. 特殊文字の置換処理

**ファイル:** `server/channels/store/sqlstore/post_store.go`

```go
for _, c := range s.specialSearchChars() {
    if !params.IsHashtag {
        terms = strings.Replace(terms, c, " ", -1)  // ← ハイフンが空白に置換
    }
    excludedTerms = strings.Replace(excludedTerms, c, " ", -1)
}
```

### 3. 検索パラメータのパース処理

**ファイル:** `server/public/model/search_params.go`

引用符の処理ロジック:
```go
func splitWords(text string) []string {
    words := []string{}
    foundQuote := false
    location := 0
    
    for i, char := range text {
        if char == '"' {
            if foundQuote {
                // Grab the quoted section
                word := text[location : i+1]
                words = append(words, word)
                foundQuote = false
                location = i + 1
            } else {
                // Start quoted section
                nextStart := i
                if i > 0 && text[i-1] == '-' {
                    nextStart = i - 1
                }
                words = append(words, strings.Fields(text[location:nextStart])...)
                foundQuote = true
                location = nextStart
            }
        }
    }
    
    words = append(words, strings.Fields(text[location:])...)
    return words
}
```

## 既知の問題であることの確認

**ファイル:** `server/channels/store/searchtest/post_layer.go`

```go
{
    Name:        "Should be able to search terms with dashes",
    Fn:          testSearchTermsWithDashes,
    Tags:        []string{EngineAll},
    Skip:        true,
    SkipMessage: "Not working",  // ← 現在動作していない
},
```

ただし、引用符を使用した検索は正常に動作：
```go
t.Run("Should search terms with dash using quotes", func(t *testing.T) {
    params := &model.SearchParams{Terms: "\"term-with-dash\""}
    results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
    require.NoError(t, err)
    
    require.Len(t, results.Posts, 1)
    th.checkPostInSearchResults(t, p1.Id, results.Posts)
})
```

## 解決策

### 提案されている解決策: クウォートをバックスラッシュでエスケープ

**Recent mentions APIのクエリを以下のように修正:**

```json
// 修正前
{
  "terms": "\"user-416241\" 田中 \"野口\" \"@user-416241\""
}

// 修正後  
{
  "terms": "\\\"user-416241\\\" 田中 \\\"野口\\\" \\\"@user-416241\\\""
}
```

### この修正により:

1. **JSONパース後も引用符が保持される**
2. **引用符で囲まれた文字列は一つの検索語として扱われる**
3. **`specialSearchChars()` の影響を受けない**
4. **正確な検索が実行される**

### 処理フロー

```
修正前: "user-416241" → user-416241 → user 416241 (ハイフン置換) → user で誤った一致
修正後: \"user-416241\" → "user-416241" → "user-416241" (引用符保護) → 正確な一致
```

## 関連issue

- **Upstream**: https://github.com/mattermost/mattermost/issues/30196
- **関連**: https://mattermost.atlassian.net/browse/MM-63582

## 実装上の注意点

1. この修正により、`user-XXX` 形式のユーザー名表記が継続される場合でも問題が解決される
2. 引用符エスケープは既存のmessage search APIで実証済みの手法
3. 他の検索機能への影響は最小限

## まとめ

Recent mentions APIとmessage search APIの検索クエリ処理方法の違いが原因で、ハイフンを含むユーザー名の検索で意図しない結果が発生していました。提案されているクウォートのバックスラッシュエスケープによる修正は、既存のmessage search APIで実証済みの効果的な解決策です。 