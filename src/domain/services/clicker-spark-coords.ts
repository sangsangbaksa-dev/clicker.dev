/** Map viewport pointer coords into an overlay's local CSS layout space.
 * Uses getBoundingClientRect (scroll + CSS transforms in viewport CSS px)
 * and remaps into offsetWidth/offsetHeight space when the element is scaled.
 * DPR is not applied — CSS `left`/`top` are in CSS pixels, same as clientX/Y.
 */
export function pointerToOverlayCoords(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  layoutSize?: { width: number; height: number },
): { x: number; y: number } {
  const visualX = clientX - rect.left
  const visualY = clientY - rect.top
  const layoutW = layoutSize?.width ?? rect.width
  const layoutH = layoutSize?.height ?? rect.height
  const scaleX = rect.width > 0 ? layoutW / rect.width : 1
  const scaleY = rect.height > 0 ? layoutH / rect.height : 1
  return {
    x: visualX * scaleX,
    y: visualY * scaleY,
  }
}
