export const CARD_DRAG_MIME = "application/x-inklex-card";

export function setDraggedCardId(dataTransfer: DataTransfer, cardId: string) {
  dataTransfer.setData(CARD_DRAG_MIME, cardId);
  dataTransfer.setData("text/plain", cardId);
  dataTransfer.effectAllowed = "move";
}

export function readDraggedCardId(dataTransfer: DataTransfer): string | null {
  const id =
    dataTransfer.getData(CARD_DRAG_MIME) || dataTransfer.getData("text/plain");
  return id.trim() || null;
}

export function isCardDrag(dataTransfer: DataTransfer): boolean {
  return (
    dataTransfer.types.includes(CARD_DRAG_MIME) ||
    dataTransfer.types.includes("text/plain")
  );
}
