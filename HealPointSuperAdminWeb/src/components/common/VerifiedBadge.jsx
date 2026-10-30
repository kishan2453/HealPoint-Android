import React from "react";

const VerifiedBadge = ({ isVerified }) => {
  if (!isVerified) {
    return null;
  }

  return (
    <span className="bg-green-100 text-green-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300">
      Verified
    </span>
  );
};

export default VerifiedBadge;
