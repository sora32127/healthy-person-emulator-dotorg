import { CiWarning } from "react-icons/ci";


interface UserWarningMessageProps {
  isWelcomed: boolean;
  isWelcomedReason: string;
}

export const UserWarningMessage = ({ isWelcomed, isWelcomedReason }: UserWarningMessageProps) => {
  if (isWelcomed) return null;
  return (
  <div className="bg-warning p-2 rounded-md mt-20">
    <p className="text-warning-content flex items-center gap-2">
        <CiWarning className="text-warning-content" />
        {isWelcomedReason}
    </p>
  </div>);
};
