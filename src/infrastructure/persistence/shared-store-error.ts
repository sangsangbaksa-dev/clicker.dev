/** Thrown when a shared JSON store timed out or failed, so defaults must not be persisted. */
export class SharedStoreUnavailableError extends Error {
  constructor(
    message = "공유 저장소를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
  ) {
    super(message)
    this.name = "SharedStoreUnavailableError"
  }
}
