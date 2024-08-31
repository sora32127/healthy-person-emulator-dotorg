import { RxReload } from "react-icons/rx";

export default function ReloadButton() {
    return (
        <button className="refresh-button btn btn-circle btn-sm" type="button" onClick={() => {
            window.location.reload();
        }}>
            <RxReload className="w-4 h-4" />
        </button>
    );
}