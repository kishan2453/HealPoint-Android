import healthDocumentModel from "../models/healthDocumentModel.js";

export const uploadDocument = async (req, res) => {
  try {
    const { title, category, documentDate, fileData, mimeType, size, notes, familyMemberId } = req.body;
    if (!title || !fileData) {
      return res.status(400).json({ success: false, message: "Title and document data are required" });
    }

    const doc = await healthDocumentModel.create({
      userId: req.user.id,
      familyMemberId: familyMemberId || undefined,
      title: title.trim(),
      category: category || "other",
      documentDate: documentDate || new Date().toISOString().split("T")[0],
      fileData,
      mimeType: mimeType || "application/pdf",
      size: size || 0,
      notes: notes || "",
    });

    res.status(201).json({ success: true, message: "Document saved securely", document: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyDocuments = async (req, res) => {
  try {
    const documents = await healthDocumentModel
      .find({ userId: req.user.id })
      .select("-fileData") // Exclude heavy payload in lists
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, documents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDocumentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await healthDocumentModel.findOne({ _id: id, userId: req.user.id });
    if (!document) return res.status(404).json({ success: false, message: "Document not found" });

    res.status(200).json({ success: true, document });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    await healthDocumentModel.findOneAndDelete({ _id: id, userId: req.user.id });
    res.status(200).json({ success: true, message: "Document deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
