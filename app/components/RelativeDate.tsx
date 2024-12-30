type RelativeDateProps = {
  timestamp: string;
};

const RelativeDate = ({ timestamp }: RelativeDateProps) => {
  const getRelativeTime = (timestamp:string) => {
    const now = new Date();
    const targetDate = new Date(timestamp);
    const diffInSeconds = (now.getTime() - targetDate.getTime()) / 1000;

    const secondsInHour = 3600;
    const secondsInDay = 86400;
    const secondsInMonth = 2592000; // 30 days
    const secondsInYear = 31536000; // 365 days

    if (diffInSeconds < secondsInDay) {
      const hours = Math.floor(diffInSeconds / secondsInHour);
      return `${hours}時間前`;
    }
    if (diffInSeconds < secondsInMonth) {
      const days = Math.floor(diffInSeconds / secondsInDay);
      return `${days}日前`;
    }
    if (diffInSeconds < secondsInYear) {
      const months = Math.floor(diffInSeconds / secondsInMonth);
      return `${months}か月前`;
    }
    const years = Math.floor(diffInSeconds / secondsInYear);
    return `${years}年前`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).replace(/\//g, "-");
  }

  return (
    <div className="tooltip tooltip-right" data-tip={formatTime(timestamp)}>
        <span>{getRelativeTime(timestamp)}</span>
    </div>
);
};

export default RelativeDate;
