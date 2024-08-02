interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    showCloseButton?: boolean;
  }
  
export function Modal({ isOpen, onClose, title, children, showCloseButton = true }: ModalProps) {
    if (!isOpen) return null;
  
    return (
      <dialog className="modal modal-open">
        <div className="modal-box">
          <h3 className="font-bold text-lg">{title}</h3>
          <div className="py-4">{children}</div>
          {showCloseButton && (
            <div className="modal-action">
              <button className="btn" onClick={onClose}>閉じる</button>
            </div>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={onClose}>close</button>
        </form>
      </dialog>
    );
}
