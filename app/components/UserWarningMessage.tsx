import { CiWarning } from "react-icons/ci";

interface UserWarningMessageProps {
  isWelcomed: boolean;
  isWelcomedExplanation: string;
}

export const UserWarningMessage = ({ isWelcomed, isWelcomedExplanation }: UserWarningMessageProps) => {
  if (isWelcomed) return null;
  return (
  <div className="bg-warning p-2 rounded-md mt-20">
    <p className="text-warning-content flex items-center gap-2">
        <CiWarning className="text-warning-content" />
        {isWelcomedExplanation}
    </p>
  </div>);
};
