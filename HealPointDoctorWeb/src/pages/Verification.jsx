import React, { useState } from "react";
import api from "../services/api";

const Verification = () => {
  const [files, setFiles] = useState({
    passportPhoto: null,
    medicalCouncilRegistration: null,
    governmentRegistration: null,
    medicalLicense: null,
    mbbsCertificate: null,
    mdMsCertificate: null,
    specializationCertificate: null,
    experienceCertificates: [],
    governmentId: null,
    aadhaarPan: null,
    hospitalAffiliationLetter: null,
    additionalCertificates: [],
  });

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    if (name === "experienceCertificates" || name === "additionalCertificates") {
      setFiles((prevFiles) => ({
        ...prevFiles,
        [name]: [...prevFiles[name], ...selectedFiles],
      }));
    } else {
      setFiles((prevFiles) => ({
        ...prevFiles,
        [name]: selectedFiles[0],
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    const stored = JSON.parse(localStorage.getItem("doctorApp") || "null");
    const doctorId = stored?.doctor?._id;
    if (!doctorId) return;

    // Append all files to FormData
    Object.entries(files).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((file) => {
          formData.append(key, file);
        });
      } else if (value) {
        formData.append(key, value);
      }
    });

    try {
      const res = await api.post(`/api/v1/doctor/upload-documents/${doctorId}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      console.log("Documents uploaded successfully:", res.data);
      // Handle success (e.g., show a success message, redirect)
    } catch (error) {
      console.error("Error uploading documents:", error);
      // Handle error (e.g., show an error message)
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Doctor Verification</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Passport Size Photo</label>
          <input type="file" name="passportPhoto" onChange={handleFileChange} className="mt-1 block w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Medical Council Registration Number</label>
          <input type="file" name="medicalCouncilRegistration" onChange={handleFileChange} className="mt-1 block w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Government Registration Number</label>
          <input type="file" name="governmentRegistration" onChange={handleFileChange} className="mt-1 block w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Medical License</label>
          <input type="file" name="medicalLicense" onChange={handleFileChange} className="mt-1 block w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">MBBS Certificate</label>
          <input type="file" name="mbbsCertificate" onChange={handleFileChange} className="mt-1 block w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">MD/MS Certificate</label>
          <input type="file" name="mdMsCertificate" onChange={handleFileChange} className="mt-1 block w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Specialization Certificate</label>
          <input type="file" name="specializationCertificate" onChange={handleFileChange} className="mt-1 block w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Experience Certificates</label>
          <input type="file" name="experienceCertificates" onChange={handleFileChange} className="mt-1 block w-full" multiple />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Government ID</label>
          <input type="file" name="governmentId" onChange={handleFileChange} className="mt-1 block w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Aadhaar/PAN</label>
          <input type="file" name="aadhaarPan" onChange={handleFileChange} className="mt-1 block w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Hospital Affiliation Letter (optional)</label>
          <input type="file" name="hospitalAffiliationLetter" onChange={handleFileChange} className="mt-1 block w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Additional Certificates</label>
          <input type="file" name="additionalCertificates" onChange={handleFileChange} className="mt-1 block w-full" multiple />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">
          Upload Documents
        </button>
      </form>
    </div>
  );
};

export default Verification;
