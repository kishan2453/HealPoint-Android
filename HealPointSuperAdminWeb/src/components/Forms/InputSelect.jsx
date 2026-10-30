import React from "react";
import PremiumSelect from "../common/PremiumSelect";

const InputSelect = ({ label, value, setValue, options }) => {
  // Convert array of strings into { label, value } objects
  const formattedOptions = options?.map(op => ({ label: op, value: op })) || [];

  return (
    <div className="mb-3">
      <label htmlFor="" className="form-label">
        {label}
      </label>
      <PremiumSelect
        value={value}
        onChange={(e) => setValue(e.target.value)}
        options={formattedOptions}
        placeholder={`Select ${label}`}
      />
    </div>
  );
};

export default InputSelect;
