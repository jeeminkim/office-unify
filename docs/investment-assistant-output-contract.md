# Investment Assistant Output Contract

## 적용 대상

- `POST /api/private-banker/message`
- `POST /api/committee-discussion/report`
- (참고) `POST /api/committee-discussion/round`는 품질 메타만 반환

## 필수 섹션

아래 섹션이 결과 텍스트에 존재해야 한다.

1. 행동 분류
2. 정보 상태
3. 핵심 근거
4. 주요 리스크
5. 지금 해야 할 행동
6. 하면 안 되는 행동
7. 다음 관찰 포인트

## 서버 후처리 정책

- 1차: `validateInvestmentAssistantOutput(text)`로 누락 섹션 검사
- 2차: 누락 시 `normalizeInvestmentAssistantOutput(text)`로 최대 1회 형식 보정
- 보정은 **형식 섹션 placeholder 추가만** 수행
- 투자 판단 내용 자체를 바꾸지 않는다.

## 품질 메타

```ts
type OutputQuality = {
  formatValid: boolean;
  missingSections: string[];
  normalized: boolean;
  warnings: string[];
};
```

