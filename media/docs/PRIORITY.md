# 클릭커 21:51 Cursor 전달 — 우선순위 (2026-09-24)

에이전트: bc-5c0f96b1 / PR #2 branch `cursor/clicker-art-pack-6a20`
모델: Auto. on-demand/Models 한도 무시하고 진행 (사용자 지시).

## 우선순위 (위에서부터)

### 1) BGM 무음 수정
- 패치: `patches/20260922-2256-first-audio-silent/NOTE.md`
- 와이어: `patches/20260922-2343-first-bgm-unmute-wire/WIRE.md`
- ESC/오디오 버그픽스: `patches/20260922-2337-Second-bugfix-esc-audio/`
- 오디오 MP3: `audio/` (hub/mine 스팅어·세션엔드·Runway SFX 포함)
- 첫 제스처에서 AudioContext.resume, muted=false, volume>0. Hub↔Mine BGM 전환.

### 2) 피버 BG 회전 제거
- Fever 활성 시 챔버 BG가 회전/스핀하지 않게 할 것.
- 허용: additive pulse overlay (`mine_ambient_motion_wire_v1` 톤의 밝기 펄스만).
- 금지: CSS/transform rotate, orbit, spinning fever background.

### 3) 입장/레이아웃 + 엘든 포그 와이어
- **선호 입장 모션: door-walk-v11 (SEAM≈658/659 matchTemplate; NOT 616)** (ASSETS.md / MOTION.door-walk-v11.md).
  - 샘플 프레임: `door-walk-v11/frames-sample/` (매 5프레임 JPEG; 전체 200 PNG는 용량상 미첨부 — 미리보기 mp4로 타이밍 맞출 것)
  - 미리보기+SFX: `door-walk-v11/mine_enter_door_walk_v11_with_sfx.mp4`
  - 닫힌 문/내부 광석 플레이트 포함
  - entering 동안 채굴 차단, 마지막 프레임 후 타이머 시작
- 엘든 포그 게이트 스틸: `elden-fog/` + MOTION.elden-fog.md (크로스페이드 대안/보강 레이어로 배선 가능; door-walk-v11가 주 시퀀스)
- 단일 중앙 광석: `patches/20260924-1652-single-center-ore/`
- 입장 와이어 참고: `patches/20260922-2237-Second-entrance-wire/`, hub-hud 패치

### 보너스 (여유 시)
- rebirth particles gap: `rebirth-particles-gap/` (Resonance + Volatile Core 틴트 오버레이)

## 완료 기준
- PR #2에 커밋·푸시
- BGM이 제스처 후 재생되고, Fever BG가 회전하지 않으며, Enter Mine이 door-walk(또는 폴백 fog)로 연결됨
- 무관한 UI/화폐 로직 변경 금지
